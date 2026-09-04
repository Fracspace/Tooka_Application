import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { CallState, CallSession } from '../types/call';

const AUDIO_ROUTE = {
  HEADSET: 0,
  EARPIECE: 1,
  HEADPHONES: 2,
  SPEAKER: 3,
  LOUDSPEAKER: 4,
  BLUETOOTH: 5,
} as const;
import { socketService } from '../services/call/socketService';
import { callService, extractApiErrorMessage } from '../services/call/callService';
import { agoraService } from '../services/call/agoraService';
import { callManager } from '../services/call/callManager';
import { ringtoneService } from '../services/call/ringtoneService';
import { AGORA_CONFIG } from '../config/agora';
import { callLogger, ENABLE_CALL_DIAGNOSTICS } from '../services/call/callLogger';

interface CallContextType {
  callState: CallState;
  session: CallSession | null;
  isMuted: boolean;
  isSpeaker: boolean;
  duration: number;
  initiateCall: (request: import('../types/call').CallRequest) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  cancelCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  setCallState: (state: CallState) => void;
  errorMessage: string | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

// Define allowed transitions for strict state machine
const ALLOWED_TRANSITIONS: Record<CallState, CallState[]> = {
  [CallState.IDLE]: [CallState.OUTGOING, CallState.INCOMING],
  [CallState.OUTGOING]: [CallState.RINGING, CallState.CONNECTING, CallState.ENDED, CallState.FAILED, CallState.REJECTED],
  [CallState.INCOMING]: [CallState.CONNECTING, CallState.ENDED, CallState.REJECTED],
  [CallState.RINGING]: [CallState.CONNECTING, CallState.ENDED, CallState.REJECTED],
  [CallState.CONNECTING]: [CallState.CONNECTED, CallState.FAILED, CallState.ENDED],
  [CallState.CONNECTED]: [CallState.RECONNECTING, CallState.ENDED, CallState.FAILED],
  [CallState.RECONNECTING]: [CallState.CONNECTED, CallState.FAILED, CallState.ENDED],
  [CallState.FAILED]: [CallState.IDLE],
  [CallState.REJECTED]: [CallState.IDLE],
  [CallState.ENDED]: [CallState.IDLE],
  [CallState.MISSED]: [CallState.IDLE],
  [CallState.NO_ANSWER]: [CallState.IDLE],
};

const printCallSummary = (session: CallSession | null, durationSeconds: number, reason: string) => {
  const sessionId = session?.sessionId || 'global';
  const audioSnapshot = callLogger.getAudioSnapshot(sessionId);
  const timeline = callLogger.getTimeline(sessionId);

  const summary = `
==================================================
                 CALL SUMMARY
==================================================
Session:          ${sessionId}
Channel:          ${session?.channelName || 'N/A'}
Local UID:        ${session?.uid || 0}
Remote UID:       ${session?.agoraUidUser === session?.uid ? session?.agoraUidSpa : session?.agoraUidUser}
Call Direction:   ${session?.direction || 'N/A'}
Duration:         ${durationSeconds} seconds
Reason Ended:     ${reason}

AUDIO STATES:
Mic Muted:        ${audioSnapshot.micMuted ? 'Yes' : 'No'}
Speaker Enabled:  ${audioSnapshot.speakerEnabled ? 'Yes' : 'No'}
Audio Route:      ${audioSnapshot.audioRoute}
Publish State:    ${audioSnapshot.publishState}
Subscribe State:  ${audioSnapshot.subscribeState}
Local State:      ${audioSnapshot.localAudioState}
Remote State:     ${audioSnapshot.remoteAudioState}

NETWORK QUALITY:
Tx Quality:       ${audioSnapshot.networkQualityTx}
Rx Quality:       ${audioSnapshot.networkQualityRx}

Remote Joined:    ${audioSnapshot.remoteJoined ? 'Yes' : 'No'}

ORDERED TIMELINE:
${timeline.map((event: string, idx: number) => `  ${idx + 1}. ${event}`).join('\n')}
==================================================
`;
  callLogger.info('SUMMARY', summary, { sessionId });
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callState, setCallStateInternal] = useState<CallState>(CallState.IDLE);
  const [session, setSession] = useState<CallSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionRef = useRef(session);
  const callStateRef = useRef(callState);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(duration);
  const outgoingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endCallRef = useRef<(() => Promise<void>) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const previousAudioRouteRef = useRef<number | null>(null);
  const isFocusLostRef = useRef<boolean>(false);
  const isCleaningUpRef = useRef<boolean>(false);

