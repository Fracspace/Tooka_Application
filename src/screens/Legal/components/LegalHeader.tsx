import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, StatusBar, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';

import { colors, styles } from '../styles';

type Props = {
  title: string;
  onBack: () => void;
};

function LegalHeader({ title, onBack }: Props): React.ReactElement {
  const [headerSize, setHeaderSize] = useState({ width: 0, height: 0 });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHeaderSize({ width, height });
  }, []);

  return (
    <View
      style={[styles.header, { }]}
      onLayout={handleLayout}
      accessibilityRole="header"
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {headerSize.width > 0 && headerSize.height > 0 ? (
        <Svg
          width={headerSize.width}
          height={headerSize.height}
          style={styles.headerGradient}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="legalHeaderGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="1" stopColor={colors.primaryLight} />
            </LinearGradient>
          </Defs>
          <Rect
            width={headerSize.width}
            height={headerSize.height}
            fill="url(#legalHeaderGradient)"
          />
        </Svg>
      ) : null}

      <View style={styles.headerCircleLarge} pointerEvents="none" />
      <View style={styles.headerCircleSoft} pointerEvents="none" />
      <View style={styles.headerDotOne} pointerEvents="none" />
      {/* <View style={styles.headerDotTwo} pointerEvents="none" /> */}

      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={10}
        >
          <Icon name="chevron-back" size={22} color={colors.white} />
        </Pressable>

        <Text
          style={styles.headerTitle}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

export default React.memo(LegalHeader);
