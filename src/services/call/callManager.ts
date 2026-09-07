import { CallSession, CallState } from '../../types/call';
import { callService, callActionBody, extractApiErrorMessage } from './callService';
import SpaApi from '../../api/SpaApi';
import {
  ensureMicrophonePermission,
  promptForMicrophoneSettings,
} from '../../utils/microphonePermission';
import { ringtoneService } from './ringtoneService';
import authAxiosClient from '../../api/authAxiosClient';
import { navigationRef } from '../../navigation/NavigationService';
import { StackActions } from '@react-navigation/native';

export interface CallContextActions {
  setCallState: (state: CallState) => void;
  setSession: (session: CallSession | null) => void;
  cleanupAndResetCall: (reason?: string) => void;
  getCallState: () => CallState;
  // PR-2: lets this flow surface the backend's user-facing rejection copy instead of
  // leaving the screen on a bare "Call Failed".
  setErrorMessage: (message: string | null) => void;
}

const getLogContext = (): any => {
  try {
    const { callLogger } = require('./callLogger');
    const pending = callService.getPendingSession();
    const connecting = callService.getConnectingSession();
    const active = callService.getActiveSession();
    const session = active || connecting || pending;
    return {
      sessionId: session?.sessionId || 'NO_SESSION',
      callState: callLogger.getCallState(),
      channelName: session?.channelName || 'N/A',
      uid: session?.uid || 0
    };
  } catch (e) {
    return { sessionId: 'NO_SESSION', callState: 'UNKNOWN' };
  }
};

class CallManager {
  private contextActions: CallContextActions | null = null;
  private isAccepting = false;
  private isRejecting = false;

  setContextActions(actions: CallContextActions) {
    this.contextActions = actions;
  }

  // PR-1: lets CallContext detect that this device is mid-accept, so it can ignore
  // the call_accept echo the backend sends to both parties instead of racing this
  // flow into a second joinChannel(). Covers the REST window before the state has
  // moved off INCOMING.
  isAcceptInProgress(): boolean {
    return this.isAccepting;
  }

  async handleIncomingCall(payload: any): Promise<boolean> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('CALL', 'ENTER: handleIncomingCall', ctx, { payload });

    if (!this.contextActions) {
      const duration = Date.now() - startTime;
      callLogger.warn('CALL', `handleIncomingCall failed: contextActions not set. Duration: ${duration}ms`, ctx);
      return false;
    }

    // PR-2: validate before anything else. A call_ringing with no callSessionId used to
    // build a session with `sessionId: undefined` - breaking every later id match - and
    // on the busy path below it POSTed to /chat/calls/undefined/reject.
    if (!payload?.callSessionId) {
      console.error('[IncomingCall] Ignoring call_ringing with no callSessionId', payload);
      callLogger.error('CALL', 'EXIT: handleIncomingCall - invalid payload (no callSessionId)', ctx, { payload });
      return false;
    }

    // PR-4: defence in depth. The backend broadcasts call_ringing to the caller too,
    // so without this an echo of our OWN outgoing call reached the busy branch below
    // and auto-rejected it - killing the user's call while the spa kept ringing.
    if (
      callService.isOwnCallSession(payload?.callSessionId) ||
      callService.matchesOutgoingIntent(payload?.channel)
    ) {
      callLogger.info('CALL', 'EXIT: handleIncomingCall - IGNORED (ringing echo for our own outgoing call).', ctx, { payload });
      return false;
    }

    const currentState = this.contextActions.getCallState();
    if (currentState !== CallState.IDLE) {
      console.log(`[IncomingCall] Duplicate or conflicting call received while in state: ${currentState}. Ignoring/Rejecting.`);
      callLogger.warn('CALL', `Duplicate or conflicting call received while in state: ${currentState}. Auto-rejecting.`, ctx, { payload });
      
      // Auto-reject incoming call if we are already in another call
      try {
        const restStart = Date.now();
        await authAxiosClient.post(
          `/chat/calls/${payload.callSessionId}/reject`,
          callActionBody({ sessionId: payload.callSessionId, spaId: payload.spaId }),
        );
        callLogger.info('REST', `Auto-rejected conflicting call session: ${payload.callSessionId}. Duration: ${Date.now() - restStart}ms`, ctx);
      } catch (e) {
        console.error('[IncomingCall] Failed to auto-reject conflicting call', e);
        callLogger.error('REST', `Failed to auto-reject conflicting call session: ${payload.callSessionId}`, ctx, e);
      }
      const duration = Date.now() - startTime;
      callLogger.info('CALL', `EXIT: handleIncomingCall - REJECTED (busy). Duration: ${duration}ms`, ctx);
      return false;
    }

