import analytics from '@react-native-firebase/analytics';

import { AnalyticsEvent } from './analyticsEvents';

class AnalyticsService {
  async logEvent(
    event: AnalyticsEvent,
    params?: Record<string, string | number | boolean>,
  ) {
    try {
      await analytics().logEvent(event, params);
    } catch (error) {
      if (__DEV__) {
        console.log('[Analytics]', error);
      }
    }
  }

//   async logScreen(screen: AnalyticsScreen) {
//     try {
//       await analytics().logScreenView({
//         screen_name: screen,
//         screen_class: screen,
//       });
//     } catch (error) {
//       if (__DEV__) {
//         console.log('[Analytics]', error);
//       }
//     }
//   }

    private lastScreen?: string;

    async logScreen(screen: string) {
        try {
            if (this.lastScreen === screen) {
                return;
            }

            this.lastScreen = screen;

            if (__DEV__) {
                console.log('[Analytics] Screen:', screen);
            }

            await analytics().logScreenView({
                screen_name: screen,
                screen_class: screen,
            });
        } catch (error) {
            if (__DEV__) {
                console.log(error);
            }
        }
    }

  async setUserId(userId: string) {
    try {
      await analytics().setUserId(userId);
    } catch (error) {
      if (__DEV__) {
        console.log(error);
      }
    }
  }

  async setUserProperty(name: string, value: string) {
    try {
      await analytics().setUserProperty(name, value);
    } catch (error) {
      if (__DEV__) {
        console.log(error);
      }
    }
  }

  async reset() {
    try {
      await analytics().resetAnalyticsData();
    } catch (error) {
      if (__DEV__) {
        console.log(error);
      }
    }
  }
}

export default new AnalyticsService();