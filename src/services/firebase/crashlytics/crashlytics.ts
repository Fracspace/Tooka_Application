import crashlytics from '@react-native-firebase/crashlytics';

import { CrashlyticsKey } from './crashlyticsKeys';

class CrashlyticsService {
  async log(message: string) {
    try {
      if (__DEV__) {
        console.log('[Crashlytics]', message);
      }

      await crashlytics().log(message);
    } catch (e) {
      if (__DEV__) {
        console.log(e);
      }
    }
  }

  async recordError(error: unknown) {
    try {
      const err =
        error instanceof Error
          ? error
          : new Error(String(error));

      await crashlytics().recordError(err);
    } catch (e) {
      if (__DEV__) {
        console.log(e);
      }
    }
  }

  async setUserId(userId: string) {
    try {
      await crashlytics().setUserId(userId);
    } catch {}
  }

  async setCustomKey(
    key: CrashlyticsKey,
    value: string | number | boolean,
  ) {
    try {
      await crashlytics().setAttribute(key, String(value));
    } catch {}
  }

  async clearUser() {
    try {
      await crashlytics().setUserId('');
      await crashlytics().setAttribute('user_id', '');
    } catch {}
  }

  testCrash() {
    crashlytics().crash();
  }
}

export default new CrashlyticsService();