    const session: CallSession = {
      sessionId: payload.callSessionId,
      channelName: payload.channel,
      token: '',
      uid: 0,
      status: 'ringing',
      bookingId: '',
      spaId: '',
      conversationId: '',
      // PR-5: pinned app-centric, not payload.direction (which is spa-centric). This
      // is what tells CallScreen and ActiveCallBar that the caller is the remote party.
      direction: 'inbound',
      callType: payload.callType,
      agoraUidUser: 0,
      agoraUidSpa: 0,
      caller: {
        id: '',
        name: payload.callerName || 'Unknown Caller',
        role: 'caller',
      },
      receiver: {
        id: '',
        name: 'Me',
        role: 'receiver',
      },
      createdAt: new Date().toISOString(),
    };

    console.log(`[IncomingCall] Received ringing, starting ringtone`);
    
    callService.createPendingSession(session);
    this.contextActions.setSession(session);
    
    const stateStart = Date.now();
    this.contextActions.setCallState(CallState.INCOMING);
    callLogger.info('STATE', `Transition state set to INCOMING. Duration: ${Date.now() - stateStart}ms`, ctx);
    
    const ringtoneStart = Date.now();
    ringtoneService.playIncoming().then(() => {
      callLogger.info('AUDIO', `Ringtone playback started successfully. Duration to trigger: ${Date.now() - ringtoneStart}ms`, ctx);
    }).catch(e => {
      callLogger.error('AUDIO', 'Ringtone playback failed', ctx, e);
    });

    console.log(`[Navigation] Showing IncomingCallScreen globally`);
    const navStart = Date.now();
    if (navigationRef.isReady()) {
      // @ts-ignore
      navigationRef.navigate('IncomingCall');
      callLogger.info('NAVIGATION', `Navigated to IncomingCallScreen. Duration: ${Date.now() - navStart}ms`, ctx);
    } else {
      callLogger.warn('NAVIGATION', `navigationRef not ready. Bypassed IncomingCallScreen navigation.`, ctx);
    }

    // PR-2: fill in what call_ringing does not carry (booking_id, spa_id,
    // conversation_id, agora uids). Fire-and-forget - the ringing UI is already up and
    // must never wait on this.
    this.hydrateIncomingSession(session.sessionId).catch((e) => {
      callLogger.warn('SESSION', 'hydrateIncomingSession threw', ctx, e);
    });

