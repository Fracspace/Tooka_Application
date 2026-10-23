import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

import {
  refreshPendingReviews,
  requestReviewForBooking,
} from '../../reviewRequestBus';

const isReviewRequest = (remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) =>
  remoteMessage?.data?.type === 'review_request' &&
  typeof remoteMessage.data.booking_id === 'string';

const handleNotificationOpen = (
  remoteMessage: FirebaseMessagingTypes.RemoteMessage | null,
) => {
  if (remoteMessage && isReviewRequest(remoteMessage)) {
    requestReviewForBooking(remoteMessage.data!.booking_id as string);
  }
};

class NotificationHandler {
  initialize() {
    messaging().onMessage(async remoteMessage => {
      console.log(
        '[FCM] Foreground Notification',
        JSON.stringify(remoteMessage, null, 2),
      );

      // FCM doesn't display pushes in the foreground, so surface the prompt directly.
      if (isReviewRequest(remoteMessage)) {
        refreshPendingReviews();
      }
    });

    // Tapped while the app was in the background.
    messaging().onNotificationOpenedApp(handleNotificationOpen);

    // Tapped while the app was killed.
    messaging().getInitialNotification().then(handleNotificationOpen);
  }
}

export default new NotificationHandler();
