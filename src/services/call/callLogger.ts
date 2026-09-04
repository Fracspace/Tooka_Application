import AsyncStorage from '@react-native-async-storage/async-storage';

import { Crashlytics, CrashlyticsKeys } from '../firebase/crashlytics';

/**
 * Verbose console output and the on-screen CallInspectorOverlay. Dev only.
 *
 * PR-6: this used to gate log() ENTIRELY, which meant every callLogger call in the
 * whole feature was a no-op in release: no breadcrumbs, no Crashlytics trail, and
 * persistSessionLogs wrote empty timelines. A field bug report came with no evidence
 * at all. Logging now always runs; this flag only controls how noisy it is locally.
 */
export const ENABLE_CALL_DIAGNOSTICS = __DEV__;

/** Ring-buffer bounds. Timelines are retained in release now, so they must be finite. */
const MAX_TIMELINE_ENTRIES = 300;
const MAX_RETAINED_SESSIONS = 5;

export enum LogLevel {
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface CallLogContext {
  sessionId?: string;
  callState?: string;
  channelName?: string;
  uid?: number;
  remoteUid?: number;
}

export interface AudioStateSnapshot {
  micEnabled: boolean;
  micMuted: boolean;
  speakerEnabled: boolean;
  bluetoothConnected: boolean;
  headphonesConnected: boolean;
  audioRoute: string;
  publishState: string;
  subscribeState: string;
  localAudioState: string;
  remoteAudioState: string;
  remoteJoined: boolean;
  networkQualityTx: number;
  networkQualityRx: number;
  volume: number;
}

class CallLogger {
  private sequenceNumbers: Record<string, number> = {};
  private sessionTimelines: Record<string, string[]> = {};
  private audioSnapshots: Record<string, AudioStateSnapshot> = {};
  // PR-6: session ids in first-seen order, so the maps above can be pruned. They
  // previously grew for the lifetime of the process - one entry per call, forever.
  private sessionOrder: string[] = [];
  private lastReportedState: string | null = null;

  // For visual overlay live rendering
  private activeSessionId: string | null = null;
  private onLogCallbacks: Set<(log: string) => void> = new Set();
  private onAudioUpdateCallbacks: Set<(snapshot: AudioStateSnapshot) => void> = new Set();
  private currentCallState: string = 'IDLE';

  constructor() {
    this.resetAudioSnapshot('global');
  }

  setCallState(state: string) {
    this.currentCallState = state;
  }

  getCallState(): string {
    return this.currentCallState;
  }

  registerLogCallback(cb: (log: string) => void) {
    this.onLogCallbacks.add(cb);
  }

  unregisterLogCallback(cb: (log: string) => void) {
    this.onLogCallbacks.delete(cb);
  }

  registerAudioCallback(cb: (snapshot: AudioStateSnapshot) => void) {
    this.onAudioUpdateCallbacks.add(cb);
  }