    const duration = Date.now() - startTime;
    callLogger.info('CALL', `EXIT: handleIncomingCall - SUCCESS. Duration: ${duration}ms`, ctx);
    return true;
  }

  // PR-2: see fetchSessionDetails in callService for why this exists.
  private async hydrateIncomingSession(sessionId: string): Promise<void> {
    const { callLogger } = require('./callLogger');
    const details = await callService.fetchSessionDetails(sessionId);
    if (!details) return;

    const pending = callService.getPendingSession();
    // The user may have accepted or rejected, or the caller may have cancelled, while
    // this request was in flight. Only merge if the same session is still pending.
    if (!pending || pending.sessionId !== sessionId) {
      callLogger.info('SESSION', `hydrateIncomingSession skipped: ${sessionId} is no longer the pending session`, getLogContext());
      return;
    }

    if (details.booking_id) pending.bookingId = details.booking_id;
    if (details.spa_id) pending.spaId = details.spa_id;
    if (details.conversation_id) pending.conversationId = details.conversation_id;
    if (details.call_type) pending.callType = details.call_type;
    // PR-5: direction is ours (app-centric) - see callService.initiateCall.
    if (details.status) pending.status = details.status;
    if (details.agora_uid_user !== undefined) pending.agoraUidUser = details.agora_uid_user;
    if (details.agora_uid_spa !== undefined) pending.agoraUidSpa = details.agora_uid_spa;
    if (details.spa_id) pending.caller.id = details.spa_id;
    if (details.user_id) pending.receiver.id = details.user_id;

    callLogger.info('SESSION', `Incoming session hydrated from GET /chat/calls/${sessionId}`, getLogContext(), pending);
    // New object so React re-renders with the filled-in fields.
    this.contextActions?.setSession({ ...pending });

    // PR-5: `call_ringing` sends callerName: "Spa Owner" - a ROLE, not the spa. The
    // user needs to know WHICH spa is calling, and neither call_ringing nor
    // GET /chat/calls/{id} carries the spa's name, so resolve it from spa_id.
    if (details.spa_id) {
      await this.resolveSpaIdentity(sessionId, details.spa_id);
    }
  }

  private async resolveSpaIdentity(sessionId: string, spaId: string): Promise<void> {
    const { callLogger } = require('./callLogger');
    try {
      const spa = await SpaApi.getSpaDetails(spaId);
      if (!spa?.name) return;

      const pending = callService.getPendingSession() || callService.getActiveSession();
      if (!pending || pending.sessionId !== sessionId) return;

      pending.caller.name = spa.name;
      pending.caller.avatarUrl = spa.cover_photo_url || pending.caller.avatarUrl || '';

      callLogger.info('SESSION', `Resolved calling spa: ${spa.name}`, getLogContext());
      this.contextActions?.setSession({ ...pending });
    } catch (e) {
      // Non-fatal - the call still works, the header just keeps its fallback name.
      callLogger.warn('SESSION', `Could not resolve spa ${spaId} for the incoming call`, getLogContext(), e);
    }
  }

  async acceptCall(): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('CALL', 'ENTER: acceptCall', ctx);

    if (this.isAccepting || !this.contextActions) {
      console.log('[IncomingCall] Accept already in progress, ignoring duplicate tap.');
      const duration = Date.now() - startTime;
      callLogger.warn('CALL', `Accept already in progress, ignoring duplicate tap. Duration: ${duration}ms`, ctx);
      return;
    }
    this.isAccepting = true;

    console.log('[IncomingCall] Accept pressed');
    const ringtoneStopStart = Date.now();
    ringtoneService.stop();
    callLogger.info('AUDIO', `Ringtone stopped. Duration: ${Date.now() - ringtoneStopStart}ms`, ctx);

    const pending = callService.getPendingSession();
    if (!pending) {
      console.error('[IncomingCall] No pending session to accept');
      callLogger.error('CALL', 'No pending session found to accept', ctx);
      this.isAccepting = false;
      const duration = Date.now() - startTime;
      callLogger.info('CALL', `EXIT: acceptCall - FAILURE (no pending session). Duration: ${duration}ms`, ctx);
      return;
    }

    try {
      // PR-7: Step 0 - the microphone. Answering used to go straight to joinChannel
      // with no permission check at all (only the OUTGOING path checked, in
      // CallScreen), so a user who had denied it joined fine and was simply
      // inaudible, with nothing on screen explaining why.
      const permission = await ensureMicrophonePermission();
      if (permission !== 'granted') {
        callLogger.warn('CALL', `Microphone permission ${permission}. Aborting accept.`, ctx);
        this.contextActions.setErrorMessage(
          'Microphone access is off, so the spa would not be able to hear you.',
        );
        if (permission === 'blocked') {
          promptForMicrophoneSettings();
        }
        this.isAccepting = false;
        // Decline rather than answering into silence - the caller learns immediately.
        await this.rejectCall();
        return;
      }

      // Step 1: REST accept
      const restStart = Date.now();
      console.log(`[REST] POST /chat/calls/${pending.sessionId}/accept`);
      const response = await authAxiosClient.post(
        `/chat/calls/${pending.sessionId}/accept`,
        callActionBody(pending),
      );
      const data = response.data?.data || response.data;
      callLogger.info('REST', `Accept API Response. Status: ${response.status}, Duration: ${Date.now() - restStart}ms`, ctx, data);

      // Bug #8: Validate Agora token credentials object
      if (
        !data?.token?.token ||
        !data?.token?.channel ||
        data?.token?.uid === undefined
      ) {
        throw new Error('Backend failed to return valid Agora credentials.');
      }

      // Log token information in a sanitized format
      const tokenObj = data.token;
      callLogger.info('TOKEN', `Token details received - Channel: ${tokenObj.channel}, UID: ${tokenObj.uid}, Role: ${tokenObj.role || 'publisher'}`, ctx, {
        tokenTruncated: tokenObj.token ? `${tokenObj.token.substring(0, 15)}...[REDACTED]...${tokenObj.token.substring(tokenObj.token.length - 15)}` : 'N/A'
      });

      // Diff session objects before and after update
      const oldSessionCopy = { ...pending };

      // Bug #1 & #2: Update pending session from token object & callSession object
      pending.token = data.token.token;
      pending.channelName = data.token.channel;
      pending.uid = data.token.uid;

      if (data.callSession) {
        if (data.callSession.id) pending.sessionId = data.callSession.id;
        if (data.callSession.booking_id) pending.bookingId = data.callSession.booking_id;
        if (data.callSession.spa_id) pending.spaId = data.callSession.spa_id;
        if (data.callSession.conversation_id) pending.conversationId = data.callSession.conversation_id;
        if (data.callSession.status) pending.status = data.callSession.status;
        // PR-5: direction is ours (app-centric) - see callService.initiateCall.
        if (data.callSession.agora_uid_user !== undefined) pending.agoraUidUser = data.callSession.agora_uid_user;
        if (data.callSession.agora_uid_spa !== undefined) pending.agoraUidSpa = data.callSession.agora_uid_spa;
      }

      const diffStr = callLogger.diffObjects(oldSessionCopy, pending);
      callLogger.info('SESSION', `Pending Session updated in acceptCall (Diff):\n${diffStr}`, ctx);

      // Step 3: Move pending → connecting
      console.log('[CallFlow] Moving Pending → Connecting');
      callService.movePendingToConnecting();
      
      const stateStart1 = Date.now();
      this.contextActions.setCallState(CallState.CONNECTING);
      callLogger.info('STATE', `Transition state set to CONNECTING. Duration: ${Date.now() - stateStart1}ms`, ctx);

      // Step 4: Join Agora
      console.log('[Agora] Joining Agora channel:', pending.channelName);
      const agoraStart = Date.now();
      await callService.joinPendingSession();
      callLogger.info('AGORA', `Join channel completed. Duration: ${Date.now() - agoraStart}ms`, ctx);
      console.log('[Agora] Join success for channel:', pending.channelName);

      // Step 5: Promote connecting → active
      console.log('[CallFlow] Promoting Connecting → Active');
      callService.promoteConnectingToActive();

      // Step 6: Navigate CallScreen
      console.log('[IncomingCall] Navigating to CallScreen');
      const navStart = Date.now();
      if (navigationRef.isReady()) {
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        if (currentRoute === 'CallScreen') {
          // PR-2: answered from CallScreen's own INCOMING layout - we are already here.
          callLogger.info('NAVIGATION', 'Already on CallScreen; no navigation needed.', ctx);
        } else if (currentRoute === 'IncomingCall') {
          navigationRef.dispatch(
            StackActions.replace('CallScreen', {
              bookingId: pending.bookingId,
              spaId: pending.spaId,
              callType: pending.callType,
              spaName: pending.caller.name,
              spaAvatar: pending.caller.avatarUrl || '',
              isIncoming: true,
            })
          );
          callLogger.info('NAVIGATION', `Replaced IncomingCallScreen with CallScreen. Duration: ${Date.now() - navStart}ms`, ctx);
        } else {
          // @ts-ignore
          navigationRef.navigate('CallScreen', {
            bookingId: pending.bookingId,
            spaId: pending.spaId,
            callType: pending.callType,
            spaName: pending.caller.name,
            spaAvatar: pending.caller.avatarUrl || '',
            isIncoming: true,
          });
          callLogger.info('NAVIGATION', `Navigated to CallScreen. Duration: ${Date.now() - navStart}ms`, ctx);
        }
      } else {
        callLogger.warn('NAVIGATION', `navigationRef not ready. Bypassed CallScreen navigation.`, ctx);
      }

      // Step 7: CONNECTED
      console.log('[IncomingCall] Connected');
      const stateStart2 = Date.now();
      this.contextActions.setCallState(CallState.CONNECTED);
      callLogger.info('STATE', `Transition state set to CONNECTED. Duration: ${Date.now() - stateStart2}ms`, ctx);
      
      this.contextActions.setSession(callService.getActiveSession());

      const totalDuration = Date.now() - startTime;
      callLogger.info('CALL', `EXIT: acceptCall - SUCCESS. Duration: ${totalDuration}ms`, ctx);
    } catch (error) {
      console.error('[IncomingCall] Failed to accept call:', error);
      // PR-2: surface the reason. Every accept failure used to render as "Call Failed".
      this.contextActions.setErrorMessage(extractApiErrorMessage(error, 'Could not answer the call.'));
      // Bug #3: Only cleanup after a real failure
      this.contextActions.setCallState(CallState.FAILED);
      this.contextActions.cleanupAndResetCall('agora_join_failed');
      
      const duration = Date.now() - startTime;
      callLogger.error('CALL', `EXIT: acceptCall - FAILURE. Duration: ${duration}ms`, ctx, error);
      
      // Persist logs as failure virtual file
      callLogger.persistSessionLogs(pending.sessionId, true);
    } finally {
      this.isAccepting = false;
    }
  }

  async rejectCall(): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('CALL', 'ENTER: rejectCall', ctx);

    if (this.isRejecting || !this.contextActions) {
      const duration = Date.now() - startTime;
      callLogger.warn('CALL', `Reject already in progress, ignoring. Duration: ${duration}ms`, ctx);
      return;
    }
    this.isRejecting = true;
    
    console.log('[IncomingCall] Reject pressed');
    const stopRingStart = Date.now();
    ringtoneService.stop();
    callLogger.info('AUDIO', `Ringtone stopped. Duration: ${Date.now() - stopRingStart}ms`, ctx);

    const pending = callService.getPendingSession();
    if (!pending) {
      this.isRejecting = false;
      const duration = Date.now() - startTime;
      callLogger.warn('CALL', `No pending session found to reject. Duration: ${duration}ms`, ctx);
      return;
    }

    try {
      const restStart = Date.now();
      console.log(`[REST] POST /chat/calls/${pending.sessionId}/reject`);
      await authAxiosClient.post(
        `/chat/calls/${pending.sessionId}/reject`,
        callActionBody(pending),
      );
      callLogger.info('REST', `rejectCall API response. Duration: ${Date.now() - restStart}ms`, ctx);
    } catch (error) {
      console.error('[IncomingCall] Error rejecting call', error);
      callLogger.error('REST', 'Error rejecting call via REST', ctx, error);
    } finally {
      const navStart = Date.now();
      if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'IncomingCall') {
        navigationRef.goBack();
        callLogger.info('NAVIGATION', `Navigated back from IncomingCallScreen. Duration: ${Date.now() - navStart}ms`, ctx);
      }
      
      const stateStart = Date.now();
      this.contextActions.setCallState(CallState.REJECTED);
      callLogger.info('STATE', `Transition state set to REJECTED. Duration: ${Date.now() - stateStart}ms`, ctx);
      
      setTimeout(() => {
        const cleanupStart = Date.now();
        this.contextActions?.cleanupAndResetCall('rejected_by_user');
        callLogger.info('CALL', `cleanupAndResetCall triggered. Duration to execute: ${Date.now() - cleanupStart}ms`, ctx);
        // Persist session logs
        callLogger.persistSessionLogs(pending.sessionId, false);
      }, 1000);
      this.isRejecting = false;
      const totalDuration = Date.now() - startTime;
      callLogger.info('CALL', `EXIT: rejectCall - SUCCESS. Duration: ${totalDuration}ms`, ctx);
    }
  }

  handleRemoteEndOrCancel(sessionId: string, reason: string): void {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('CALL', `ENTER: handleRemoteEndOrCancel - sessionId=${sessionId}, reason=${reason}`, ctx);

    const pending = callService.getPendingSession();
    const active = callService.getActiveSession();
    const connecting = callService.getConnectingSession();

    const currentId = pending?.sessionId || active?.sessionId || connecting?.sessionId;
    
    if (currentId !== sessionId) {
      console.log(`[IncomingCall] Remote cancelled event for different session ${sessionId}. Ignoring.`);
      const duration = Date.now() - startTime;
      callLogger.info('CALL', `Remote end/cancel event ignored - mismatched session ID ${sessionId}. Duration: ${duration}ms`, ctx);
      return;
    }

    console.log(`[IncomingCall] Remote cancelled/ended call. Reason: ${reason}`);
    
    const ringStopStart = Date.now();
    ringtoneService.stop();
    callLogger.info('AUDIO', `Ringtone stopped. Duration: ${Date.now() - ringStopStart}ms`, ctx);

    const navStart = Date.now();
    if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'IncomingCall') {
      navigationRef.goBack();
      callLogger.info('NAVIGATION', `Navigated back from IncomingCallScreen. Duration: ${Date.now() - navStart}ms`, ctx);
    }
    
    if (this.contextActions) {
      const stateStart = Date.now();
      this.contextActions.setCallState(CallState.ENDED);
      callLogger.info('STATE', `Transition state set to ENDED. Duration: ${Date.now() - stateStart}ms`, ctx);
      
      const cleanupStart = Date.now();
      this.contextActions.cleanupAndResetCall(reason);
      callLogger.info('CALL', `cleanupAndResetCall triggered. Duration to execute: ${Date.now() - cleanupStart}ms`, ctx);
    }

    // Persist logs
    callLogger.persistSessionLogs(sessionId, reason === 'call_canceled' || reason === 'agora_join_failed');

    const totalDuration = Date.now() - startTime;
    callLogger.info('CALL', `EXIT: handleRemoteEndOrCancel. Duration: ${totalDuration}ms`, ctx);
  }
}

export const callManager = new CallManager();
