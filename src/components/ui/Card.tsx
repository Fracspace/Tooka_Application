import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, gradients, radii, shadows } from '../../theme';

type Variant = 'flat' | 'raised' | 'brand';

type Props = ViewProps & {
  /**
   * flat: plain surface (price breakdown, outlets). raised: a soft top-down
   * gradient (Home tiles). brand: the saffron-tinted "next visit" card.
   */
  variant?: Variant;
};

export function Card({ variant = 'flat', style, ...rest }: Props) {
  return <View {...rest} style={[styles.base, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.card,
    backgroundColor: colors.s1,
    boxShadow: shadows.card,
  },
  flat: {},
  raised: {
    experimental_backgroundImage: gradients.raised,
  },
  brand: {
    experimental_backgroundImage: gradients.brandCard,
    boxShadow: 'inset 0 0 0 1px rgba(255,176,46,0.3), 0 14px 30px rgba(255,176,46,0.08)',
  },
});
