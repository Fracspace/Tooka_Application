import React from 'react';
import { StatusBar, StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../../theme';
import { Haze } from './Haze';

type Props = ViewProps & {
  /** Draw the saffron glow at the top. */
  haze?: boolean;
};

/** The dark v4 page: espresso background and light status-bar text. */
export function Screen({ haze = false, style, children, ...rest }: Props) {
  return (
    <View {...rest} style={[styles.screen, style]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      {haze ? <Haze /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
