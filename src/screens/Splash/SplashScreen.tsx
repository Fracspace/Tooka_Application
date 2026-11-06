import React, { useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
} from 'react-native';
import { AmbientVideo } from '../../components/ui/AmbientVideo';
import BootSplash from 'react-native-bootsplash';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions, useNavigation } from '@react-navigation/native';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getOnboarding } from '../../utils/onboardingStorage';
import { androidCallNotification } from '../../services/call/callPush';

type SplashScreenNavigationProp =
  NativeStackNavigationProp<
    RootStackParamList,
    'Splash'
  >;

const SPLASH_FALLBACK_TIMEOUT_MS = 5000;
// Opened by answering a call: no splash video; the call screen opens on top, and the app
// is set up underneath it so the call ending lands on home.
const CALL_LAUNCH_NAVIGATE_MS = 1200;

const SplashScreen: React.FC = () => {
  const navigation =
    useNavigation<SplashScreenNavigationProp>();

  const hasNavigated = useRef(false);
  const openedForCall = useRef(androidCallNotification?.wasOpenedForCall?.() === true).current;

  /**
   * Leave the splash for `name`. When a call screen already sits on top (the app was
   * opened by answering a call), swap only the splash underneath it: replace() would
   * replace the call screen, flashing home before the call screen came back.
   */
  const leaveSplashFor = useCallback(
    (name: 'BottomNavigation' | 'Onboarding') => {
      const state = navigation.getState();
      const top = state.routes[state.index];
      if (top?.name === 'Splash') {
        navigation.replace(name);
        return;
      }
      navigation.dispatch(
        CommonActions.reset({
          ...state,
          routes: state.routes.map(route =>
            route.name === 'Splash' ? { name } : route,
          ),
        } as any),
      );
    },
    [navigation],
  );

  const navigateToApp = useCallback(async () => {
    if (hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;

    try {
      const onboarding = await getOnboarding();
      if (onboarding && onboarding.completed) {
        leaveSplashFor('BottomNavigation');
      } else {
        leaveSplashFor('Onboarding');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Splash onboarding check failed:', error);
      }
      leaveSplashFor('Onboarding');
    }
  }, [leaveSplashFor]);

  useEffect(() => {
    BootSplash.hide({
      fade: true,
    });

    const fallbackTimer = setTimeout(
      navigateToApp,
      openedForCall ? CALL_LAUNCH_NAVIGATE_MS : SPLASH_FALLBACK_TIMEOUT_MS,
    );

    return () => clearTimeout(fallbackTimer);
  }, [navigateToApp, openedForCall]);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {!openedForCall && (
        <AmbientVideo
          source={require('../../assets/videos/splash.mp4')}
          style={styles.video}
          resizeMode="cover"
          repeat={false}
          playInBackground={false}
          playWhenInactive={false}
          preventsDisplaySleepDuringVideoPlayback={false}
          hideShutterView
          minLoadRetryCount={0}
          bufferConfig={{
            minBufferMs: 500,
            maxBufferMs: 1500,
            bufferForPlaybackMs: 250,
            bufferForPlaybackAfterRebufferMs: 500,
          }}
          onEnd={navigateToApp}
          onError={(error) => {
            console.log(
              'Splash Video Error =>',
              error,
            );
  
            navigateToApp();
          }}
        />
      )}
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
