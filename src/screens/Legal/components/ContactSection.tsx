import React, { useCallback } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import type { LegalContact, LegalLink } from '../types';
import { styles } from '../styles';

type Props = {
  contact?: LegalContact;
  links?: LegalLink[];
};

function ContactSection({ contact, links }: Props): React.ReactElement | null {
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

  if (!contact && (!links || links.length === 0)) {
    return null;
  }

  return (
    <View>
      {contact ? (
        <View style={styles.contactRow} accessibilityRole="text">
          {contact.prefix ? (
            <Text
              style={styles.contactPrefix}
              allowFontScaling
              maxFontSizeMultiplier={1.4}
            >
              {contact.prefix}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Email ${contact.email}`}
            onPress={() => handleEmailPress(contact.email)}
            hitSlop={8}
          >
            <Text
              style={styles.contactEmail}
              allowFontScaling
              maxFontSizeMultiplier={1.4}
            >
              {contact.email}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {links?.map((link) => (
        <Pressable
          key={link.url}
          accessibilityRole="link"
          accessibilityLabel={link.text}
          onPress={() => handleLinkPress(link.url)}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.link} allowFontScaling maxFontSizeMultiplier={1.4}>
            {link.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default React.memo(ContactSection);
