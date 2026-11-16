import { NativeModules, Platform } from 'react-native';
import Sound from 'react-native-sound';
import { callConsole } from './callLogger';

try {
  Sound.setCategory('Playback', true);
} catch (e) {
  callConsole.warn('[CALL_AUDIO] Failed to set sound category', e);
}

function setIosCategory(category: 'SoloAmbient' | 'Playback') {
  if (Platform.OS !== 'ios') return;
  try {
    Sound.setCategory(category, true);
  } catch (e) {
    callConsole.warn('[CALL_AUDIO] Failed to set sound category', e);
  }
}

export type RingtoneType = 'incoming' | 'outgoing';

class RingtoneService {
  private currentSound: Sound | null = null;
  private currentType: RingtoneType | null = null;
  private isLoading = false;
  private playId = 0; // Incremented on each start/stop to invalidate stale async callbacks
  private nativeRinging = false; // Android incoming ring is played natively (CallRinger.kt)

  /**
   * Play the incoming call ringtone (incoming_ring.mp3).
   * Idempotent: Does not recreate or restart sound if already playing or loading incoming ringtone.
   */
  async playIncoming(): Promise<void> {
    // Android: the native ringer, like a phone call - follows Ring / Vibrate / Silent,
    // rings at the ringtone volume, and the volume or lock button silences it.
    const nativeRinger = Platform.OS === 'android' ? NativeModules.IncomingCallNotification : null;
    if (nativeRinger?.startInAppRing) {
      if (this.nativeRinging) return;
      this.stop();
      this.nativeRinging = true;
      nativeRinger.startInAppRing();
      return;
    }
    // iOS: a category the silent switch mutes, as a ringing phone would be.
    setIosCategory('SoloAmbient');
    return this.startRingtone('incoming', 'incoming_ring.mp3');
  }

  /**
   * Play the outgoing call ringtone (outgoing_ring.mp3).
   * Idempotent: Does not recreate or restart sound if already playing or loading outgoing ringtone.
   */
  async playOutgoing(): Promise<void> {
    // The ringback is part of a call the user started: plays even on silent.
    setIosCategory('Playback');
    return this.startRingtone('outgoing', 'outgoing_ring.mp3');
  }

  /**
   * Play specified ringtone type. Defaults to 'incoming' for backwards compatibility.
   */
  async play(type: RingtoneType = 'incoming'): Promise<void> {
    if (type === 'outgoing') {
      return this.playOutgoing();
    }
    return this.playIncoming();
  }

  /**
   * Internal helper to start playing a ringtone file safely.
   */
  private async startRingtone(type: RingtoneType, filename: string): Promise<void> {
    // Idempotency check: if already playing or loading the requested type, do nothing
    if (this.currentType === type && (this.currentSound || this.isLoading)) {
      callConsole.log(`[CALL_AUDIO] Ringtone '${type}' already playing or loading.`);
      return;
    }

    // Stop any existing playback before starting a new ringtone (ensures only ONE ringtone plays)
    this.stop();

    const thisPlayId = ++this.playId;
    this.currentType = type;
    this.isLoading = true;

    return new Promise<void>((resolve) => {
      try {
        callConsole.log(`[CALL_AUDIO] Loading ringtone '${filename}'...`);
        const sound = new Sound(filename, Sound.MAIN_BUNDLE, (error) => {
          // Race condition check: If playId changed while loading, discard sound
          if (this.playId !== thisPlayId) {
            callConsole.log(`[CALL_AUDIO] Ringtone load callback for '${type}' arrived after state change. Discarding.`);
            try {
              sound.release();
            } catch {}
            resolve();
            return;
          }

          this.isLoading = false;

          if (error) {
            callConsole.error(`[CALL_AUDIO] Failed to play ringtone '${filename}':`, error);
            this.currentSound = null;
            this.currentType = null;
            resolve();
            return;
          }

          this.currentSound = sound;
          sound.setNumberOfLoops(-1); // Loop continuously while waiting

          sound.play((success) => {
            if (!success) {
              callConsole.error(`[CALL_AUDIO] Ringtone '${filename}' playback failed or interrupted.`);
            }
          });

          callConsole.log(`[CALL_AUDIO] Started ringtone '${type}' (${filename}).`);
          resolve();
        });
      } catch (err) {
        this.isLoading = false;
        this.currentSound = null;
        this.currentType = null;
        callConsole.error(`[CALL_AUDIO] Failed to play ringtone '${filename}':`, err);
        resolve();
      }
    });
  }

  /**
   * Stop ringtone playback and release audio resources.
   * Completely idempotent and safe to call multiple times.
   */
  stop(): void {
    this.playId++;
    this.isLoading = false;
    if (this.nativeRinging) {
      this.nativeRinging = false;
      NativeModules.IncomingCallNotification?.stopInAppRing?.();
    }

    if (this.currentSound) {
      callConsole.log(`[CALL_AUDIO] Stopping ringtone '${this.currentType}'`);
      const soundToRelease = this.currentSound;
      this.currentSound = null;
      this.currentType = null;

      try {
        soundToRelease.stop(() => {
          try {
            soundToRelease.release();
          } catch (e) {
            callConsole.error('[CALL_AUDIO] Error releasing sound:', e);
          }
        });
      } catch (e) {
        callConsole.error('[CALL_AUDIO] Error stopping sound:', e);
        try {
          soundToRelease.release();
        } catch {}
      }
    } else {
      this.currentType = null;
    }
  }

  /**
   * Release resources. Alias for stop().
   */
  release(): void {
    this.stop();
  }
}

export const ringtoneService = new RingtoneService();
