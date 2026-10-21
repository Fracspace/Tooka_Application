import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, shadows } from '../../theme';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type Variant = 'solid' | 'soft' | 'glass';

type Props = {
  onPress?: () => void;
  accessibilityLabel: string;
  /**
   * solid: dark surface (Review header). soft: translucent on the page
   * (Home header). glass: dark translucent over photos (Spa Details hero).
   */
  variant?: Variant;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A 44pt round button for header actions. */
export function RoundButton({ onPress, accessibilityLabel, variant = 'solid', children, style, testID }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      hitSlop={6}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, styles[variant], style]}>
      {children}
    </PressableScale>
  );
}

type BackProps = Omit<Props, 'children' | 'accessibilityLabel'> & {
  accessibilityLabel?: string;
};

/** The round back button at the top left of v4 screens. */
export function BackButton({ accessibilityLabel = 'Go back', ...rest }: BackProps) {
  return (
    <RoundButton accessibilityLabel={accessibilityLabel} {...rest}>
      <Icon name="back" size={20} />
    </RoundButton>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: colors.s1,
    boxShadow: shadows.ringHi,
  },
  soft: {
    backgroundColor: colors.soft,
    boxShadow: shadows.ring,
  },
  glass: {
    backgroundColor: colors.glass,
    boxShadow: `inset 0 0 0 1px ${colors.glassEdge}`,
  },
});
