import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '../../theme';
import { motion } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while held. Defaults to 0.97. */
  scaleTo?: number;
};

/** A Pressable that shrinks slightly while held, as every v4 control does. */
export function PressableScale({
  style,
  scaleTo = motion.pressScale,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const press = usePressScale(scaleTo);

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={e => {
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={e => {
        press.onPressOut();
        onPressOut?.(e);
      }}
      style={[style, press.style]}
    />
  );
}
