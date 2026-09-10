import { agoraService } from './agoraService';
import { socketService } from './socketService';
import { ringtoneService } from './ringtoneService';
import { CallSession, CallRequest } from '../../types/call';
import authAxiosClient from '../../api/authAxiosClient';

// TODO: Replace with real API calls

const getLogContext = (session?: CallSession | null): any => {
  try {
    const { callLogger } = require('./callLogger');
    const activeSession = session || callService.getActiveSession() || callService.getConnectingSession() || callService.getPendingSession();
    return {
      sessionId: activeSession?.sessionId || 'NO_SESSION',
      callState: callLogger.getCallState(),
      channelName: activeSession?.channelName || 'N/A',
      uid: activeSession?.uid || 0
    };
  } catch (e) {
    return { sessionId: 'NO_SESSION', callState: 'UNKNOWN' };
  }
};

class CallService {
  private pendingSession: CallSession | null = null;
  private connectingSession: CallSession | null = null;
  private activeSession: CallSession | null = null;

  getActiveSession(): CallSession | null {
    return this.activeSession;
  }

  getPendingSession(): CallSession | null {
    return this.pendingSession;
  }

  getConnectingSession(): CallSession | null {
    return this.connectingSession;
  }

  createPendingSession(session: CallSession): void {
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(session);
    callLogger.info('SESSION', 'Pending Session BEFORE: null', ctx);
    this.pendingSession = session;
    console.log(`[CallFlow] Created pendingSession: ${session.sessionId}`);
    callLogger.info('SESSION', 'Pending Session AFTER:', ctx, session);
  }

  movePendingToConnecting(): void {
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(this.pendingSession);
    callLogger.info('SESSION', 'Pending Session BEFORE move:', ctx, this.pendingSession);
    callLogger.info('SESSION', 'Connecting Session BEFORE move:', ctx, this.connectingSession);
    if (this.pendingSession) {
      const diffStr = callLogger.diffObjects(this.connectingSession, this.pendingSession);
      this.connectingSession = this.pendingSession;
      this.pendingSession = null;
      console.log(`[CallFlow] Moved pendingSession to connectingSession: ${this.connectingSession.sessionId}`);
      callLogger.info('SESSION', `Connecting Session AFTER move (Diff):\n${diffStr}`, ctx, this.connectingSession);
    }
  }

  promoteConnectingToActive(): void {
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(this.connectingSession);
    callLogger.info('SESSION', 'Connecting Session BEFORE promote:', ctx, this.connectingSession);
    callLogger.info('SESSION', 'Active Session BEFORE promote:', ctx, this.activeSession);
    if (this.connectingSession) {
      const diffStr = callLogger.diffObjects(this.activeSession, this.connectingSession);
      this.activeSession = this.connectingSession;
      this.connectingSession = null;
      console.log(`[CallFlow] Promoted connectingSession to activeSession: ${this.activeSession.sessionId}`);
      callLogger.info('SESSION', `Active Session AFTER promote (Diff):\n${diffStr}`, ctx, this.activeSession);
    }
  }

  clearSessions(): void {
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('SESSION', 'Clearing all sessions', ctx, {
      pending: this.pendingSession,
      connecting: this.connectingSession,
      active: this.activeSession,
    });
    this.activeSession = null;
    this.connectingSession = null;
    this.pendingSession = null;
  }

  async cleanup(reason: string): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('CALL', `ENTER: cleanup - reason=${reason}`, ctx);
    
    console.log(`[CallFlow] Cleaning up CallService. Reason: ${reason}`);
    ringtoneService.stop();
    this.clearSessions();
    await agoraService.leaveChannel();
    
