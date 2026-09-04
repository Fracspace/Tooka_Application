/**
 * SocketContext — single owner of the shared Socket.IO connection.
 *
 * Why this exists:
 *  - CallProvider used to call socketService.connect() once on mount. connect()
 *    read the JWT from AsyncStorage, so on a cold start where the user was not
 *    logged in yet (or AuthContext had not hydrated) it bailed out with a warning
 *    and was never retried. The user could then log in and still have no socket,
 *    which means no incoming calls at all until the app was restarted.
 *  - The connection is shared with future features (chat). Feature providers must
 *    only register and unregister listeners; the lifecycle lives here.
 *
 * Placement in App.tsx: BELOW AuthProvider, ABOVE CallProvider.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useAuth } from './AuthContext';
import { socketService } from '../services/call/socketService';

export interface SocketContextValue {
  /** True once the underlying socket has fired 'connect'. */
  isConnected: boolean;
  /** True when the user is authenticated AND the socket is connected. */
  socketReady: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isLoggedIn, token, loading } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(
    socketService.isConnected(),
  );

  // The token the current socket was opened with, so a real change is detectable.
  const activeTokenRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Track connection state. These are registered through socketService.on() so
  // they survive reconnects: the service queues listeners and rebinds them on
  // every new socket instance.
  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
    };
  }, []);

  // Connect and disconnect with the auth state.
  useEffect(() => {
    // Wait for AuthContext to hydrate, otherwise the first render looks like a
    // logout and tears down a socket that was about to be valid.
    if (loading) {
      return;
    }

    if (isLoggedIn && token) {
      // Token rotated (re-login, possibly as a different user): the old socket is
      // authenticated with the previous JWT and has to go.
      if (activeTokenRef.current && activeTokenRef.current !== token) {
        console.log('[SocketProvider] Auth token changed. Reconnecting socket.');
        socketService.disconnect();
        setIsConnected(false);
      }

      activeTokenRef.current = token;

      // Pass the token explicitly. AuthContext sets its in-memory token before the
      // AsyncStorage write resolves, so letting socketService read storage here
      // races and can pick up the previous (or a null) value right after login.
      socketService.connect(token).catch(error => {
        console.warn('[SocketProvider] Socket connect failed:', error);
      });
    } else {
      if (activeTokenRef.current !== null || socketService.isConnected()) {
        console.log('[SocketProvider] Logged out. Disconnecting socket.');
        socketService.disconnect();
      }
      activeTokenRef.current = null;
      setIsConnected(false);
    }
  }, [isLoggedIn, token, loading]);

  // Revive a socket that died while the app was backgrounded.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const previous = appStateRef.current;
        appStateRef.current = nextAppState;

        const returnedToForeground =
          nextAppState === 'active' &&
          (previous === 'background' || previous === 'inactive');

        if (!returnedToForeground) {
          return;
        }

        const currentToken = activeTokenRef.current;
        if (!currentToken || socketService.isConnected()) {
          return;
        }

        console.log('[SocketProvider] Foreground with a dead socket. Reconnecting.');
        socketService.ensureConnected(currentToken).catch(error => {
          console.warn('[SocketProvider] Foreground reconnect failed:', error);
        });
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Tear down when the app unmounts.
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const value = useMemo<SocketContextValue>(
    () => ({
      isConnected,
      socketReady: isLoggedIn && isConnected,
    }),
    [isConnected, isLoggedIn],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue => {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('[useSocket] must be called inside a <SocketProvider>.');
  }
  return ctx;
};

export default SocketContext;
