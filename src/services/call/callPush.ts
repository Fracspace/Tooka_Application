import { AppState, NativeModules, Platform } from 'react-native';

import authAxiosClient from '../../api/authAxiosClient';
import { readAuthSession } from '../../utils/authStorage';
import { callActionBody } from './callService';
import { callConsole } from './callLogger';
import { deviceRegistration } from './deviceRegistration';

/**
 * Incoming-call pushes (spaBackend "Incoming-call push" guide). Android gets them as
 * FCM data messages, iOS as PushKit VoIP pushes (AppDelegate reports those to CallKit).
 * Every value is a string.
 */
export interface IncomingCallPush {
  type: 'INCOMING_CALL';
  callSessionId: string;
  channel?: string;
  bookingId?: string;
  spaId?: string;
  spaName?: string;
  spaAvatarUrl?: string;
  callerName?: string;
  callType?: string;
  direction?: string;
  recipientUserId?: string;
  expiresAt?: string;
}

export interface CallEndedPush {
  type: 'CALL_ENDED';
  callSessionId: string;
  reason?: string;
  recipientUserId?: string;
}

type Data = Record<string, unknown> | null | undefined;

export function asIncomingCallPush(data: Data): IncomingCallPush | null {
  if (data?.type !== 'INCOMING_CALL' || typeof data.callSessionId !== 'string') return null;
  return data as unknown as IncomingCallPush;
}

export function asCallEndedPush(data: Data): CallEndedPush | null {
  if (data?.type !== 'CALL_ENDED' || typeof data.callSessionId !== 'string') return null;
  return data as unknown as CallEndedPush;
}

/** A push for another account (shared phone, stale login) must not ring. */
export async function isForLoggedInUser(push: { recipientUserId?: string }): Promise<boolean> {
  const { isLoggedIn, user } = await readAuthSession();
  if (!isLoggedIn) return false;
  return !push.recipientUserId || !user?.id || String(user.id) === push.recipientUserId;
}

/**
 * GET /chat/calls/:id. True while the server still has the call ringing; also true when
 * the check itself fails (offline), so a real call is never dropped for a network blip.
 */
export async function isStillRinging(callSessionId: string): Promise<boolean> {
  try {
    const response = await authAxiosClient.get(`/chat/calls/${callSessionId}`);
    const data = response.data?.data || response.data;
    if (typeof data?.isRinging === 'boolean') return data.isRinging;
    return data?.state ? data.state === 'ringing' : true;
  } catch (error: any) {
    const status = error?.response?.status;
    return !(status === 404 || status === 410);
  }
}

/** Decline a pushed call over REST (the socket may not be up yet). */
export async function declinePushedCall(push: { callSessionId: string; spaId?: string }): Promise<void> {
  try {
    await authAxiosClient.post(
      `/chat/calls/${push.callSessionId}/reject`,
      callActionBody({ sessionId: push.callSessionId, spaId: push.spaId }, 'declined'),
    );
  } catch (error: any) {
    callConsole.warn('[CallPush] decline failed', error?.response?.status ?? error?.message);
  }
}

// ---- iOS, app open: the CallKit banner is the ringing UI ----

/** Calls CallKit has shown (filled by useNativeCallUi). */
export const callKitShown = new Set<string>();
const CALLKIT_WAIT_MS = 4000;

/**
 * iOS with the app open: every VoIP push shows a CallKit banner (Apple requires it), so
 * the socket/FCM ring for the same call must not also ring in the app. True when this
 * phone gets VoIP pushes, so the banner is coming.
 */
export function shouldDeferToCallKit(): boolean {
  return Platform.OS === 'ios' && AppState.currentState === 'active' && deviceRegistration.hasVoip();
}

/** Ring in the app only if CallKit has not shown the call within a few seconds (VoIP push lost). */
export function deferToCallKit(callSessionId: string | undefined, ringInApp: () => void): void {
  if (!callSessionId) {
    ringInApp();
    return;
  }
  setTimeout(() => {
    if (callKitShown.has(callSessionId)) return;
    isStillRinging(callSessionId).then(ringing => ringing && ringInApp());
  }, CALLKIT_WAIT_MS);
}

// ---- Android: the ringing notification (android/.../call/IncomingCallModule.kt) ----

interface AndroidCallNotification {
  show(data: Record<string, string>): void;
  cancel(callSessionId: string): void;
  getLaunchAction(): Promise<{ action: 'answer' | 'open'; data: Record<string, string> } | null>;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): void;
  /** Sync: this app start came from Answer/tap on a ringing call. */
  wasOpenedForCall(): boolean;
  /** After a call: Tooka no longer shows over the lock screen. */
  releaseLockScreen(): void;
  setInCall(inCall: boolean): void;
  setCallsEnabled(enabled: boolean): void;
}

export const androidCallNotification: AndroidCallNotification | undefined =
  Platform.OS === 'android' ? NativeModules.IncomingCallNotification : undefined;

/**
 * Android FCM handler for call pushes while the app is backgrounded or killed
 * (index.js -> setBackgroundMessageHandler). Returns true when it was a call push.
 * CallPushReceiver.kt has usually rung already (it does not wait for JS); this checks
 * the call is still ringing and for this user, and stops the ring if not. show() is
 * idempotent and skips calls already stopped, so it only rings if the receiver did not.
 */
export async function handleBackgroundCallPush(data: Data): Promise<boolean> {
  const ended = asCallEndedPush(data);
  if (ended) {
    androidCallNotification?.cancel(ended.callSessionId);
    return true;
  }
  const push = asIncomingCallPush(data);
  if (!push) return false;
  if (!(await isForLoggedInUser(push)) || !(await isStillRinging(push.callSessionId))) {
    androidCallNotification?.cancel(push.callSessionId);
    return true;
  }
  androidCallNotification?.show(data as Record<string, string>);
  return true;
}

/** Headless task "TookaCallAction": Decline tapped while no JS was running. */
export async function handleCallActionTask(data: Record<string, string>): Promise<void> {
  if (data?.action !== 'decline' || !data.callSessionId) return;
  await declinePushedCall({ callSessionId: data.callSessionId, spaId: data.spaId });
}