  useEffect(() => {
    sessionRef.current = session;
    callStateRef.current = callState;
    durationRef.current = duration;
  }, [session, callState, duration]);

  // Deterministic state machine transition
  const setCallState = useCallback((nextState: CallState) => {
    const currentState = callStateRef.current;

    // Self-transitions are ignored safely
    if (currentState === nextState) return;

    const allowed = ALLOWED_TRANSITIONS[currentState] || [];
    if (allowed.includes(nextState)) {
      const startTime = Date.now();
      callLogger.setCallState(nextState);

      const ctx = {
        sessionId: sessionRef.current?.sessionId || 'NO_SESSION',
        callState: nextState,
        channelName: sessionRef.current?.channelName || 'N/A',
        uid: sessionRef.current?.uid || 0
      };

      callLogger.info('STATE', `Transition: ${currentState} -> ${nextState}`, ctx);
      callStateRef.current = nextState; // Synchronously update ref to prevent stale state in fast transitions
      setCallStateInternal(nextState);

      const duration = Date.now() - startTime;
      callLogger.info('STATE', `Transition completed. Duration: ${duration}ms`, ctx);
    } else {
      const ctx = {
        sessionId: sessionRef.current?.sessionId || 'NO_SESSION',
        callState: currentState,
        channelName: sessionRef.current?.channelName || 'N/A',
        uid: sessionRef.current?.uid || 0
      };
      callLogger.warn('STATE', `Invalid transition attempt: ${currentState} -> ${nextState}. Ignored.`, ctx);
      console.warn(`[CallContext] Invalid transition attempt: ${currentState} -> ${nextState}. Ignored.`);
    }
  }, []);

  // Initialize Agora Engine on startup
  useEffect(() => {
    const initAgora = async () => {
      try {
        callService.clearSessions();
        await agoraService.initialize(AGORA_CONFIG.appId);

        console.log("[CallContext] Agora initialized");
      } catch (e) {
        console.error(e);
      }
    };

    initAgora();

    return () => {
      agoraService.release().catch(console.error);
    };
  }, []);

