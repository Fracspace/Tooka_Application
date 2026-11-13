import { NativeModules, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import authAxiosClient from '../../api/authAxiosClient';
import { callConsole } from './callLogger';

/**
 * Registers this install with the backend so incoming calls can ring it while the app
 * is closed: Android gets an FCM data message, iOS a PushKit VoIP push.
 *
 * POST /users/me/devices is an upsert by deviceId, so calling it again is harmless.
 * A token that is left out keeps its stored value; only known tokens are sent.
 */

let deviceId: string | null = null;
let fcmToken: string | null = null;
let voipToken: string | null = null;
let loggedIn = false;
let registered = false;
let lastSent = '';

/** Stable per install; sent on register and with accept/reject so the backend knows which phone answered. */
export function getDeviceId(): string {
  if (!deviceId) {
    try {
      deviceId = DeviceInfo.getUniqueIdSync();
    } catch {
      deviceId = DeviceInfo.getDeviceId();
    }
  }
  return deviceId;
}

async function register(): Promise<void> {
  if (!loggedIn || (!fcmToken && !voipToken)) return;
  const body: Record<string, string> = {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceId: getDeviceId(),
    appVersion: DeviceInfo.getVersion(),
    osVersion: DeviceInfo.getSystemVersion(),
    deviceModel: DeviceInfo.getModel(),
  };
  if (fcmToken) body.fcmToken = fcmToken;
  if (voipToken) body.voipToken = voipToken;
  if (Platform.OS === 'ios') body.apnsEnvironment = __DEV__ ? 'sandbox' : 'production';

  const key = JSON.stringify(body);
  if (registered && key === lastSent) return;
  try {
    await authAxiosClient.post('/users/me/devices', body);
    registered = true;
    lastSent = key;
  } catch (error: any) {
    registered = false;
    callConsole.warn('[DeviceRegistration] register failed', error?.response?.status ?? error?.message);
  }
}

/** Android: logged out, a call push still addressed to this phone does not ring. */
function setNativeCallsEnabled(enabled: boolean) {
  if (Platform.OS === 'android') NativeModules.IncomingCallNotification?.setCallsEnabled(enabled);
}

export const deviceRegistration = {
  /** True once the backend has this install's push token(s), i.e. it will be pushed for calls. */
  isRegistered: () => registered,

  /** iOS: the backend has this phone's VoIP token, so calls ring on CallKit. */
  hasVoip: () => registered && !!voipToken,

  setFcmToken(token: string | null) {
    fcmToken = token;
    return register();
  },

  setVoipToken(token: string | null) {
    voipToken = token;
    return register();
  },

  /** Registration only runs while logged in (the endpoint needs the user's JWT). */
  setLoggedIn(value: boolean) {
    loggedIn = value;
    setNativeCallsEnabled(value);
    if (!value) return Promise.resolve();
    lastSent = '';
    return register();
  },

  /** Call on logout, BEFORE the auth token is cleared. */
  async unregister(): Promise<void> {
    registered = false;
    loggedIn = false;
    lastSent = '';
    // Stops the native ring at once, even if the DELETE below fails (offline, or the
    // session already expired - a 401 logout).
    setNativeCallsEnabled(false);
    // Always tried: this launch's register may have failed while an earlier one worked.
    try {
      await authAxiosClient.delete(`/users/me/devices/${encodeURIComponent(getDeviceId())}`);
    } catch (error: any) {
      callConsole.warn('[DeviceRegistration] unregister failed', error?.response?.status ?? error?.message);
    }
  },
};
