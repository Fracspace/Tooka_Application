export enum CallState {
  IDLE = 'IDLE',
  OUTGOING = 'OUTGOING',
  RINGING = 'RINGING',
  INCOMING = 'INCOMING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  MISSED = 'MISSED',
  NO_ANSWER = 'NO_ANSWER',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  ENDED = 'ENDED',
}

/**
 * States a call rests in while its result is on screen, before cleanup returns it
 * to IDLE. A new call (retry, or a fresh incoming one) may supersede any of these.
 */
export const TERMINAL_CALL_STATES: ReadonlySet<CallState> = new Set([
  CallState.MISSED,
  CallState.NO_ANSWER,
  CallState.REJECTED,
  CallState.FAILED,
  CallState.ENDED,
]);

export interface CallParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'caller' | 'receiver';
}

export interface CallRequest {
  bookingId: string;
  spaId: string;
  callType: 'voice' | 'video';
  // PR-4: the /request response carries no spa profile, so the session's receiver
  // was hardcoded to the literal string 'Spa' on every outgoing call. The caller
  // already knows these from the booking - pass them through.
  spaName?: string;
  spaAvatarUrl?: string;
}

export interface CallSession {
    sessionId: string;
    channelName: string;
    token: string;
    uid: number;
    status: string;
    bookingId: string;
    spaId: string;
    conversationId: string;
    direction: 'outbound' | 'inbound';
    callType: 'voice' | 'video';
    agoraUidUser: number;
    agoraUidSpa: number;
    caller: CallParticipant;
    receiver: CallParticipant;
    createdAt: string;
}

export interface CallApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface CallEvents {
  onStateChange?: (state: CallState) => void;
  onParticipantJoined?: (uid: number) => void;
  onParticipantLeft?: (uid: number) => void;
  onError?: (error: Error) => void;
}
