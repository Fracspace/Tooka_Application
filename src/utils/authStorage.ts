import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import type { AuthUser } from '../types/auth';

/**
 * The auth session (JWT + user) lives in the iOS Keychain / Android Keystore.
 * It used to sit in plain AsyncStorage, readable from any device backup or by
 * anything with file access to the app's sandbox.
 *
 * AsyncStorage keeps only INSTALL_MARKER_KEY, which is not secret. It exists
 * because the iOS Keychain survives an uninstall while AsyncStorage does not:
 * a missing marker means a fresh install, whose leftover Keychain session must
 * be discarded rather than silently logging in a previous owner.
 */

export interface AuthSessionData {
  token: string | null;
  user: AuthUser | null;
  isLoggedIn: boolean;
}

interface StoredSession {
  token: string;
  user: AuthUser;
}

const KEYCHAIN_SERVICE = 'com.fracspace.tooka.auth';
const KEYCHAIN_ACCOUNT = 'tooka_session';
const INSTALL_MARKER_KEY = 'TOOKA_AUTH_STORAGE_V2';

// Pre-Keychain AsyncStorage keys, migrated once and then deleted.
const LEGACY_TOKEN_KEY = 'authToken';
const LEGACY_USER_KEY = 'user';
const LEGACY_LOGGED_IN_KEY = 'isLoggedIn';

const KEYCHAIN_OPTIONS = {
  service: KEYCHAIN_SERVICE,
  // Readable while the device is locked after the first unlock, so background
  // work (push handling, socket reconnects) can still authenticate. Never
  // migrated to another device through a backup.
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
};

const EMPTY_SESSION: AuthSessionData = { token: null, user: null, isLoggedIn: false };

// The axios interceptor reads the token on every request; serve it from memory.
// undefined = not loaded yet, null = loaded and logged out.
let cachedSession: StoredSession | null | undefined;
let loadPromise: Promise<StoredSession | null> | null = null;
// Bumped by every write/clear, so a load that started earlier cannot overwrite
// a newer login or logout when it finishes.
let generation = 0;

const toSessionData = (session: StoredSession | null): AuthSessionData =>
  session ? { token: session.token, user: session.user, isLoggedIn: true } : EMPTY_SESSION;

const parseStoredSession = (raw: string): StoredSession | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token === 'string' && parsed.token && parsed.user) {
      return { token: parsed.token, user: parsed.user };
    }
  } catch {
    // fall through
  }
  return null;
};

const saveToKeychain = async (session: StoredSession): Promise<void> => {
  const result = await Keychain.setGenericPassword(
    KEYCHAIN_ACCOUNT,
    JSON.stringify(session),
    KEYCHAIN_OPTIONS,
  );
  if (!result) {
    throw new Error('Keychain refused to store the auth session.');
  }
};

const readLegacySession = async (): Promise<StoredSession | null> => {
  const [token, userRaw, isLoggedInRaw] = await Promise.all([
    AsyncStorage.getItem(LEGACY_TOKEN_KEY),
    AsyncStorage.getItem(LEGACY_USER_KEY),
    AsyncStorage.getItem(LEGACY_LOGGED_IN_KEY),
  ]);
  if (!token || !userRaw || isLoggedInRaw !== 'true') {
    return null;
  }
  try {
    return { token, user: JSON.parse(userRaw) as AuthUser };
  } catch {
    return null;
  }
};

const removeLegacySession = () =>
  Promise.all([
    AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_USER_KEY),
    AsyncStorage.removeItem(LEGACY_LOGGED_IN_KEY),
  ]);

const loadSession = async (): Promise<StoredSession | null> => {
  const installMarker = await AsyncStorage.getItem(INSTALL_MARKER_KEY);

  if (!installMarker) {
    // First launch of this storage scheme: either an app update (a legacy
    // AsyncStorage session may exist) or a fresh install (AsyncStorage is empty,
    // but the Keychain may still hold a session from before an uninstall).
    const legacy = await readLegacySession();
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    if (legacy) {
      try {
        await saveToKeychain(legacy);
      } catch (error) {
        // Keep the legacy copy and the user logged in; retry next launch.
        if (__DEV__) {
          console.warn('[authStorage] Keychain migration failed:', error);
        }
        return legacy;
      }
    }
    await removeLegacySession();
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, '1');
    return legacy;
  }

  const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  return credentials ? parseStoredSession(credentials.password) : null;
};

const ensureLoaded = async (): Promise<StoredSession | null> => {
  if (cachedSession !== undefined) {
    return cachedSession;
  }
  if (!loadPromise) {
    const loadGeneration = generation;
    loadPromise = loadSession()
      .then((session) => {
        if (loadGeneration !== generation) {
          return cachedSession ?? null;
        }
        cachedSession = session;
        return session;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
};

export async function writeAuthSession(
  token: string,
  user: AuthUser,
  isLoggedIn: boolean
): Promise<void> {
  if (!isLoggedIn) {
    await clearAuthSession();
    return;
  }
  const session = { token, user };
  generation += 1;
  try {
    await saveToKeychain(session);
  } catch (error) {
    if (__DEV__) {
      console.warn('[authStorage] writeAuthSession error:', error);
    }
  }
  // Keep the session usable for this run even if the Keychain write failed; the
  // user will simply have to log in again next launch.
  cachedSession = session;
}

/**
 * Reads the auth session (from memory after the first call).
 */
export async function readAuthSession(): Promise<AuthSessionData> {
  try {
    return toSessionData(await ensureLoaded());
  } catch (error) {
    if (__DEV__) {
      console.warn('[authStorage] readAuthSession error:', error);
    }
    return EMPTY_SESSION;
  }
}

/** The bearer token for API and socket calls, or null when logged out. */
export async function getAuthToken(): Promise<string | null> {
  return (await readAuthSession()).token;
}

/**
 * Removes the stored auth session.
 */
export async function clearAuthSession(): Promise<void> {
  generation += 1;
  cachedSession = null;
  try {
    await Promise.all([
      Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE }),
      removeLegacySession(),
    ]);
  } catch (error) {
    if (__DEV__) {
      console.warn('[authStorage] clearAuthSession error:', error);
    }
  }
}
