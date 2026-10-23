import React, { createContext, useContext, useEffect } from 'react';
import { StyleSheet, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, radii, useReduceMotion } from '../../theme';

// Every bone pulses together off one shared value.
const PulseContext = createContext<SharedValue<number> | null>(null);

export function PulseProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduceMotion, pulse]);
  return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
}

export function Bone({
  w = '100%',
  h,
  r = radii.xs,
  style,
}: {
  w?: DimensionValue;
  h: DimensionValue;
  r?: number;
  style?: ViewStyle;
}) {
  const pulse = useContext(PulseContext);
  const animated = useAnimatedStyle(() => ({ opacity: pulse ? pulse.value : 1 }));
  return <Animated.View style={[styles.bone, { width: w, height: h, borderRadius: r }, style, animated]} />;
}

const styles = StyleSheet.create({
  bone: { backgroundColor: colors.s2 },
});
