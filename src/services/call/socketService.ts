/**
 * Shared Socket.IO client. Connection lifecycle is owned by SocketProvider
 * (src/context/SocketContext.tsx) - this service only opens, closes and routes.
 *
 * PR-8: 135 lines of commented-out previous implementation removed from above this
 * point. It was dead weight, and its duplicate `io('https://...')` line made
 * mechanical edits to the live one ambiguous.
 */
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../../utils/authStorage';

import { API_CONFIG } from '../../config/api';

type SocketEventListener = (data: any) => void;

const getLogContext = (): any => {
  try {
    const { callService } = require('./callService');
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
  } catch {
    return { sessionId: 'NO_SESSION', callState: 'UNKNOWN' };
  }
};

/** While reconnecting, note progress on every Nth failed try (about once a minute). */
const CONNECT_ERROR_LOG_EVERY = 12;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Record<string, Set<SocketEventListener>> = {};
  private isConnecting = false;
  /** Failed connection tries in the current outage; reset on connect. */
  private failedConnectAttempts = 0;

  /**
   * PR-3: opens the shared connection.
   *
   * Pass the JWT explicitly wherever possible. AuthContext updates its in-memory
   * token BEFORE the AsyncStorage write resolves, so reading storage here right
   * after login races and can pick up the previous (or a null) value. Falls back
   * to storage when omitted, preserving the original behaviour.
   */
  async connect(authToken?: string): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('SOCKET', 'ENTER: connect', ctx);

    // PR-3: one socket per process. This used to bail only when the existing socket
    // was already CONNECTED, so a second call during the connecting window built a
    // second socket and orphaned the first.
    if (this.socket) {
      const duration = Date.now() - startTime;
      callLogger.info('SOCKET', `Socket instance already exists (connected=${this.socket.connected}). Skipping duplicate connect. Duration: ${duration}ms`, ctx);
      return;
    }

    if (this.isConnecting) {
      callLogger.info('SOCKET', 'Connect already in progress. Ignoring duplicate call.', ctx);
      return;
    }
    this.isConnecting = true;

    try {
      const token = authToken ?? (await getAuthToken());
      if (!token) {
        const duration = Date.now() - startTime;
        callLogger.warn('SOCKET', `Cannot connect without auth token. Duration: ${duration}ms`, ctx);
        return;
      }

      callLogger.info('SOCKET', 'Connecting to Socket.IO backend...', ctx);
      this.socket = io(API_CONFIG.socketUrl, {
        auth: {
          token,
          role: 'user',
        },
        transports: ['websocket', 'polling'], // Allow polling fallback for RN reliability
        reconnection: true,
      });

      // PR-3: attach queued listeners NOW rather than inside the 'connect' handler.
      // Rebinding only on 'connect' meant a listener for 'connect' itself was attached
      // after that event had already fired, so it never ran for the first connection -
      // which is precisely what SocketProvider needs to observe.
      this.rebindListeners();

      this.socket.on('connect', () => {
        const connDuration = Date.now() - startTime;
        const freshCtx = getLogContext();
        if (this.failedConnectAttempts > 0) {
          callLogger.info('SOCKET', `Reconnected after ${this.failedConnectAttempts} failed attempts`, freshCtx);
          this.failedConnectAttempts = 0;
        }
        callLogger.info('SOCKET', `Socket connected successfully. ID: ${this.socket?.id}, Duration from start: ${connDuration}ms`, freshCtx);
        this.rebindListeners();
      });

      this.socket.onAny((event, ...args) => {
        const freshCtx = getLogContext();
        callLogger.info('SOCKET', `Received Socket Event: ${event}`, freshCtx, args);
      });

      this.socket.on('disconnect', (reason) => {
        const freshCtx = getLogContext();
        callLogger.warn('SOCKET', `Socket disconnected: ${reason}`, freshCtx);
      });

      // Socket.IO retries about every 5s while the server is unreachable. Logging
      // each try as an error filled the console and sent Crashlytics a non-fatal
      // every 5s. Report the first failure of an outage, then a short note about
      // once a minute until it reconnects.
      this.socket.on('connect_error', (error) => {
        const freshCtx = getLogContext();
        this.failedConnectAttempts += 1;
        const attempts = this.failedConnectAttempts;
        if (attempts === 1) {
          callLogger.error('SOCKET', `Socket connection error`, freshCtx, error);
        } else if (attempts % CONNECT_ERROR_LOG_EVERY === 0) {
          callLogger.info('SOCKET', `Still reconnecting: ${attempts} failed attempts`, freshCtx);
        }
      });

      const duration = Date.now() - startTime;
      callLogger.info('SOCKET', `EXIT: connect - SUCCESS. Duration: ${duration}ms`, ctx);
    } catch (error) {
      const duration = Date.now() - startTime;
      callLogger.error('SOCKET', `EXIT: connect - FAILURE. Duration: ${duration}ms`, ctx, error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * PR-3: revive a dropped socket, or create one if there is none. Safe to call
   * repeatedly - used when the app returns to the foreground.
   */
  async ensureConnected(authToken?: string): Promise<void> {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }
    await this.connect(authToken);
  }

  disconnect() {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('SOCKET', 'ENTER: disconnect', ctx);

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;

    // PR-3: this.listeners is deliberately NOT cleared. Listeners belong to
    // long-lived providers (CallProvider, later ChatProvider) which unregister via
    // off() in their own effect cleanup. Wiping the registry here left a
    // logout -> login cycle with those providers still mounted but silently
    // unsubscribed until a full app restart.
    const duration = Date.now() - startTime;
    callLogger.info('SOCKET', `EXIT: disconnect - SUCCESS. Duration: ${duration}ms`, ctx);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Resolve true once the socket is connected, or false after `timeoutMs`.
   * Resolves false immediately when there is no socket at all (logged out).
   * Used before placing a call: only the call_request socket event rings the spa,
   * so dialling on a dead socket gave the user a minute of ringback for nothing.
   */
  waitForConnection(timeoutMs: number): Promise<boolean> {
    const socket = this.socket;
    if (!socket) return Promise.resolve(false);
    if (socket.connected) return Promise.resolve(true);

    // Not connected and not retrying on its own (gave up, or was closed): nudge it.
    if (!socket.active) {
      socket.connect();
    }

    return new Promise((resolve) => {
      const onConnect = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        socket.off('connect', onConnect);
        resolve(false);
      }, timeoutMs);
      socket.once('connect', onConnect);
    });
  }

  on(event: string, listener: SocketEventListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(listener);

    if (this.socket) {
      this.socket.off(event, listener); // Prevent duplicate listeners
      this.socket.on(event, listener);
    }
  }

  off(event: string, listener: SocketEventListener) {
    if (this.listeners[event]) {
      this.listeners[event].delete(listener);
    }
    if (this.socket) {
      this.socket.off(event, listener);
    }
  }

  // Updated to accept optional acknowledgment callback (ack).
  // Returns false when the event could not be sent because the socket is down.
  emit(event: string, data?: any, ack?: (response: any) => void): boolean {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('SOCKET', `ENTER Emit: ${event}`, ctx, data);

    if (!this.socket || !this.socket.connected) {
      const duration = Date.now() - startTime;
      callLogger.warn('SOCKET', `Emit FAILED for event: ${event}. Socket not connected. Duration: ${duration}ms`, ctx);
      // PR-3: always settle the acknowledgement. Callers waiting on an ack (an
      // optimistic chat bubble, a call action) used to hang forever when the socket
      // happened to be down.
      if (ack) {
        ack({
          success: false,
          code: 'SOCKET_DISCONNECTED',
          message: 'Socket is not connected.',
        });
      }
      return false;
    }
    
    if (ack) {
      const wrappedAck = (res: any) => {
        const duration = Date.now() - startTime;
        callLogger.info('SOCKET', `ACK Received for event: ${event}. Duration: ${duration}ms`, ctx, res);
        ack(res);
      };
      this.socket.emit(event, data, wrappedAck);
    } else {
      this.socket.emit(event, data);
      const duration = Date.now() - startTime;
      callLogger.info('SOCKET', `EXIT Emit: ${event} (No ACK expected). Duration: ${duration}ms`, ctx);
    }
    return true;
  }

  private rebindListeners() {
    if (!this.socket) return;
    Object.keys(this.listeners).forEach((event) => {
      this.listeners[event].forEach((listener) => {
        this.socket!.off(event, listener); // Ensure clean bind
        this.socket!.on(event, listener);
      });
    });
  }
}

export const socketService = new SocketService();