  // Duration Timer Management
  useEffect(() => {
    if (callState === CallState.CONNECTED) {
      if (!durationTimerRef.current) {
        durationTimerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (callState === CallState.IDLE) {
        setDuration(0);
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [callState]);

  // Handle ringtone playback based on callState lifecycle
  useEffect(() => {
    if (callState === CallState.OUTGOING || callState === CallState.RINGING) {
      ringtoneService.playOutgoing().catch((err) => {
        console.error('[CALL_AUDIO] Failed to play outgoing ringtone:', err);
      });
    } else if (callState === CallState.INCOMING) {
      ringtoneService.playIncoming().catch((err) => {
        console.error('[CALL_AUDIO] Failed to play incoming ringtone:', err);
      });
    } else {
      ringtoneService.stop();
    }
  }, [callState]);

  const cleanupAndResetCall = useCallback(async (reason: string = 'unknown') => {
    if (isCleaningUpRef.current) return;

    // PR-2a: nothing left to tear down. Now that PR-1 releases the latch, several
    // independent paths each run a full cleanup for the same call (cancelCall's
    // finally, the echoed call_cancel handler, the outgoing timeout). They are harmless
    // no-ops but each printed an empty CALL SUMMARY - three per cancelled call.
    const hasSession =
      !!sessionRef.current ||
      !!callService.getPendingSession() ||
      !!callService.getConnectingSession() ||
      !!callService.getActiveSession();
    if (!hasSession && callStateRef.current === CallState.IDLE) {
      return;
    }

    isCleaningUpRef.current = true;

    try {
      console.log('[CALL] Cleaning up call');
      ringtoneService.stop();

      const sessionToSummarize = sessionRef.current;
      const durationToSummarize = durationRef.current;

      await callService.cleanup(reason);

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      previousAudioRouteRef.current = null;
      isFocusLostRef.current = false;

      try {
        printCallSummary(sessionToSummarize, durationToSummarize, reason);
      } catch (e) {
        console.error('[CallContext] Failed to print call summary', e);
      }

      setSession(null);
      setIsMuted(false);
      setIsSpeaker(false);
      setDuration(0);
      // PR-2: errorMessage is deliberately NOT cleared here. Cleanup runs ~2s after a
      // terminal state, so clearing it wiped the explanation off the screen while the
      // user was still looking at it. Every entry point (initiateCall,
      // acceptIncomingCall, handleRinging) clears it when a new call begins.

      // PR-1: null the refs synchronously. They are normally synced by a useEffect
      // that only runs on the NEXT render, so between cleanup and that render the
      // Agora callbacks below still saw a live session. Nulling here is also what
      // keeps those callbacks inert now that the isCleaningUp latch is released.
      sessionRef.current = null;
      durationRef.current = 0;

      // PR-1: cleanup deliberately bypasses setCallState(), which is the only place
      // callStateRef is updated synchronously. Without this line the ref stays on the
      // terminal state (ENDED/REJECTED/FAILED) until the next render, and in that
      // window initiateCall() silently no-ops ("Try Again" does nothing) and
      // callManager.handleIncomingCall() auto-rejects a genuine incoming call as busy.
      callStateRef.current = CallState.IDLE;
      callLogger.setCallState(CallState.IDLE);
      setCallStateInternal(CallState.IDLE); // Force IDLE as reset

      console.log('[CALL] Cleanup completed');
    } finally {
      // PR-1: the latch MUST always be released. It was previously set to true and
      // never cleared, so every cleanup after the first early-returned above: the
      // Agora channel was never left, the mic stayed live, and onUserOffline was
      // swallowed so a remote hangup never ended the call locally.
      isCleaningUpRef.current = false;
    }
  }, []);

  // AppState Listener to track background/foreground transitions & handle stale state recovery
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const current = appStateRef.current;
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (current === 'active') {
          console.log('[APPSTATE]\nBackground');
          appStateRef.current = nextAppState;
        }
      } else if (nextAppState === 'active') {
        if (current === 'background' || current === 'inactive') {
          console.log('[APPSTATE]\nForeground');
          appStateRef.current = 'active';

          const state = callStateRef.current;
          const isCallActiveState =
            state === CallState.CONNECTED ||
            state === CallState.CONNECTING ||
            state === CallState.RECONNECTING ||
            state === CallState.RINGING;

          if (!sessionRef.current && isCallActiveState) {
            console.log('[CALL] Stale call state detected on foreground return');
            cleanupAndResetCall('stale_foreground_session');
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cleanupAndResetCall]);
  useEffect(() => {
    const handleConnectionLostOrReconnecting = () => {
      if (callStateRef.current === CallState.CONNECTED || callStateRef.current === CallState.RECONNECTING) {
        if (callStateRef.current !== CallState.RECONNECTING) {
          console.log('[NETWORK]\nInternet Lost');
          console.log('[CALL]\nWaiting for Agora reconnect');
          setCallState(CallState.RECONNECTING);
        }
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            console.log('[CALL]\nReconnect timeout');
            reconnectTimerRef.current = null;
            setErrorMessage('Call ended due to network issue.');
            if (endCallRef.current) {
              endCallRef.current();
            }
          }, 30000);
        }
      }
    };

    const handleReconnected = () => {
      if (callStateRef.current === CallState.RECONNECTING) {
        console.log('[NETWORK]\nInternet Restored');
        console.log('[CALL]\nAgora reconnected');
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setCallState(CallState.CONNECTED);
      }
    };

    const handlers = {
      // onJoinChannelSuccess is handled directly via Promise in callService.joinPendingSession()
      onLeaveChannel: () => {
        cleanupAndResetCall('agora_leave_channel');
      },
      onUserJoined: (connection: any, remoteUid: number) => {
        if (isCleaningUpRef.current || !sessionRef.current) {
          console.log('[CALL] Ignoring callback for cancelled call');
          return;
        }
        if (callStateRef.current === CallState.CONNECTING || callStateRef.current === CallState.RINGING) {
          setCallState(CallState.CONNECTED);
        }
      },
      onUserOffline: (connection: any, remoteUid: number, reason: number) => {
        const currentState = callStateRef.current;
        if (currentState !== CallState.CONNECTED && currentState !== CallState.RECONNECTING) {
          return;
        }
        if (!sessionRef.current || isCleaningUpRef.current) {
          return;
        }

        console.log('[CALL] Remote participant left');
        setErrorMessage('Other participant left.');
        cleanupAndResetCall('remote_user_offline');
      },
      onConnectionStateChanged: (connection: any, state: number, reason: number) => {
        if (state === 4) {
          handleConnectionLostOrReconnecting();
        } else if (state === 3) {
          handleReconnected();
        } else if (state === 5) {
          setCallState(CallState.FAILED);
          setErrorMessage('Connection failed. Please check your network.');
          setTimeout(() => cleanupAndResetCall('agora_connection_failed'), 2000);
        }
      },
      onConnectionLost: () => {
        handleConnectionLostOrReconnecting();
      },
      onRejoinChannelSuccess: () => {
        handleReconnected();
      },
      onAudioRoutingChanged: (routing: number) => {
        const prev = previousAudioRouteRef.current;
        previousAudioRouteRef.current = routing;

        if (prev !== null && prev !== routing) {
          const isBluetooth = (r: number) => r === AUDIO_ROUTE.BLUETOOTH;
          const isHeadset = (r: number) => r === AUDIO_ROUTE.HEADSET || r === AUDIO_ROUTE.HEADPHONES;

          if (isBluetooth(routing) && !isBluetooth(prev)) {
            console.log('Bluetooth Connected');
          } else if (isBluetooth(prev) && !isBluetooth(routing)) {
            console.log('Bluetooth Disconnected');
          }

          if (isHeadset(routing) && !isHeadset(prev)) {
            console.log('Headset Plugged');
          } else if (isHeadset(prev) && !isHeadset(routing)) {
            console.log('Headset Unplugged');
          }
        }
      },
      onLocalAudioStateChanged: (connection: any, state: number, error: number) => {
        if (error === 3 || error === 8) {
          if (!isFocusLostRef.current) {
            isFocusLostRef.current = true;
            console.log('Audio Focus Lost');
          }
        } else if (isFocusLostRef.current && (state === 1 || state === 2)) {
          isFocusLostRef.current = false;
          console.log('Audio Focus Restored');
        }
      },
      onError: (err: number, msg: string) => {
        console.error(`[CallContext] Agora error code: ${err}, msg: ${msg}`);
        let friendlyMsg = 'An unexpected error occurred.';
        if (err === 109) friendlyMsg = 'Token expired. Please rejoin.';
        if (err === 110) friendlyMsg = 'Invalid token.';
        if (err === 17) friendlyMsg = 'Already joined channel.';

        // Log it, but don't force a failure state for 17 since we are already joined
        if (err !== 17) {
          setErrorMessage(friendlyMsg);
        }
      },
      onTokenPrivilegeWillExpire: () => {
        console.warn('[CallContext] Token will expire soon');
      },
    };

    agoraService.addListener(handlers);

    return () => {
      agoraService.removeListener(handlers);
    };
  }, [setCallState, cleanupAndResetCall]);

  // Handle Socket Events.
  // PR-3: the connection lifecycle now belongs to SocketProvider
  // (src/context/SocketContext.tsx). This provider only registers and unregisters
  // listeners. socketService.on() queues them when no socket exists yet and rebinds
  // on every (re)connect, so registration order does not matter.
  useEffect(() => {
    callManager.setContextActions({
      setCallState,
      setSession,
      cleanupAndResetCall,
      getCallState: () => callStateRef.current,
      setErrorMessage,
    });

    // const handleRinging = (payload: any) => {
    //   setErrorMessage(null);
    //   if (payload?.direction === 'inbound') {
    //     callManager.handleIncomingCall(payload);
    //   } else {
    //     setCallState(CallState.RINGING);
    //   }
    // };

    // PR-1: every server -> client call event in the backend contract carries a FLAT
    // `callSessionId` ({ callSessionId } / { callSessionId, token }). The old code
    // only looked for a nested `callSession.id`, which is never present, so the
    // mismatch guard never ran: a stale or replayed event for a finished session
    // could tear down an unrelated live call. Deliberately NOT applied to
    // call_ringing, which by definition announces a session we do not have yet.
    const currentSessionId = (): string | null =>
      callService.getActiveSession()?.sessionId ||
      callService.getConnectingSession()?.sessionId ||
      callService.getPendingSession()?.sessionId ||
      sessionRef.current?.sessionId ||
      null;

    const isForCurrentSession = (payload: any, event: string): boolean => {
      const incomingId =
        payload?.callSessionId ||
        payload?.data?.callSessionId ||
        payload?.callSession?.id ||
        payload?.data?.callSession?.id;

      // No id on the payload: accept rather than risk stranding the user in a call
      // that can never be ended, but make the gap loud.
      if (!incomingId) {
        console.warn(`[Socket] ${event} received with no callSessionId. Accepting.`);
        return true;
      }

      const current = currentSessionId();
      if (!current) {
        console.log(`[Socket] Ignoring ${event} for ${incomingId}: no local session.`);
        return false;
      }
      if (incomingId !== current) {
        console.log(`[Socket] Ignoring ${event} for ${incomingId}: local session is ${current}.`);
        return false;
      }
      return true;
    };

    const handleRinging = (payload: any) => {
      setErrorMessage(null);

      // Check if this ringing event belongs to the outgoing call WE just initiated
      const isMyOutgoingCall =
        callStateRef.current === CallState.OUTGOING ||
        (sessionRef.current?.sessionId && sessionRef.current.sessionId === payload?.callSessionId);

      if (isMyOutgoingCall) {
        // We initiated this call -> transition our UI to RINGING
        setCallState(CallState.RINGING);
      } else {
        // Someone else is calling us -> handle as incoming call
        callManager.handleIncomingCall(payload);
      }
    };


    const handleAnswered = async (payload: any) => {
      if (!isForCurrentSession(payload, 'call_accept')) return;

      // PR-1: the backend emits call_accept to BOTH parties (user:<id> and spa:<id>).
      // On the device that is itself answering, that echo can arrive before the REST
      // /accept response resolves - at which point the state is still INCOMING with a
      // live pendingSession, so the duplicate guards below all pass and this handler
      // races callManager.acceptCall() into a double joinChannel(), with the loser
      // promoting to CONNECTED before the join has actually completed.
      // callManager owns the answering flow; this handler is for the CALLER only.
      if (callStateRef.current === CallState.INCOMING || callManager.isAcceptInProgress()) {
        console.log('[Socket] Ignoring call_accept echo on the answering device.');
        return;
      }

      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }

      // Bug #4: Ignore duplicate call_accept socket event if connecting/active session already exists
      if (
        callStateRef.current === CallState.CONNECTING ||
        callStateRef.current === CallState.CONNECTED ||
        callService.getConnectingSession() ||
        callService.getActiveSession()
      ) {
        console.log('[Socket] Ignoring duplicate call_accept socket event: connecting or active session exists');
        return; // Ignore duplicate socket events
      }

      callService.handleCallAccepted(payload);

      const pending = callService.getPendingSession();
      if (!pending) return;

      callService.movePendingToConnecting();
      setCallState(CallState.CONNECTING);

      try {
        await callService.joinPendingSession();

        if (isCleaningUpRef.current || !sessionRef.current) {
          console.log('[CALL] Ignoring callback for cancelled call');
          return;
        }

        callService.promoteConnectingToActive();
        setCallState(CallState.CONNECTED);
        setSession(callService.getActiveSession());
        setErrorMessage(null);
      } catch (error) {
        if (isCleaningUpRef.current || !sessionRef.current) {
          console.log('[CALL] Ignoring callback for cancelled call');
          return;
        }
        console.error('[CallContext] Failed to join active call via Agora', error);
        setCallState(CallState.FAILED);
        cleanupAndResetCall('agora_join_failed');
      }
    };

    const handleDeclined = (payload: any) => {
      if (!isForCurrentSession(payload, 'call_reject')) return;
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      setCallState(CallState.REJECTED);
      setTimeout(() => cleanupAndResetCall('call_rejected'), 2000);
    };

    const handleCanceled = (payload: any) => {
      if (!isForCurrentSession(payload, 'call_cancel')) return;
      if (callStateRef.current === CallState.INCOMING) {
        callManager.handleRemoteEndOrCancel(payload?.callSessionId || sessionRef.current?.sessionId || '', 'call_canceled');
        return;
      }
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      setCallState(CallState.ENDED);
      setTimeout(() => cleanupAndResetCall('call_canceled'), 2000);
    };

    const handleEnded = (payload: any) => {
      if (!isForCurrentSession(payload, 'call_end')) return;
      if (callStateRef.current === CallState.INCOMING) {
        callManager.handleRemoteEndOrCancel(payload?.callSessionId || sessionRef.current?.sessionId || '', 'call_ended_remotely');
        return;
      }
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      setCallState(CallState.ENDED);
      cleanupAndResetCall('call_ended_remotely');
    };

    // PR-2: the backend emits call_accepted_elsewhere to the devices that did NOT
    // accept. Without this a second device logged into the same account rings forever
    // after the call has been answered somewhere else.
    const handleAcceptedElsewhere = (payload: any) => {
      if (!isForCurrentSession(payload, 'call_accepted_elsewhere')) return;
      console.log('[Socket] Call was accepted on another device.');
      ringtoneService.stop();
      callManager.handleRemoteEndOrCancel(
        payload?.callSessionId || sessionRef.current?.sessionId || '',
        'call_accepted_elsewhere',
      );
    };

    socketService.on('call_ringing', handleRinging);
    socketService.on('call_accept', handleAnswered);
    socketService.on('call_reject', handleDeclined);
    socketService.on('call_cancel', handleCanceled);
    socketService.on('call_end', handleEnded);
    socketService.on('call_accepted_elsewhere', handleAcceptedElsewhere);

    return () => {
      socketService.off('call_ringing', handleRinging);
      socketService.off('call_accept', handleAnswered);
      socketService.off('call_reject', handleDeclined);
      socketService.off('call_cancel', handleCanceled);
      socketService.off('call_end', handleEnded);
      socketService.off('call_accepted_elsewhere', handleAcceptedElsewhere);
      // PR-3: do NOT disconnect here. The socket is shared with other features and
      // is owned by SocketProvider.
    };
  }, [setCallState, cleanupAndResetCall]);

