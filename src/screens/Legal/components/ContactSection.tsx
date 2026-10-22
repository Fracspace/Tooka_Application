import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { LegalContact, LegalLink } from '../types';
import { styles } from '../styles';
import { useLegalLinks } from '../../../hooks/useLegalLinks';

type Props = {
  contact?: LegalContact;
  links?: LegalLink[];
};

function ContactSection({ contact, links }: Props): React.ReactElement | null {
  const { handleEmailPress, handleLinkPress } = useLegalLinks();

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
