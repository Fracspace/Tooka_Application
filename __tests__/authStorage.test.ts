// In-memory stand-ins for the two native stores. Both survive jest.resetModules(),
// like the real stores survive an app restart.
const mockAsyncStore = new Map<string, string>();
const mockKeychainStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockAsyncStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockAsyncStore.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockAsyncStore.delete(key);
  }),
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
  setGenericPassword: jest.fn(
    async (username: string, password: string, options: { service: string }) => {
      mockKeychainStore.set(options.service, password);
      return { service: options.service, storage: 'test' };
    },
  ),
  getGenericPassword: jest.fn(async (options: { service: string }) => {
    const password = mockKeychainStore.get(options.service);
    return password ? { username: 'tooka_session', password, service: options.service } : false;
  }),
  resetGenericPassword: jest.fn(async (options: { service: string }) => {
    mockKeychainStore.delete(options.service);
    return true;
  }),
}));

const USER = { id: 'u1', userName: 'krishna', phoneNumber: '+910000000000' };

/** A fresh copy of the module, i.e. a new app launch. */
const launchApp = (): typeof import('../src/utils/authStorage') => {
  let mod: typeof import('../src/utils/authStorage');
  jest.isolateModules(() => {
    mod = require('../src/utils/authStorage');
  });
  return mod!;
};

beforeEach(() => {
  mockAsyncStore.clear();
  mockKeychainStore.clear();
});

describe('authStorage', () => {
  it('migrates a pre-Keychain AsyncStorage session and deletes the plain copy', async () => {
    mockAsyncStore.set('authToken', 'legacy-jwt');
    mockAsyncStore.set('user', JSON.stringify(USER));
    mockAsyncStore.set('isLoggedIn', 'true');

    const session = await launchApp().readAuthSession();

    expect(session).toEqual({ token: 'legacy-jwt', user: USER, isLoggedIn: true });
    expect(mockAsyncStore.has('authToken')).toBe(false);
    expect(mockAsyncStore.has('user')).toBe(false);
    expect(mockKeychainStore.size).toBe(1);

    // Still logged in on the next launch, now from the Keychain.
    expect(await launchApp().getAuthToken()).toBe('legacy-jwt');
  });

  it('discards a Keychain session left over from before a reinstall', async () => {
    // Previous install: logged in, then uninstalled (AsyncStorage wiped, Keychain kept).
    await launchApp().writeAuthSession('old-owner-jwt', USER, true);
    mockAsyncStore.clear();

    const session = await launchApp().readAuthSession();

    expect(session.isLoggedIn).toBe(false);
    expect(mockKeychainStore.size).toBe(0);
  });

  it('round-trips login and logout without touching AsyncStorage secrets', async () => {
    const app = launchApp();
    await app.readAuthSession(); // first launch: sets the install marker
    await app.writeAuthSession('jwt-1', USER, true);

    expect(await app.getAuthToken()).toBe('jwt-1');
    expect([...mockAsyncStore.values()].some(v => v.includes('jwt-1'))).toBe(false);
    expect(await launchApp().getAuthToken()).toBe('jwt-1');

    await app.clearAuthSession();
    expect(await app.getAuthToken()).toBeNull();
    expect(await launchApp().getAuthToken()).toBeNull();
  });
});
