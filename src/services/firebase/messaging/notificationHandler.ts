import messaging from '@react-native-firebase/messaging';

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
    });
  }
}

export default new NotificationHandler();