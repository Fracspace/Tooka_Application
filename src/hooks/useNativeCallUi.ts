import { useEffect, useRef } from 'react';
import { Alert, AppState, DeviceEventEmitter, Linking, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import RNCallKeep from 'react-native-callkeep';
import VoipPushNotification from 'react-native-voip-push-notification';

import { callManager } from '../services/call/callManager';
import { callService } from '../services/call/callService';
import { ringtoneService } from '../services/call/ringtoneService';
import { deviceRegistration } from '../services/call/deviceRegistration';
import { callConsole } from '../services/call/callLogger';
import {
  IncomingCallPush,
  androidCallNotification,
  asCallEndedPush,
  asIncomingCallPush,
  callKitShown,
  declinePushedCall,
  deferToCallKit,
  isForLoggedInUser,
  isStillRinging,
  shouldDeferToCallKit,
} from '../services/call/callPush';
import { CallSession, CallState } from '../types/call';

/**
 * Connects the OS call UI to the in-app call flow, for calls pushed while Tooka is in
 * the background or killed:
 *  - iOS: CallKit (reported natively in AppDelegate on every VoIP push). Answer/Decline
 *    on the CallKit screen drive accept/decline here; the in-app call ending ends the
 *    CallKit call.
 *  - Android: the ringing notification (IncomingCallNotification.kt). Answer/Open arrive
 *    as a launch action, Decline as an event (or a headless task when JS is not running).
 * Also registers the VoIP token (iOS) for pushes.
 */

interface Params {
  callState: CallState;
  session: CallSession | null;
  isMuted: boolean;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
}

const RINGING_OR_LIVE = new Set([
  CallState.INCOMING,
  CallState.CONNECTING,
  CallState.CONNECTED,
  CallState.RECONNECTING,
]);

// CXCallEndedReason
const IOS_END_REMOTE = 2;
const IOS_END_UNANSWERED = 3;
const IOS_END_ANSWERED_ELSEWHERE = 4;

// On a call already: a second call is rejected as busy, never rung over this one.
const BUSY = new Set([
  CallState.OUTGOING,
  CallState.RINGING,
  CallState.CONNECTING,
  CallState.CONNECTED,
  CallState.RECONNECTING,
]);

export function useNativeCallUi({
  callState,
  session,
  isMuted,
  acceptIncomingCall,
  declineIncomingCall,
  endCall,
  toggleMute,
}: Params) {
  const actionsRef = useRef({ acceptIncomingCall, declineIncomingCall, endCall, toggleMute });
  actionsRef.current = { acceptIncomingCall, declineIncomingCall, endCall, toggleMute };
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const sessionIdRef = useRef(session?.sessionId);
  sessionIdRef.current = session?.sessionId;

  // iOS: CallKit uuid <-> callSessionId, and the pushes we have shown.
  const pushesRef = useRef(new Map<string, { uuid: string; push: IncomingCallPush }>());
  // The call the OS UI is showing (Android notification / CallKit call), if any.
  const nativeCallIdRef = useRef<string | null>(null);
  const answeredNativelyRef = useRef<string | null>(null);
  // Set once the app's call state has picked that call up; until then a not-yet-INCOMING
  // render is the call still being presented, not the call ending.
  const seenLiveRef = useRef<string | null>(null);

  useEffect(() => {
    const dismissNative = (callSessionId: string, reason = IOS_END_REMOTE) => {
      if (Platform.OS === 'android') {
        androidCallNotification?.cancel(callSessionId);
      } else {
        const entry = pushesRef.current.get(callSessionId);
        if (entry) RNCallKeep.reportEndCallWithUUID(entry.uuid, reason);
      }
      if (nativeCallIdRef.current === callSessionId) nativeCallIdRef.current = null;
    };

    /**
     * Present a pushed call in the app (no ringtone: the OS UI is ringing it). Answer skips
     * the ringing check: accept itself fails cleanly (CALL_EXPIRED etc.) and the check
     * would delay picking up by a round trip.
     */
    const present = async (
      push: IncomingCallPush,
      { answering = false, noScreen = false } = {},
    ): Promise<boolean> => {
      if (callService.getPendingSession()?.sessionId === push.callSessionId) {
        // Already set up from the socket: the OS UI now shows it too, so tie them together.
        nativeCallIdRef.current = push.callSessionId;
        return true;
      }
      if (
        !(await isForLoggedInUser(push)) ||
        (!answering && !(await isStillRinging(push.callSessionId)))
      ) {
        dismissNative(push.callSessionId, IOS_END_UNANSWERED);
        return false;
      }
      nativeCallIdRef.current = push.callSessionId;
      return callManager.handleIncomingCall(push, { silent: true, answering, noScreen });
    };

    const answer = async (push: IncomingCallPush) => {
      answeredNativelyRef.current = push.callSessionId;
      if (Platform.OS === 'android') androidCallNotification?.cancel(push.callSessionId);
      if (!(await present(push, { answering: true }))) return;
      await actionsRef.current.acceptIncomingCall();
    };

    const decline = async (push: { callSessionId: string; spaId?: string }) => {
      if (callService.getPendingSession()?.sessionId === push.callSessionId) {
        await actionsRef.current.declineIncomingCall();
      } else {
        await declinePushedCall(push);
      }
      dismissNative(push.callSessionId);
    };

    const subscriptions: Array<{ remove(): void }> = [];

    if (Platform.OS === 'ios') {
      const byUuid = (uuid: string) =>
        [...pushesRef.current.values()].find(entry => entry.uuid === uuid.toLowerCase());

      const onDisplayed = (callUUID: string, payload: unknown) => {
        const push = asIncomingCallPush(payload as Record<string, unknown>);
        if (!push) return;
        pushesRef.current.set(push.callSessionId, { uuid: callUUID.toLowerCase(), push });
        callKitShown.add(push.callSessionId);
        if (
          BUSY.has(callStateRef.current) &&
          callService.getPendingSession()?.sessionId !== push.callSessionId
        ) {
          // On a call already: Apple makes every VoIP push show, so end it at once and
          // let the app reject it as busy.
          RNCallKeep.reportEndCallWithUUID(callUUID, IOS_END_ANSWERED_ELSEWHERE);
          isForLoggedInUser(push).then(ok => ok && callManager.handleIncomingCall(push));
          return;
        }
        if (AppState.currentState === 'active') {
          const id = push.callSessionId;
          if (
            callService.getPendingSession()?.sessionId === id &&
            callStateRef.current === CallState.INCOMING &&
            nativeCallIdRef.current !== id
          ) {
            // The VoIP push came too late: the in-app screen is already ringing it.
            RNCallKeep.reportEndCallWithUUID(callUUID, IOS_END_ANSWERED_ELSEWHERE);
            return;
          }
          // App open: the CallKit banner is the ringing UI (like a phone call); the app
          // sets the call up quietly underneath, with no screen and no ringtone.
          present(push, { noScreen: true }).catch(e => callConsole.warn('[NativeCallUi] present failed', e));
          return;
        }
        present(push).catch(e => callConsole.warn('[NativeCallUi] present failed', e));
      };
      const onAnswer = (callUUID: string) => {
        const entry = byUuid(callUUID);
        if (entry) answer(entry.push).catch(e => callConsole.warn('[NativeCallUi] answer failed', e));
      };
      const onEnd = (callUUID: string) => {
        const entry = byUuid(callUUID);
        if (!entry) return;
        const id = entry.push.callSessionId;
        const pending = callService.getPendingSession()?.sessionId === id;
        if (pending && callStateRef.current === CallState.INCOMING) {
          actionsRef.current.declineIncomingCall();
        } else if (nativeCallIdRef.current === id && RINGING_OR_LIVE.has(callStateRef.current)) {
          // Hung up from the CallKit / lock-screen UI.
          actionsRef.current.endCall();
        } else if (!pending && callStateRef.current === CallState.IDLE) {
          declinePushedCall(entry.push);
        }
        if (nativeCallIdRef.current === id) nativeCallIdRef.current = null;
      };

      RNCallKeep.addEventListener('didDisplayIncomingCall', e => onDisplayed(e.callUUID, e.payload));
      RNCallKeep.addEventListener('answerCall', e => onAnswer(e.callUUID));
      RNCallKeep.addEventListener('endCall', e => onEnd(e.callUUID));
      // Mute on the CallKit / lock-screen call screen mutes the app's call.
      RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ muted, callUUID }) => {
        const entry = byUuid(callUUID);
        if (!entry || nativeCallIdRef.current !== entry.push.callSessionId) return;
        if (muted !== isMutedRef.current) actionsRef.current.toggleMute();
      });

      // Events CallKit fired before JS loaded (app launched by the VoIP push).
      RNCallKeep.getInitialEvents().then(events => {
        RNCallKeep.clearInitialEvents();
        for (const event of events) {
          const data: any = event.data;
          if (event.name === 'RNCallKeepDidDisplayIncomingCall') onDisplayed(data.callUUID, data.payload);
          else if (event.name === 'RNCallKeepPerformAnswerCallAction') onAnswer(data.callUUID);
          else if (event.name === 'RNCallKeepPerformEndCallAction') onEnd(data.callUUID);
        }
      });

      VoipPushNotification.addEventListener('register', token => {
        deviceRegistration.setVoipToken(token);
      });
      VoipPushNotification.addEventListener('didLoadWithEvents', events => {
        for (const event of events || []) {
          if (event.name === VoipPushNotification.RNVoipPushRemoteNotificationsRegisteredEvent) {
            deviceRegistration.setVoipToken(event.data as string);
          }
        }
      });
      VoipPushNotification.registerVoipToken();

      subscriptions.push({
        remove() {
          RNCallKeep.removeEventListener('didDisplayIncomingCall');
          RNCallKeep.removeEventListener('answerCall');
          RNCallKeep.removeEventListener('endCall');
          RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
          VoipPushNotification.removeEventListener('register');
          VoipPushNotification.removeEventListener('didLoadWithEvents');
        },
      });
    } else if (androidCallNotification) {
      const notification = androidCallNotification;
      const takeLaunchAction = async () => {
        const launch = await notification.getLaunchAction();
        const push = asIncomingCallPush(launch?.data);
        if (!launch || !push) return;
        if (launch.action === 'answer') {
          await answer(push);
        } else {
          // Opened from the notification: show the in-app IncomingCall screen, ringing.
          notification.cancel(push.callSessionId);
          if (await present(push)) ringtoneService.playIncoming().catch(() => undefined);
        }
      };

      takeLaunchAction().catch(e => callConsole.warn('[NativeCallUi] launch action failed', e));
      // Later than launch, so it never lands on top of the system notification prompt.
      const askTimer = setTimeout(
        () => askForCallPermissions(notification).catch(() => undefined),
        ASK_DELAY_MS,
      );
      subscriptions.push({ remove: () => clearTimeout(askTimer) });
      subscriptions.push(
        DeviceEventEmitter.addListener('TookaCallAction', (event: { action: string; data: any }) => {
          if (event.action === 'decline') {
            decline(event.data).catch(() => undefined);
          } else {
            takeLaunchAction().catch(e => callConsole.warn('[NativeCallUi] launch action failed', e));
          }
        }),
      );

      // Coming back to the app while a call rings: the in-app screen takes over from the
      // notification, whichever way the call came in (push or socket).
      subscriptions.push(
        AppState.addEventListener('change', next => {
          if (next !== 'active') return;
          const id =
            nativeCallIdRef.current ??
            (callStateRef.current === CallState.INCOMING ? sessionIdRef.current : null);
          if (!id) return;
          notification.cancel(id);
          // Give an Answer tap that brought the app forward time to start accepting.
          setTimeout(() => {
            if (callStateRef.current === CallState.INCOMING && answeredNativelyRef.current !== id) {
              ringtoneService.playIncoming().catch(() => undefined);
            }
          }, 400);
        }),
      );
    }

    // Call pushes that arrive while the app is open (FCM; Android, and iOS fallback).
    const unsubscribeMessages = messaging().onMessage(async message => {
      const ended = asCallEndedPush(message?.data);
      if (ended) {
        dismissNative(ended.callSessionId);
        // App open: the call is ringing in the app too, so take that down as well. Not
        // while this phone is answering it (accept in progress / already connecting).
        if (callStateRef.current === CallState.INCOMING && !callManager.isAcceptInProgress()) {
          callManager.handleRemoteEndOrCancel(ended.callSessionId, `fcm_${ended.reason ?? 'ended'}`);
        }
        return;
      }
      const push = asIncomingCallPush(message?.data);
      if (!push || !(await isForLoggedInUser(push))) return;
      if (shouldDeferToCallKit()) {
        deferToCallKit(push.callSessionId, () => callManager.handleIncomingCall(push));
        return;
      }
      callManager.handleIncomingCall(push);
    });

    return () => {
      subscriptions.forEach(s => s.remove());
      unsubscribeMessages();
    };
  }, []);

  // Android: whichever way a call came in (push, socket, FCM), its ringing notification
  // and native ringing screen go as soon as it stops ringing in the app - answered,
  // declined, cancelled or missed. Otherwise the notification rang on through the call.
  const ringingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const id = session?.sessionId ?? null;
    if (callState === CallState.INCOMING && id) {
      ringingIdRef.current = id;
      return;
    }
    if (ringingIdRef.current) {
      androidCallNotification?.cancel(ringingIdRef.current);
      ringingIdRef.current = null;
    }
  }, [callState, session]);

  // iOS: the app's mute shows on the CallKit call screen too.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const id = nativeCallIdRef.current;
    const entry = id ? pushesRef.current.get(id) : undefined;
    if (entry && RINGING_OR_LIVE.has(callState)) RNCallKeep.setMutedCall(entry.uuid, isMuted);
  }, [isMuted, callState]);

  // Android: on a call, a second pushed call does not ring natively over it.
  useEffect(() => {
    if (Platform.OS === 'android') androidCallNotification?.setInCall(BUSY.has(callState));
  }, [callState]);

  // Android: answering lets Tooka show over the lock screen; once the call is over the
  // app must go back behind the lock screen, or anyone could use it on a locked phone.
  const wasInCallRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (RINGING_OR_LIVE.has(callState)) {
      wasInCallRef.current = true;
      return;
    }
    if (!wasInCallRef.current) return;
    wasInCallRef.current = false;
    androidCallNotification?.releaseLockScreen();
  }, [callState]);

  // When the call stops ringing or ends in the app, take the OS call UI down with it.
  useEffect(() => {
    const id = nativeCallIdRef.current;
    if (!id) return;
    const current = session?.sessionId;
    const stillThisCall = current === id && RINGING_OR_LIVE.has(callState);
    if (stillThisCall) {
      seenLiveRef.current = id;
      // Accepted in the app rather than on the CallKit/notification UI: stop that ringing.
      if (callState !== CallState.INCOMING && answeredNativelyRef.current !== id) {
        if (Platform.OS === 'android') androidCallNotification?.cancel(id);
        else {
          const entry = pushesRef.current.get(id);
          if (entry) RNCallKeep.reportEndCallWithUUID(entry.uuid, IOS_END_ANSWERED_ELSEWHERE);
        }
        nativeCallIdRef.current = null;
      }
      return;
    }
    if (seenLiveRef.current !== id) return;
    if (Platform.OS === 'android') androidCallNotification?.cancel(id);
    else {
      const entry = pushesRef.current.get(id);
      // A call that rang out is "unanswered" (iOS counts it as missed); remote-ended is
      // for a call that was answered and then finished.
      if (entry) {
        RNCallKeep.reportEndCallWithUUID(
          entry.uuid,
          callState === CallState.MISSED ? IOS_END_UNANSWERED : IOS_END_REMOTE,
        );
      }
      pushesRef.current.delete(id);
    }
    nativeCallIdRef.current = null;
    answeredNativelyRef.current = null;
    seenLiveRef.current = null;
  }, [callState, session]);
}

