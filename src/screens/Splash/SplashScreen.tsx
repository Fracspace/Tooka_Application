import React, { useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
} from 'react-native';
import { AmbientVideo } from '../../components/ui/AmbientVideo';
import BootSplash from 'react-native-bootsplash';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getOnboarding } from '../../utils/onboardingStorage';

type SplashScreenNavigationProp =
  NativeStackNavigationProp<
    RootStackParamList,
    'Splash'
  >;

const SPLASH_FALLBACK_TIMEOUT_MS = 5000;

const SplashScreen: React.FC = () => {
  const navigation =
    useNavigation<SplashScreenNavigationProp>();

  const hasNavigated = useRef(false);

  const navigateToApp = useCallback(async () => {
    if (hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;

    try {
      const onboarding = await getOnboarding();
      if (onboarding && onboarding.completed) {
        navigation.replace('BottomNavigation');
      } else {
        navigation.replace('Onboarding');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Splash onboarding check failed:', error);
      }
      navigation.replace('Onboarding');
    }
  }, [navigation]);

  useEffect(() => {
    BootSplash.hide({
      fade: true,
    });

    const fallbackTimer = setTimeout(
      navigateToApp,
      SPLASH_FALLBACK_TIMEOUT_MS,
    );

    return () => clearTimeout(fallbackTimer);
  }, [navigateToApp]);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

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
