import messaging from '@react-native-firebase/messaging';

import { refreshPendingReviews } from '../../reviewRequestBus';

class NotificationHandler {
  /** Returns the unsubscribe function; call it when the listener's owner unmounts. */
  initialize(): () => void {
    return messaging().onMessage(async remoteMessage => {
      if (__DEV__) {
        console.log(
          '[FCM] Foreground Notification',
          JSON.stringify(remoteMessage, null, 2),
        );
      }
      // FCM shows no banner in the foreground, so surface the feedback popup directly.
      if (remoteMessage?.data?.type === 'review_request') {
        refreshPendingReviews();
      }
    });
  }
}

export default new NotificationHandler();