const ASK_DELAY_MS = 10_000;
const ASK_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;
const NOTIFICATIONS_ASKED_KEY = 'tooka_call_notifications_asked_at';
const FULL_SCREEN_ASKED_KEY = 'tooka_full_screen_call_asked_at';
const BACKGROUND_ASKED_KEY = 'tooka_background_calls_asked_at';
const ASK_BACKGROUND_AGAIN_MS = 30 * 24 * 60 * 60 * 1000;
// Makers whose phones stop apps from starting in the background after they are swiped
// away, unless the user allows it - so calls would not ring.
const STRICT_BACKGROUND_MAKERS = /xiaomi|redmi|poco|oppo|realme|oneplus|vivo|iqoo|huawei|honor|meizu|asus|tecno|infinix/i;

/** At most once a week per key, so the user is reminded but not nagged. */
async function dueToAsk(key: string, every = ASK_AGAIN_MS): Promise<boolean> {
  const last = Number(await AsyncStorage.getItem(key));
  if (last && Date.now() - last < every) return false;
  await AsyncStorage.setItem(key, String(Date.now()));
  return true;
}

/**
 * Android: calls only ring if notifications are allowed (Android 13+), and only show
 * full screen on a locked phone if that is allowed too (Android 14+). Asks the
 * logged-in user to turn on whichever is off, at most once a week each.
 */
