import { useEffect, useRef } from 'react';
import { Alert, AppState, DeviceEventEmitter, Platform } from 'react-native';
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
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  endCall: () => Promise<void>;
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

export function useNativeCallUi({ callState, session, acceptIncomingCall, declineIncomingCall, endCall }: Params) {
  const actionsRef = useRef({ acceptIncomingCall, declineIncomingCall, endCall });
  actionsRef.current = { acceptIncomingCall, declineIncomingCall, endCall };
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
      askForFullScreenCalls(notification).catch(() => undefined);
      subscriptions.push(
        DeviceEventEmitter.addListener('TookaCallAction', (event: { action: string; data: any }) => {
          if (event.action === 'decline') {
            decline(event.data).catch(() => undefined);
          } else {
            takeLaunchAction().catch(e => callConsole.warn('[NativeCallUi] launch action failed', e));
      askForFullScreenCalls(notification).catch(() => undefined);
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
      if (entry) RNCallKeep.reportEndCallWithUUID(entry.uuid, IOS_END_REMOTE);
      pushesRef.current.delete(id);
    }
    nativeCallIdRef.current = null;
    answeredNativelyRef.current = null;
    seenLiveRef.current = null;
  }, [callState, session]);
}

const FULL_SCREEN_ASKED_KEY = 'tooka_full_screen_call_asked';

/**
 * Android 14+ blocks full-screen call screens until the user allows them for Tooka;
 * without it a call on a locked phone is only a notification. Asked once per install.
 */
async function askForFullScreenCalls(notification: NonNullable<typeof androidCallNotification>) {
  if (await notification.canUseFullScreenIntent()) return;
  // Only someone who can receive calls (logged in) is asked.
  if (!(await isForLoggedInUser({}))) return;
  if (await AsyncStorage.getItem(FULL_SCREEN_ASKED_KEY)) return;
  await AsyncStorage.setItem(FULL_SCREEN_ASKED_KEY, '1');
  Alert.alert(
    'Show spa calls on your lock screen',
    'Allow Tooka to show incoming calls full screen, so you can answer a spa even when your phone is locked.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Allow', onPress: () => notification.openFullScreenIntentSettings() },
    ],
  );
}