  const initiateCall = useCallback(async (request: import('../types/call').CallRequest) => {
    if (callStateRef.current !== CallState.IDLE) {
      console.log(`[CallContext] initiateCall ignored. Current state is ${callStateRef.current}`);
      return;
    }
    isCleaningUpRef.current = false;
    setErrorMessage(null);
    try {
      setCallState(CallState.OUTGOING);
      const newSession = await callService.initiateCall(request);
      setSession(newSession);

      // Start 60-second timeout
      outgoingTimeoutRef.current = setTimeout(async () => {
        console.warn('[CallContext] Outgoing call timed out after 60 seconds');
        if (callStateRef.current === CallState.OUTGOING || callStateRef.current === CallState.RINGING) {
          setCallState(CallState.ENDED);
          await callService.cancelCall(sessionRef.current!);
          cleanupAndResetCall();
        }
      }, 60000);
    } catch (error) {
      console.error('[CallContext] Failed to initiate call', error);
      // PR-2: the backend sends user-facing copy on rejection. This catch never set
      // errorMessage, so a rejected call showed a bare "Call Failed" with no reason.
      setErrorMessage(extractApiErrorMessage(error, 'Could not start the call. Please try again.'));
      setCallState(CallState.FAILED);
      setTimeout(() => cleanupAndResetCall(), 2000);
    }
  }, [setCallState, cleanupAndResetCall]);

