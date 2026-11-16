import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import { deviceRegistration } from '../services/call/deviceRegistration';
import { callLogger } from '../services/call/callLogger';
import Toast from 'react-native-toast-message';
import AuthApi from '../api/AuthApi';
import ProfileApi from '../api/ProfileApi';
import {
  readAuthSession,
  writeAuthSession,
  clearAuthSession,
} from '../utils/authStorage';
import type { AuthUser, AuthContextValue } from '../types/auth';
import { Crashlytics, CrashlyticsKeys } from '../services/firebase/crashlytics';
import { FirebaseMessaging } from '../services/firebase/messaging';
import { removeFcmToken } from '../utils/fcmStorage';
import { clearOnboardingAnswers } from '../utils/onboardingStorage';
import { CommonActions } from '@react-navigation/native';
import { navigationRef } from '../navigation/NavigationService';

/**
 * Screens that only work signed in. When the session expires on one of them the
 * user is sent to Login; browsing screens (Home, Explore, Spa Details) already
 * ask for a login when an action needs one, so they are left alone.
 */
const SESSION_ONLY_ROUTES = new Set([
  'EditProfile',
  'NoPayment',
  'AllBooking',
  'Bookings',
  'Profile',
  'BookingResult',
  'PaymentScreen',
  'CallScreen',
]);

/**
 * Everything on this device that belongs to the signed-in user. Logout used to clear
 * only the auth session, so the device kept receiving the previous user's push
 * notifications (its FCM token stayed registered to their profile) and their
 * onboarding answers were synced onto the next account.
 */
const clearUserDeviceState = async (): Promise<void> => {
  await Promise.allSettled([
    clearAuthSession(),
    Crashlytics.clearUser(),
    FirebaseMessaging.deleteToken(),
    removeFcmToken(),
    clearOnboardingAnswers(),
    callLogger.clearStoredLogs(),
  ]);
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Hydrate session on app start
  const hydrate = useCallback(async (): Promise<void> => {
    try {
      const session = await readAuthSession();
      // console.log('AuthContext hydrate session:', session);
      if (session.token && session.user) {
        setUser(session.user);
        setToken(session.token);
        setIsLoggedIn(true);

        await Crashlytics.setUserId(session.user.id);

        await Crashlytics.setCustomKey(
          CrashlyticsKeys.USER_ID,
          session.user.id,
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[AuthContext] hydration error:', error);
      }
      await clearAuthSession();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Login handler
  const login = useCallback(async (phone: string, otp: string): Promise<AuthUser> => {
    try {
      const response = await AuthApi.login({ phone, otp });
      const { token: serverToken, user: serverUser } = response.data;

      // Persist BEFORE updating state: logging in triggers profile/push-token sync,
      // which reads the session from storage and skipped itself when it ran first.
      await writeAuthSession(serverToken, serverUser, true);

      setToken(serverToken);
      setUser(serverUser);
      setIsLoggedIn(true);

      await Crashlytics.setUserId(serverUser.id);

      return serverUser;
    } catch (error) {
      if (__DEV__) {
        console.log('[AuthContext] login error:', error);
      }
      throw error;
    }
  }, []);

  // Register handler
  const register = useCallback(
    async (phone: string, otp: string, fullName: string): Promise<AuthUser> => {
      try {
        const response = await AuthApi.register({
          phone,
          otp,
          username: fullName,
          fullName,
          email: '',
        });
        const { token: serverToken, user: serverUser } = response.data;

        // Persist before updating state - see login.
        await writeAuthSession(serverToken, serverUser, true);

        setToken(serverToken);
        setUser(serverUser);
        setIsLoggedIn(true);

        return serverUser;
      } catch (error) {
        if (__DEV__) {
          console.log('[AuthContext] register error:', error);
        }
        throw error;
      }
    },
    []
  );

  // Logout handler
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Stop calls ringing this phone for the old account (needs the JWT, so first).
      await deviceRegistration.unregister();
      setUser(null);
      setToken(null);
      setIsLoggedIn(false);
      await clearUserDeviceState();
    } catch (error) {
      if (__DEV__) {
        console.warn('[AuthContext] logout error:', error);
      }
    }
  }, []);

  // Delete account handler
  const deleteAccount = useCallback(async (): Promise<void> => {
    // Stop calls ringing this phone while the JWT still works (as logout does);
    // re-registered below if the delete does not go through.
    await deviceRegistration.unregister();
    try {
      const response = await ProfileApi.deleteAccount();
      // A 200 can still say it did not happen; logging the user out and showing
      // "Account deleted" in that case was false.
      if (!response?.success || response?.data?.deleted === false) {
        throw new Error('Your account could not be deleted. Please try again.');
      }
      setUser(null);
      setToken(null);
      setIsLoggedIn(false);
      await clearUserDeviceState();
    } catch (error) {
      if (__DEV__) {
        console.warn('[AuthContext] deleteAccount error:', error);
      }
      // Still signed in: let calls ring this phone again.
      deviceRegistration.setLoggedIn(true);
      throw error;
    }
  }, []);

  // Refs so the 401 listener sees the current session without re-subscribing.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const isHandlingUnauthorizedRef = useRef(false);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'UNAUTHORIZED',
      async (event?: { token?: string | null }) => {
        // Ignore when already logged out, when another 401 is being handled (parallel
        // requests each fired a logout), or when the failed request carried an older
        // token than the current session.
        if (
          !tokenRef.current ||
          isHandlingUnauthorizedRef.current ||
          (event?.token && event.token !== tokenRef.current)
        ) {
          return;
        }
        isHandlingUnauthorizedRef.current = true;
        try {
          await logout();
          // The user used to be signed out with no explanation.
          Toast.show({
            type: 'info',
            text1: 'Session expired',
            text2: 'Please log in again to continue.',
          });
          // Screens like Edit Profile would otherwise stay up with no session,
          // every action failing. Back from Login lands on Home.
          if (navigationRef.isReady()) {
            const current = navigationRef.getCurrentRoute()?.name;
            if (current && SESSION_ONLY_ROUTES.has(current)) {
              navigationRef.dispatch(
                CommonActions.reset({
                  index: 1,
                  routes: [
                    { name: 'BottomNavigation' },
                    { name: 'Login', params: { fromScreen: 'Home' } },
                  ],
                }),
              );
            }
          }
        } finally {
          isHandlingUnauthorizedRef.current = false;
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn,
      isAuthenticated: isLoggedIn, // Backward compatibility
      user,
      token,
      loading,
      login,
      register,
      logout,
      deleteAccount,
    }),
    [isLoggedIn, user, token, loading, login, register, logout, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('[useAuth] must be called inside an <AuthProvider>.');
  }
  return ctx;
};

export default AuthContext;