  unregisterAudioCallback(cb: (snapshot: AudioStateSnapshot) => void) {
    this.onAudioUpdateCallbacks.delete(cb);
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  getAudioSnapshot(sessionId?: string): AudioStateSnapshot {
    const key = sessionId || 'global';
    if (!this.audioSnapshots[key]) {
      this.resetAudioSnapshot(key);
    }
    return this.audioSnapshots[key];
  }

  updateAudioSnapshot(sessionId: string | undefined, updates: Partial<AudioStateSnapshot>) {
    const key = sessionId || 'global';
    const current = this.getAudioSnapshot(key);
    this.audioSnapshots[key] = { ...current, ...updates };
    this.onAudioUpdateCallbacks.forEach((cb) => cb(this.audioSnapshots[key]));
  }

  resetAudioSnapshot(sessionId: string) {
    this.audioSnapshots[sessionId] = {
      micEnabled: true,
      micMuted: false,
      speakerEnabled: false,
      bluetoothConnected: false,
      headphonesConnected: false,
      audioRoute: 'earpiece',
      publishState: 'idle',
      subscribeState: 'idle',
      localAudioState: 'stopped',
      remoteAudioState: 'stopped',
      remoteJoined: false,
      networkQualityTx: 0,
      networkQualityRx: 0,
      volume: 100,
    };
  }

  sanitize(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      // Scrub tokens, authorization headers
      if (data.length > 50 && (data.includes('eyJ') || data.startsWith('Authorization') || data.includes('token'))) {
        return `${data.substring(0, 15)}...[REDACTED]...${data.substring(data.length - 15)}`;
      }
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }
    if (typeof data === 'object') {
      const scrubbed: Record<string, any> = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const lowerKey = key.toLowerCase();
          if (
            lowerKey.includes('token') ||
            lowerKey.includes('jwt') ||
            lowerKey.includes('authorization') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('password') ||
            lowerKey.includes('key')
          ) {
            const val = data[key];
            if (typeof val === 'string') {
              scrubbed[key] = val.length > 30 
                ? `${val.substring(0, 15)}...[REDACTED]...${val.substring(val.length - 15)}`
                : '[REDACTED]';
            } else {
              scrubbed[key] = '[REDACTED]';
            }
          } else {
            scrubbed[key] = this.sanitize(data[key]);
          }
        }
      }
      return scrubbed;
    }
    return data;
  }

  diffObjects(oldObj: any, newObj: any): string {
    if (!oldObj) return 'Old object is null/undefined';
    if (!newObj) return 'New object is null/undefined';
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
      const oldVal = oldObj[key];
      const newVal = newObj[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        const oldStr = typeof oldVal === 'object' ? JSON.stringify(this.sanitize(oldVal)) : String(oldVal);
        const newStr = typeof newVal === 'object' ? JSON.stringify(this.sanitize(newVal)) : String(newVal);
        changed.push(`  * ${key}: ${oldStr} -> ${newStr}`);
      }
    }
    return changed.length > 0 ? changed.join('\n') : '  * No fields changed';
  }

  private trackSession(sessionId: string) {
    // 'global' and 'NO_SESSION' are shared buckets, not per-call sessions.
    if (sessionId === 'global' || sessionId === 'NO_SESSION') return;
    if (this.sessionOrder.includes(sessionId)) return;
    this.sessionOrder.push(sessionId);

    while (this.sessionOrder.length > MAX_RETAINED_SESSIONS) {
      const oldest = this.sessionOrder.shift();
      if (!oldest) continue;
      delete this.sessionTimelines[oldest];
      delete this.audioSnapshots[oldest];
      delete this.sequenceNumbers[oldest];
    }
  }

  log(category: string, message: string, ctx: CallLogContext | null | undefined, details?: any, level: LogLevel = LogLevel.INFO) {
    // DEBUG is the high-frequency stuff - onNetworkQuality and
    // onAudioVolumeIndication fire every 300ms. Never ship that to Crashlytics.
    if (level === LogLevel.DEBUG && !ENABLE_CALL_DIAGNOSTICS) return;

    const time = this.formatTime();
    const sessionId = ctx?.sessionId || 'NO_SESSION';
    if (ctx?.sessionId && this.activeSessionId !== ctx.sessionId) {
      this.activeSessionId = ctx.sessionId;
      // Stamp the crash report so a crash mid-call names the session.
      Crashlytics.setCustomKey(CrashlyticsKeys.CALL_SESSION_ID, ctx.sessionId);
    }
    // Only on change - calls log a lot, and setAttribute crosses the bridge.
    if (ctx?.callState && ctx.callState !== this.lastReportedState) {
      this.lastReportedState = ctx.callState;
      Crashlytics.setCustomKey(CrashlyticsKeys.CALL_STATE, ctx.callState);
    }
    this.trackSession(sessionId);
    const state = ctx?.callState || 'UNKNOWN';

    // Sequence Number per session
    const seqKey = sessionId;
    const seqNum = (this.sequenceNumbers[seqKey] = (this.sequenceNumbers[seqKey] || 0) + 1);
    const seqStr = `#${String(seqNum).padStart(4, '0')}`;

    const prefix = `[${time}] [${seqStr}] [CALL:${sessionId.substring(0, 8)}] [${state}] [${category}] [${level}]`;
    
    let detailsStr = '';
    if (details !== undefined) {
      const sanitizedDetails = this.sanitize(details);
      if (typeof sanitizedDetails === 'object') {
        try {
          detailsStr = '\n' + JSON.stringify(sanitizedDetails, null, 2);
        } catch (e) {
          detailsStr = '\n[Serialization Error]';
        }
      } else {
        detailsStr = ` ${sanitizedDetails}`;
      }
    }

    const logMsg = `${prefix} ${message}${detailsStr}`;

    // Console output stays development-only: in release it is invisible anyway, and
    // the sanitized `details` payload is the noisiest part of every line.
    if (ENABLE_CALL_DIAGNOSTICS) {
      switch (level) {
        case LogLevel.INFO:
        case LogLevel.DEBUG:
          console.log(logMsg);
          break;
        case LogLevel.WARN:
          console.warn(logMsg);
          break;
        case LogLevel.ERROR:
          console.error(logMsg);
          break;
      }
    }

    // PR-6: breadcrumbs, in every build. Deliberately WITHOUT `detailsStr` - that is
    // where tokens, payloads and profile data live. The prefix carries session id,
    // call state, category and level; the message carries timings and status codes.
    if (level !== LogLevel.DEBUG) {
      Crashlytics.log(`${prefix} ${message}`);

      if (level === LogLevel.ERROR) {
        Crashlytics.recordError(
          details instanceof Error ? details : new Error(`${prefix} ${message}`),
        );
      }
    }

    // PR-6: never fold a SUMMARY back into the timeline. printCallSummary() renders
    // the timeline INTO its output and then logs it, so each summary used to embed the
    // previous one - the nested CALL SUMMARY blocks visible in field logs. Harmless
    // when timelines were dev-only; real memory growth now that they are retained.
    if (category === 'SUMMARY') {
      this.onLogCallbacks.forEach((cb) => cb(logMsg));
      return;
    }

    // Append to the in-memory timeline, ring-buffered so a long call cannot grow it
    // without bound now that it is retained in release too.
    if (!this.sessionTimelines[seqKey]) {
      this.sessionTimelines[seqKey] = [];
    }
    const timeline = this.sessionTimelines[seqKey];
    timeline.push(logMsg);
    if (timeline.length > MAX_TIMELINE_ENTRIES) {
      timeline.splice(0, timeline.length - MAX_TIMELINE_ENTRIES);
    }

    // Trigger overlay callback (the overlay itself is dev-only)
    this.onLogCallbacks.forEach((cb) => cb(logMsg));
  }

  getTimeline(sessionId: string): string[] {
    return this.sessionTimelines[sessionId] || [];
  }

  async persistSessionLogs(sessionId: string, isFailure: boolean = false) {
    const timeline = this.sessionTimelines[sessionId];
    if (!timeline || timeline.length === 0) return;

    const logContent = timeline.join('\n');
    const key = `@tooka:call_log:${sessionId}`;
    const failKey = `@tooka:call_failure_log:${sessionId}`;

    try {
      await AsyncStorage.setItem(key, logContent);
      console.log(`[CallLogger] Persisted logs to ${key}`);
      if (isFailure) {
        await AsyncStorage.setItem(failKey, logContent);
        console.log(`[CallLogger] Registered call failure log in ${failKey}`);
      }
    } catch (e) {
      console.error('[CallLogger] Failed to write logs to AsyncStorage', e);
    }
  }

  info(category: string, message: string, ctx: CallLogContext | null | undefined, details?: any) {
    this.log(category, message, ctx, details, LogLevel.INFO);
  }

  debug(category: string, message: string, ctx: CallLogContext | null | undefined, details?: any) {
    this.log(category, message, ctx, details, LogLevel.DEBUG);
  }

  warn(category: string, message: string, ctx: CallLogContext | null | undefined, details?: any) {
    this.log(category, message, ctx, details, LogLevel.WARN);
  }

  error(category: string, message: string, ctx: CallLogContext | null | undefined, details?: any) {
    this.log(category, message, ctx, details, LogLevel.ERROR);
  }

  private formatTime(): string {
    const now = new Date();
    const pad = (n: number, m: number = 2) => String(n).padStart(m, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
  }
}

export const callLogger = new CallLogger();