  // PR-2: both surfaces now run the SAME implementation. These used to call
  // callService.answerCall/declineCall - a second, divergent flow that did the REST
  // call and then stopped: it never joined the Agora channel and never set CONNECTED,
  // so answering from CallScreen's INCOMING layout hung in CONNECTING forever.
  // callManager owns answering and rejecting; these are thin wrappers kept so the
  // context API (and CallScreen) does not have to change.
  const acceptIncomingCall = useCallback(async () => {
    if (callStateRef.current !== CallState.INCOMING) return;
    isCleaningUpRef.current = false;
    setErrorMessage(null);
    await callManager.acceptCall();
  }, []);

  const declineIncomingCall = useCallback(async () => {
    if (callStateRef.current !== CallState.INCOMING) return;
    await callManager.rejectCall();
  }, []);

  const cancelCall = useCallback(async () => {
    if (!sessionRef.current || (callStateRef.current !== CallState.OUTGOING && callStateRef.current !== CallState.RINGING)) return;
    try {
      setCallState(CallState.ENDED);
      await callService.cancelCall(sessionRef.current);
    } catch (error) {
      console.error('[CallContext] Error canceling call', error);
    } finally {
      setTimeout(() => cleanupAndResetCall(), 2000);
    }
  }, [setCallState, cleanupAndResetCall]);

