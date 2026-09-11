import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import AuthApi from '../api/AuthApi';
import ProfileApi from '../api/ProfileApi';
import {
  readAuthSession,
  writeAuthSession,
  clearAuthSession,
} from '../utils/authStorage';
import type { AuthUser, AuthContextValue } from '../types/auth';
import { Crashlytics, CrashlyticsKeys } from '../services/firebase/crashlytics';

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

        await Crashlytics.setCustomKey(
          CrashlyticsKeys.USER_PHONE,
          session.user.phoneNumber,
        );
      }
      console.log('AuthContext hydrated:', session.token);
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
      console.log("token: ", serverToken);

      // Update state
      setToken(serverToken);
      setUser(serverUser);
      setIsLoggedIn(true);

      await Crashlytics.setUserId(serverUser.id);

      await Crashlytics.setCustomKey(
        CrashlyticsKeys.USER_PHONE,
        serverUser.phoneNumber,
      );

      // Save to storage
      await writeAuthSession(serverToken, serverUser, true);

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

        // Update state
        setToken(serverToken);
        setUser(serverUser);
        setIsLoggedIn(true);

        // Save to storage
        await writeAuthSession(serverToken, serverUser, true);

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
      setUser(null);
      setToken(null);
      setIsLoggedIn(false);
      await clearAuthSession();
      await Crashlytics.clearUser();
    } catch (error) {
      if (__DEV__) {
        console.warn('[AuthContext] logout error:', error);
      }
    }
  }, []);

  // Delete account handler
  const deleteAccount = useCallback(async (): Promise<void> => {
    try {
      await ProfileApi.deleteAccount();
      setUser(null);
      setToken(null);
      setIsLoggedIn(false);
      await clearAuthSession();
      await Crashlytics.clearUser();
    } catch (error) {
      if (__DEV__) {
        console.warn('[AuthContext] deleteAccount error:', error);
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('UNAUTHORIZED', () => {
      void logout();
    });

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
