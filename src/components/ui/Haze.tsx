import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../../theme';
import { gradients } from '../../theme';

type Props = {
  height?: number;
};

/**
 * The soft saffron glow at the top of a screen. It breathes slowly (8s) unless
 * the phone asks for reduced motion. Place it first inside the screen.
 */
export function Haze({ height = 320 }: Props) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = 0.85;
    opacity.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View pointerEvents="none" style={[styles.haze, { height }, style]} />;
}

const styles = StyleSheet.create({
  haze: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    experimental_backgroundImage: gradients.haze,
  },
});
