// import { io, Socket } from 'socket.io-client';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// type SocketEventListener = (data: any) => void;

// class SocketService {
//   private socket: Socket | null = null;
//   private listeners: Record<string, Set<SocketEventListener>> = {};

//   async connect(): Promise<void> {
//     if (this.socket && this.socket.connected) {
//       console.log('[SocketService] connect ignored. Already connected.');
//       return;
//     }

//     try {
//       const token = await AsyncStorage.getItem('authToken');
//       // console.log('Socket Token:', token);
//       // console.log('Socket Role:', 'user');
//       if (!token) {
//         console.warn('[SocketService] Cannot connect without auth token.');
//         return;
//       }

//       console.log('[SocketService] Connecting to production Socket.IO backend...');
//       this.socket = io('https://api.tooka.app', {
//         auth: {
//           token,
//           role: 'user',
//         },
//         transports: ['websocket'],
//         reconnection: true,
//       });

//       this.socket.on('connect', () => {
//         console.log('[SocketService] Socket connected successfully.');
//         console.log('[SocketService] Socket ID:', this.socket?.id);
//         console.log('[SocketService] Connected:', this.socket?.connected);
//       });

//       this.socket.onAny((event, ...args) => {
//         console.log(
//           '[Socket]',
//           event,
//           JSON.stringify(args, null, 2)
//         );
//       });

//       this.socket.on('connect', () => {
//         console.log('[SocketService] Socket connected successfully.', this.socket?.id);
//       });

//       this.socket.on('disconnect', (reason) => {
//         console.log(`[SocketService] Socket disconnected: ${reason}`);
//       });

//       this.socket.on('connect_error', (error) => {
//         console.error('[SocketService] Socket connection error:', error);
//       });

//       // Bind all existing local listeners to the new socket instance
//       this.rebindListeners();

//     } catch (error) {
//       console.error('[SocketService] Initialization error:', error);
//     }
//   }

//   disconnect() {
//     console.log('[SocketService] Disconnecting socket...');
//     if (this.socket) {
//       this.socket.disconnect();
//       this.socket = null;
//     }
//     // We clear listeners on disconnect to prevent memory leaks across sessions
//     this.listeners = {};
//   }

//   isConnected(): boolean {
//     return this.socket?.connected || false;
//   }

//   on(event: string, listener: SocketEventListener) {
//     if (!this.listeners[event]) {
//       this.listeners[event] = new Set();
//     }
//     if (this.listeners[event].has(listener)) {
//       console.log(`[SocketService] Warning: listener for ${event} already registered.`);
//       return;
//     }
//     this.listeners[event].add(listener);

//     // If socket is already active, bind it immediately
//     if (this.socket) {
//       this.socket.on(event, listener);
//     }
//   }

//   off(event: string, listener: SocketEventListener) {
//     if (!this.listeners[event]) return;
//     this.listeners[event].delete(listener);

//     if (this.socket) {
//       this.socket.off(event, listener);
//     }
//   }

//   emit(event: string, data?: any) {
//     if (!this.socket || !this.socket.connected) {
//       console.warn(`[SocketService] Emit failed for event: ${event}. Socket is not connected.`);
//       return;
//     }
//     // console.log(`[SocketService] Emitting event: ${event}`, data);
//     console.log(
//   '[SocketService] Emitting:',
//   event,
//   JSON.stringify(data, null, 2),
// );
//     this.socket.emit(event, data);
//   }

//   private rebindListeners() {
//     if (!this.socket) return;
//     Object.keys(this.listeners).forEach((event) => {
//       this.listeners[event].forEach((listener) => {
//         this.socket!.on(event, listener);
//       });
//     });
//   }
// }

// export const socketService = new SocketService();



import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  } catch (e) {
    return { sessionId: 'NO_SESSION', callState: 'UNKNOWN' };
  }
};

class SocketService {
  private socket: Socket | null = null;
  private listeners: Record<string, Set<SocketEventListener>> = {};
  private isConnecting = false;

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
      const token = authToken ?? (await AsyncStorage.getItem('authToken'));
      if (!token) {
        const duration = Date.now() - startTime;
        callLogger.warn('SOCKET', `Cannot connect without auth token. Duration: ${duration}ms`, ctx);
        return;
      }

      callLogger.info('SOCKET', 'Connecting to Socket.IO backend...', ctx);
      this.socket = io('https://api.tooka.app', {
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

      this.socket.on('connect_error', (error) => {
        const freshCtx = getLogContext();
        callLogger.error('SOCKET', `Socket connection error`, freshCtx, error);
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

  // Updated to accept optional acknowledgment callback (ack)
  emit(event: string, data?: any, ack?: (response: any) => void) {
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
      return;
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