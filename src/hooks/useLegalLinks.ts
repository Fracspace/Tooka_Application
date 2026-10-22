import { useCallback } from 'react';
import { Linking } from 'react-native';

/** Opens the email address and web links in the legal pages. */
export function useLegalLinks() {
  const handleEmailPress = useCallback(async (email: string) => {
    const url = `mailto:${email}`;

    // Open directly: canOpenURL reports false for mailto: on iOS/Android 11+ unless
    // the scheme is declared, which made this link silently do nothing.
    try {
      await Linking.openURL(url);
    } catch {
      // Silently ignore — email client may be unavailable.
    }
  }, []);

  const handleLinkPress = useCallback(async (url: string) => {
    // Open directly: canOpenURL reports false for mailto: on iOS/Android 11+ unless
    // the scheme is declared, which made this link silently do nothing.
    try {
      await Linking.openURL(url);
    } catch {
      // Silently ignore — browser may be unavailable.
    }
  }, []);

  return { handleEmailPress, handleLinkPress };
}