async function askForCallPermissions(notification: NonNullable<typeof androidCallNotification>) {
  if (!(await isForLoggedInUser({}))) return;
  if (Number(Platform.Version) >= 33) {
    const allowed = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (!allowed) {
      if (await dueToAsk(NOTIFICATIONS_ASKED_KEY)) {
        Alert.alert(
          'Spa calls cannot ring',
          'Notifications are off for Tooka, so you will miss calls from your spa. Turn them on in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
      return;
    }
  }
  if (!(await notification.canUseFullScreenIntent())) {
    if (await dueToAsk(FULL_SCREEN_ASKED_KEY)) askFullScreen(notification);
    return;
  }
  const maker = String((Platform.constants as { Manufacturer?: string }).Manufacturer ?? '');
  if (!STRICT_BACKGROUND_MAKERS.test(maker)) return;
  if (await notification.isIgnoringBatteryOptimizations()) return;
  if (!(await dueToAsk(BACKGROUND_ASKED_KEY, ASK_BACKGROUND_AGAIN_MS))) return;
  Alert.alert(
    'Let spa calls reach you',
    'Your phone can stop Tooka from starting in the background, so calls may not ring after you close the app. Allow Tooka to auto-start or run in the background.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => notification.openBackgroundSettings() },
    ],
  );
}

function askFullScreen(notification: NonNullable<typeof androidCallNotification>) {
  Alert.alert(
    'Show spa calls on your lock screen',
    'Allow Tooka to show incoming calls full screen, so you can answer a spa even when your phone is locked.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Allow', onPress: () => notification.openFullScreenIntentSettings() },
    ],
  );
}
