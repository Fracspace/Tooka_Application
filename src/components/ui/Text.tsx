import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { colors, type as typeStyles } from '../../theme';

type Props = TextProps & {
  variant?: keyof typeof typeStyles;
  color?: string;
};

/** Text in one of the v4 styles. Defaults to body text in the warm white. */
export function Text({ variant = 'body', color = colors.text, style, ...rest }: Props) {
  return <RNText {...rest} style={[typeStyles[variant], { color }, style]} />;
}
