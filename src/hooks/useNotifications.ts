import { useEffect } from 'react';

import {
  FirebaseMessaging,
  NotificationHandler,
  NotificationNavigation,
  NotificationPermission,
} from '../services/firebase/messaging';
import { toNotificationPayload } from '../services/firebase/messaging/notificationNavigation';
import { saveFcmToken } from '../utils/fcmStorage';
import { syncProfileMetadata } from '../services/profile/profileSync';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';

export default function useNotifications() {
  const { setProfile } = useProfile();
  const { isLoggedIn } = useAuth();

  // Fetch the push token and attach it to the signed-in profile. Re-runs on login:
  // logout deletes this device's token (so the previous user stops receiving pushes
  // here), and the next account needs a fresh one synced to its profile.
  useEffect(() => {
    let cancelled = false;

    const initializeNotifications = async () => {
      try {
        const granted = await NotificationPermission.requestPermission();
        if (!granted) {
          if (__DEV__) {
            console.log('[FCM] Notification permission denied');
          }
          return;
        }

        const token = await FirebaseMessaging.getToken();
        if (!token || cancelled) {
          return;
        }
        await saveFcmToken(token);

        if (!isLoggedIn) {
          return;
        }
        // syncProfileMetadata dedupes onto an in-flight sync, which may have read
        // storage before the token above was saved. Let that one finish, then sync
        // again so the token is definitely sent.
        await syncProfileMetadata().catch(() => undefined);
        const { updated, profile } = await syncProfileMetadata();
        if (!cancelled && updated && profile) {
          setProfile(profile);
        }
      } catch (error) {
        if (__DEV__) {
          console.log('[FCM] Initialization Error', error);
        }
      }
    };

    initializeNotifications();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, setProfile]);

  useEffect(() => {
    const unsubscribeForegroundMessages = NotificationHandler.initialize();

    // Taps: from the background, and the one that launched a killed app. Both used
    // to just open the app on whatever screen it started on.
    const unsubscribeOpened = FirebaseMessaging.onNotificationOpenedApp((message) => {
      NotificationNavigation.navigate(toNotificationPayload(message?.data));
    });
    FirebaseMessaging.getInitialNotification().then((message) => {
      if (message) {
        NotificationNavigation.navigate(toNotificationPayload(message.data));
      }
    });

    const unsubscribeTokenRefresh =
      FirebaseMessaging.onTokenRefresh(async (token) => {
        if (token) {
          await saveFcmToken(token);
        }

        try {
          const { updated, profile } = await syncProfileMetadata();
          if (updated && profile) {
            setProfile(profile);
          }
        } catch (error) {
          if (__DEV__) {
            console.log('[FCM] Token refresh sync error:', error);
          }
        }
      });

    return () => {
      unsubscribeForegroundMessages();
      unsubscribeOpened();
      unsubscribeTokenRefresh();
    };
  }, [setProfile]);
}
