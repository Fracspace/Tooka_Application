import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../../theme';
import { colors, gradients, radii, shadows, type as typeStyles } from '../../theme';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'cream' | 'outline' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  /**
   * primary: saffron (Book, Pay, Done). secondary: dark surface. cream: light
   * surface with dark text (Spa Details "Directions"). outline: a
   * saffron ring (Review's "Change"). ghost: text only ("View in My Bookings").
   */
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  iconLeft?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** The light that sweeps across primary buttons. On by default for primary. */
  sheen?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconLeft,
  loading = false,
  disabled = false,
  sheen,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const inactive = disabled || loading;
  const showSheen = (sheen ?? variant === 'primary') && !inactive;
  const textColor =
    variant === 'primary' ? colors.onBrand : variant === 'cream' ? colors.ink : variant === 'outline' ? colors.brand2 : variant === 'ghost' ? colors.muted : colors.text;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.base, sizeStyles[size], variantStyles[variant], disabled && styles.disabled, style]}>
      {showSheen ? <Sheen /> : null}
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {iconLeft}
          <Text
            numberOfLines={1}
            style={[size === 'sm' ? styles.labelSm : typeStyles.button, size === 'lg' && styles.labelLg, { color: textColor }]}>
            {label}
          </Text>
          {icon}
        </>
      )}
    </PressableScale>
  );
}

const SHEEN_WIDTH = 60;
const SWEEP_MS = 1368; // 38% of the design's 3.6s cycle
const PAUSE_MS = 2232;

/** A soft band of light that crosses the button every few seconds. */
function Sheen() {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || width === 0) {
      return;
    }
    progress.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: PAUSE_MS }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, width, progress]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SHEEN_WIDTH - 30 + progress.value * (width + SHEEN_WIDTH + 60) },
      { skewX: '-20deg' },
    ],
  }));

  if (reduceMotion) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.sheen, bandStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.45,
  },
  labelLg: {
    fontSize: 17,
  },
  labelSm: {
    ...typeStyles.label,
    fontSize: 13,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SHEEN_WIDTH,
    experimental_backgroundImage: gradients.sheen,
  },
});

const sizeStyles = StyleSheet.create({
  lg: { height: 56, paddingHorizontal: 22, borderRadius: radii.xl },
  md: { height: 48, paddingHorizontal: 18, borderRadius: radii.md },
  sm: { height: 36, paddingHorizontal: 14, borderRadius: radii.pill, gap: 6 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.brand, boxShadow: shadows.cta },
  secondary: { backgroundColor: colors.s2, boxShadow: shadows.ringHi },
  cream: { backgroundColor: colors.text },
  outline: { boxShadow: shadows.brandRingStrong },
  ghost: {},
});