    const duration = Date.now() - startTime;
    callLogger.info('CALL', `EXIT: cleanup - SUCCESS. Duration: ${duration}ms`, ctx);
  }

  async joinPendingSession(): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(this.connectingSession);
    callLogger.info('AGORA', 'ENTER: joinPendingSession', ctx);

    // Expected to be called after movePendingToConnecting, so we join using connectingSession
    const session = this.connectingSession;
    console.log('[Agora] Session while joining Agora: ', session);
    if (!session || !session.token || !session.channelName || session.uid === undefined) {
      const duration = Date.now() - startTime;
      const err = new Error(`[CallFlow] Cannot join session without valid Agora credentials.`);
      callLogger.error('AGORA', `EXIT: joinPendingSession - FAILURE. Duration: ${duration}ms`, ctx, err);
      throw err;
    }

    // Bug #5: Prevent duplicate joinChannel() calls if already joining or joined
    if (agoraService.getIsJoining() || agoraService.getIsJoined()) {
      const duration = Date.now() - startTime;
      console.log(`[Agora] joinPendingSession ignored. Already joining or joined channel.`);
      callLogger.info('AGORA', `joinPendingSession ignored. Already joining or joined channel. Duration: ${duration}ms`, ctx);
      return;
    }

    console.log(`[Agora] Executing joinChannel for session: ${session.sessionId}`);
    
    try {
      await agoraService.joinChannel(session.token, session.channelName, session.uid);
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `EXIT: joinPendingSession - SUCCESS. Duration: ${duration}ms`, ctx);
    } catch (e) {
      const duration = Date.now() - startTime;
      callLogger.error('AGORA', `EXIT: joinPendingSession - FAILURE. Duration: ${duration}ms`, ctx, e);
      throw e;
    }
  }

  async initiateCall(request: CallRequest): Promise<CallSession> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('REST', 'ENTER: initiateCall', ctx, { request });
    
    console.log(`[REST] POST /chat/calls/request - Booking: ${request.bookingId}, Spa: ${request.spaId}`);
    
    try {
      const response = await authAxiosClient.post('/chat/calls/request', {
        booking_id: request.bookingId,
        spa_id: request.spaId,
        call_type: request.callType,
      });

      const duration = Date.now() - startTime;
      callLogger.info('REST', `initiateCall API Response. Status: ${response.status}, Duration: ${duration}ms`, ctx, response.data);

      const data = response.data?.data || response.data;

      const session: CallSession = {
        // Backend returns id inside callSession
        sessionId: data.callSession.id,

        // Agora credentials
        channelName: data.channelName,
        token: data.token,
        uid: data.uid,

        // Call information
        status: data.callSession.status,

        // Caller (backend doesn't return profile yet)
        caller: {
          id: data.callSession.user_id,
          name: 'Me', // TODO: Replace with logged-in user name
          role: 'caller',
        },

        // Receiver (backend doesn't return spa profile yet)
        receiver: {
          id: data.callSession.spa_id,
          name: 'Spa', // TODO: Replace with spa name when available
          avatarUrl: '',
          role: 'receiver',
        },

        // Session timestamps
        createdAt:
          data.callSession.created_at ??
          data.callSession.initiated_at ??
          new Date().toISOString(),

        // Additional backend fields
        bookingId: data.callSession.booking_id,
        spaId: data.callSession.spa_id,
        conversationId: data.callSession.conversation_id,

        callType: data.callSession.call_type,
        direction: data.callSession.direction,

        agoraUidUser: data.callSession.agora_uid_user,
        agoraUidSpa: data.callSession.agora_uid_spa,
      };

      this.createPendingSession(session);

      const totalDuration = Date.now() - startTime;
      callLogger.info('REST', `EXIT: initiateCall - SUCCESS. Duration: ${totalDuration}ms`, ctx);

      return session;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      callLogger.error('REST', `EXIT: initiateCall - FAILURE. Status: ${error?.response?.status || 'Unknown'}, Duration: ${duration}ms`, ctx, error);
      throw error;
    }
  }

  async answerCall(session: CallSession): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(session);
    callLogger.info('REST', 'ENTER: answerCall', ctx, { sessionId: session.sessionId });

    try {
      console.log(`[REST] POST /chat/calls/${session.sessionId}/accept`);
      
      const response = await authAxiosClient.post(`/chat/calls/${session.sessionId}/accept`, {
        spa_id: session.spaId,
      });
      
      const duration = Date.now() - startTime;
      callLogger.info('REST', `answerCall API Response. Status: ${response.status}, Duration: ${duration}ms`, ctx, response.data);

      const data = response.data?.data || response.data;

      // Bug #8: Validate token object
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

      // Diff session fields
      const oldSessionCopy = { ...session };

      // Bug #1 & Bug #2
      session.token = data.token.token;
      session.channelName = data.token.channel;
      session.uid = data.token.uid;

      if (data.callSession) {
        if (data.callSession.id) session.sessionId = data.callSession.id;
        if (data.callSession.booking_id) session.bookingId = data.callSession.booking_id;
        if (data.callSession.spa_id) session.spaId = data.callSession.spa_id;
        if (data.callSession.conversation_id) session.conversationId = data.callSession.conversation_id;
        if (data.callSession.status) session.status = data.callSession.status;
        if (data.callSession.direction) session.direction = data.callSession.direction;
        if (data.callSession.agora_uid_user !== undefined) session.agoraUidUser = data.callSession.agora_uid_user;
        if (data.callSession.agora_uid_spa !== undefined) session.agoraUidSpa = data.callSession.agora_uid_spa;
      }

      const diffStr = callLogger.diffObjects(oldSessionCopy, session);
      callLogger.info('SESSION', `Session updated in answerCall (Diff):\n${diffStr}`, ctx);

      socketService.emit('call_accept', session.sessionId);
      console.log(`[Socket] Emitted call_accept. Session: ${session.sessionId}`);

      const totalDuration = Date.now() - startTime;
      callLogger.info('REST', `EXIT: answerCall - SUCCESS. Duration: ${totalDuration}ms`, ctx);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      callLogger.error('REST', `EXIT: answerCall - FAILURE. Status: ${error?.response?.status || 'Unknown'}, Duration: ${duration}ms`, ctx, error);
      throw error;
    }
  }

  handleCallAccepted(payload: any): void {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(this.pendingSession);
    callLogger.info('SOCKET', 'ENTER: handleCallAccepted', ctx, payload);

    // Bug #4: Ignore duplicate call_accept socket events if connecting or active session already exists
    if (!this.pendingSession || this.connectingSession || this.activeSession) {
      console.log(`[CallFlow] Ignoring call_accept: no pending session or connecting/active session already exists`);
      const duration = Date.now() - startTime;
      callLogger.info('SOCKET', `Ignoring call_accept - session already connecting or active. Duration: ${duration}ms`, ctx);
      return;
    }

    const data = payload?.data || payload;
    const callSession = data.callSession || payload.callSession;
    const tokenObj = data.token || payload.token;
    
    if (callSession?.id && callSession.id !== this.pendingSession.sessionId) {
      console.log(`[CallFlow] Ignoring call_accept for unmatched session: ${callSession.id}`);
      const duration = Date.now() - startTime;
      callLogger.info('SOCKET', `Ignoring call_accept - unmatched session ID. Duration: ${duration}ms`, ctx);
      return;
    }

    // Bug #1: Parse token.token, token.channel, token.uid
    if (!tokenObj || !tokenObj.token || !tokenObj.channel || tokenObj.uid === undefined) {
      console.error(`[CallFlow] call_accept payload missing valid credentials`);
      const duration = Date.now() - startTime;
      callLogger.error('SOCKET', `EXIT: handleCallAccepted - FAILURE (invalid credentials). Duration: ${duration}ms`, ctx);
      return;
    }

    // Log token info
    callLogger.info('TOKEN', `Socket Token details received - Channel: ${tokenObj.channel}, UID: ${tokenObj.uid}, Role: ${tokenObj.role || 'publisher'}`, ctx, {
      tokenTruncated: tokenObj.token ? `${tokenObj.token.substring(0, 15)}...[REDACTED]...${tokenObj.token.substring(tokenObj.token.length - 15)}` : 'N/A'
    });

    const oldSessionCopy = { ...this.pendingSession };

    console.log(`[Session] Updating pendingSession credentials - Session: ${this.pendingSession.sessionId}, UID: ${tokenObj.uid}, Channel: ${tokenObj.channel}`);
    
    this.pendingSession.token = tokenObj.token;
    this.pendingSession.channelName = tokenObj.channel;
    this.pendingSession.uid = tokenObj.uid;

    // Bug #2: Populate missing session fields from callSession
    if (callSession) {
      if (callSession.id) this.pendingSession.sessionId = callSession.id;
      if (callSession.booking_id) this.pendingSession.bookingId = callSession.booking_id;
      if (callSession.spa_id) this.pendingSession.spaId = callSession.spa_id;
      if (callSession.conversation_id) this.pendingSession.conversationId = callSession.conversation_id;
      if (callSession.status) this.pendingSession.status = callSession.status;
      if (callSession.direction) this.pendingSession.direction = callSession.direction;
      if (callSession.agora_uid_user !== undefined) this.pendingSession.agoraUidUser = callSession.agora_uid_user;
      if (callSession.agora_uid_spa !== undefined) this.pendingSession.agoraUidSpa = callSession.agora_uid_spa;
    }

    const diffStr = callLogger.diffObjects(oldSessionCopy, this.pendingSession);
    callLogger.info('SESSION', `Pending Session updated in handleCallAccepted (Diff):\n${diffStr}`, ctx);

    const duration = Date.now() - startTime;
    callLogger.info('SOCKET', `EXIT: handleCallAccepted - SUCCESS. Duration: ${duration}ms`, ctx);
  }

  async declineCall(session: CallSession): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(session);
    callLogger.info('REST', 'ENTER: declineCall', ctx, { sessionId: session.sessionId });

    try {
      console.log(`[REST] POST /chat/calls/${session.sessionId}/reject`);
      const response = await authAxiosClient.post(`/chat/calls/${session.sessionId}/reject`, {
        spa_id: session.spaId,
      });
      
      const duration = Date.now() - startTime;
      callLogger.info('REST', `declineCall API Response. Status: ${response.status}, Duration: ${duration}ms`, ctx, response.data);

      socketService.emit('call_reject', session.sessionId);
      console.log(`[Socket] Emitted call_reject. Session: ${session.sessionId}`);
      
      const totalDuration = Date.now() - startTime;
      callLogger.info('REST', `EXIT: declineCall - SUCCESS. Duration: ${totalDuration}ms`, ctx);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      callLogger.error('REST', `EXIT: declineCall - FAILURE. Status: ${error?.response?.status || 'Unknown'}, Duration: ${duration}ms`, ctx, error);
    }
  }

  async cancelCall(session: CallSession): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(session);
    callLogger.info('REST', 'ENTER: cancelCall', ctx, { sessionId: session.sessionId });

    try {
      console.log(`[REST] POST /chat/calls/${session.sessionId}/cancel`);
      const response = await authAxiosClient.post(`/chat/calls/${session.sessionId}/cancel`, {
        spa_id: session.spaId,
      });
      
      const duration = Date.now() - startTime;
      callLogger.info('REST', `cancelCall API Response. Status: ${response.status}, Duration: ${duration}ms`, ctx, response.data);
      console.log(`[CallFlow] Call canceled correctly via REST.`);
      
      const totalDuration = Date.now() - startTime;
      callLogger.info('REST', `EXIT: cancelCall - SUCCESS. Duration: ${totalDuration}ms`, ctx);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      callLogger.error('REST', `EXIT: cancelCall - FAILURE. Status: ${error?.response?.status || 'Unknown'}, Duration: ${duration}ms`, ctx, error);
    }
  }

  async endCall(session: CallSession | null, durationSeconds: number): Promise<void> {
    if (!session) return;
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext(session);
    callLogger.info('REST', 'ENTER: endCall', ctx, { sessionId: session.sessionId, durationSeconds });

    try {
      console.log(`[REST] POST /chat/calls/${session.sessionId}/end`);
      const response = await authAxiosClient.post(`/chat/calls/${session.sessionId}/end`, {
        spa_id: session.spaId,
        duration_seconds: durationSeconds,
      });
      
      const duration = Date.now() - startTime;
      callLogger.info('REST', `endCall API Response. Status: ${response.status}, Duration: ${duration}ms`, ctx, response.data);

      socketService.emit('call_end', session.sessionId);
      console.log(`[Socket] Emitted call_end. Session: ${session.sessionId}`);
      
      const totalDuration = Date.now() - startTime;
      callLogger.info('REST', `EXIT: endCall - SUCCESS. Duration: ${totalDuration}ms`, ctx);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      callLogger.error('REST', `EXIT: endCall - FAILURE. Status: ${error?.response?.status || 'Unknown'}, Duration: ${duration}ms`, ctx, error);
    }
  }

  async toggleMute(isMuted: boolean): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AUDIO', `ENTER: toggleMute - isMuted=${isMuted}`, ctx);

    try {
      await agoraService.muteLocalAudioStream(isMuted);
      console.log("[Agora] Local audio unmuted");
      
      callLogger.updateAudioSnapshot(ctx?.sessionId, { micMuted: isMuted });

      const duration = Date.now() - startTime;
      callLogger.info('AUDIO', `EXIT: toggleMute - SUCCESS. Duration: ${duration}ms`, ctx);
    } catch (e) {
      const duration = Date.now() - startTime;
      callLogger.error('AUDIO', `EXIT: toggleMute - FAILURE. Duration: ${duration}ms`, ctx, e);
      throw e;
    }
  }

  async toggleSpeaker(isSpeaker: boolean): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AUDIO', `ENTER: toggleSpeaker - isSpeaker=${isSpeaker}`, ctx);

    try {
      await agoraService.setEnableSpeakerphone(isSpeaker);
      
      callLogger.updateAudioSnapshot(ctx?.sessionId, { speakerEnabled: isSpeaker });

      const duration = Date.now() - startTime;
      callLogger.info('AUDIO', `EXIT: toggleSpeaker - SUCCESS. Duration: ${duration}ms`, ctx);
    } catch (e) {
      const duration = Date.now() - startTime;
      callLogger.error('AUDIO', `EXIT: toggleSpeaker - FAILURE. Duration: ${duration}ms`, ctx, e);
      throw e;
    }
  }
}

export const callService = new CallService();