  const endCall = useCallback(async () => {
    if (callStateRef.current === CallState.IDLE || callStateRef.current === CallState.ENDED) return;
    try {
      if (callStateRef.current === CallState.OUTGOING || callStateRef.current === CallState.RINGING) {
        // If the call hasn't been answered, it's a cancel action.
        await cancelCall();
        return;
      }
      if (callStateRef.current === CallState.CONNECTING) {
        console.log('[CALL] User cancelled during connecting');
      }
      setCallState(CallState.ENDED);
      await callService.endCall(sessionRef.current, durationRef.current || 0);
    } catch (error) {
      console.error('[CallContext] Error ending call', error);
    } finally {
      setTimeout(() => cleanupAndResetCall(), 2000);
    }
  }, [setCallState, cleanupAndResetCall, cancelCall]);

  endCallRef.current = endCall;

  const toggleMute = useCallback(() => {
    console.log(
      "[UI] Toggle mute",
      isMuted
    );
    const nextMute = !isMuted;
    callService.toggleMute(nextMute).catch(console.error);
    setIsMuted(nextMute);
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    const nextSpeaker = !isSpeaker;
    callService.toggleSpeaker(nextSpeaker).catch(console.error);
    setIsSpeaker(nextSpeaker);
  }, [isSpeaker]);

  return (
    <CallContext.Provider
      value={{
        callState,
        session,
        isMuted,
        isSpeaker,
        duration,
        initiateCall,
        acceptIncomingCall,
        declineIncomingCall,
        cancelCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        setCallState,
        errorMessage,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};
