import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, radii, shadows, type as typeStyles } from '../../theme';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  /** A filter chip that toggles. Without onPress it is a static tag. */
  onPress?: () => void;
  selected?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Filter chip (Home spotlight filters) or static tag (Review's "60 min slot").
 * A newly selected chip fills saffron with a small overshoot.
 */
export function Chip({ label, onPress, selected = false, icon, disabled, style, accessibilityLabel }: Props) {
  const pop = useSharedValue(1);
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (selected && !wasSelected.current) {
      const reduceMotion = ReduceMotion.System;
      pop.value = withSequence(
        withTiming(0.9, { duration: 80, easing: motion.out, reduceMotion }),
        withTiming(1.06, { duration: 100, easing: motion.out, reduceMotion }),
        withTiming(1, { duration: 80, easing: motion.out, reduceMotion }),
      );
    }
    wasSelected.current = selected;
  }, [selected, pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const content = (
    <>
      {icon}
      <Text
        numberOfLines={1}
        style={[styles.label, { color: selected ? colors.onBrand : colors.text }]}>
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.base, styles.tag, style]}>{content}</View>;
  }

  return (
    <Animated.View style={popStyle}>
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={4}
        style={[styles.base, styles.filter, selected && styles.selected, disabled && styles.disabled, style]}>
        {content}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: radii.pill,
  },
  filter: {
    height: 36,
    paddingHorizontal: 14,
    boxShadow: shadows.ringHi,
  },
  selected: {
    backgroundColor: colors.brand,
    boxShadow: 'none',
  },
  tag: {
    height: 30,
    paddingHorizontal: 12,
    backgroundColor: colors.s2,
    boxShadow: shadows.ring,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...typeStyles.label,
    fontSize: 13,
  },
});
