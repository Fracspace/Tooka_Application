import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

class FirebaseMessagingService {
  /**
   * Returns the current FCM token.
   * On iOS, the device must first be registered with APNs.
   */
  async getToken(): Promise<string | null> {
    try {
      // iOS requires registration before requesting the FCM token.
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }

      return await messaging().getToken();
    } catch (error) {
      if (__DEV__) {
        console.error('[FCM] Failed to fetch token:', error);
      }
      return null;
    }
  }

  /**
   * Deletes the current FCM token.
   */
  async deleteToken(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }

      await messaging().deleteToken();
    } catch (error) {
      if (__DEV__) {
        console.error('[FCM] Failed to delete token:', error);
      }
    }
  }

  /** A notification tapped while the app was in the background. */
  onNotificationOpenedApp(
    listener: Parameters<ReturnType<typeof messaging>['onNotificationOpenedApp']>[0],
  ) {
    return messaging().onNotificationOpenedApp(listener);
  }

  /** The notification whose tap launched the app from a killed state, if any. */
  async getInitialNotification() {
    try {
      return await messaging().getInitialNotification();
    } catch {
      return null;
    }
  }

  /**
   * Listen for FCM token refresh.
   */
  onTokenRefresh(listener: (token: string) => void) {
    return messaging().onTokenRefresh(listener);
  }
}

export default new FirebaseMessagingService();