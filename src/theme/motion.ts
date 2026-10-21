import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from './theme';

/**
 * Whether the phone asks for less motion (iOS Reduce Motion, Android Remove
 * animations). Unlike Reanimated's hook, this follows changes while the app is
 * open, so looping animations can stop straight away.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (mounted) {
          setReduce(value);
        }
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}

/**
 * Entrance: fades in while rising 16px. Use as `entering={rise(i * 60)}`.
 * Reanimated skips it when the phone asks for reduced motion.
 */
export const rise = (delay = 0, distance = 16) =>
  FadeInDown.duration(motion.rise)
    .delay(delay)
    .easing(motion.out)
    .withInitialValues({ opacity: 0, transform: [{ translateY: distance }] })
    .reduceMotion(ReduceMotion.System);

/** Entrance for a whole screen: a short fade and a 10px rise. */
export const screenIn = () => rise(0, 10).duration(motion.enter);

/** Entrance for images: a plain fade. */
export const fadeIn = (delay = 0) =>
  FadeIn.duration(motion.image).delay(delay).easing(motion.out).reduceMotion(ReduceMotion.System);

/**
 * Press feedback: shrinks slightly while held. Spread the handlers onto a
 * Pressable and the style onto the Animated view that should shrink.
 */
export function usePressScale(scaleTo: number = motion.pressScale) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const config = { duration: motion.press, easing: motion.out, reduceMotion: ReduceMotion.System };
  const onPressIn = () => {
    scale.value = withTiming(scaleTo, config);
  };
  const onPressOut = () => {
    scale.value = withTiming(1, config);
  };

  return { style, onPressIn, onPressOut };
}
