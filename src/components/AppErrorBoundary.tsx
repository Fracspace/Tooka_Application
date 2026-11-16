import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Crashlytics } from '../services/firebase/crashlytics';
import { colors, fonts } from '../theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches a render crash anywhere below it (a bad API field, a bad OTA bundle)
 * and shows a way back instead of a blank white screen. "Try again" remounts
 * the app tree; the providers reload the session from storage.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Crashlytics.log(`Render crash: ${info.componentStack ?? ''}`.slice(0, 1000));
    Crashlytics.recordError(error);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Sorry about that. We've been notified. Please try again.
        </Text>
        <Pressable
          onPress={this.handleRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.bg,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  pressed: { opacity: 0.85 },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
});
