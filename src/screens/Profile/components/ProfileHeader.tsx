import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotificationButton from './NotificationButton';
import { colors, styles } from '../styles';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  onNotificationPress?: () => void;
};

function ProfileHeader({ onNotificationPress }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [headerSize, setHeaderSize] = useState({ width: 0, height: 0 });
  
    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setHeaderSize({ width, height });
    }, []);
  

  return (
    <View
          style={[styles.header, { paddingTop: insets.top + 20 }]}
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


      <View style={styles.headerTopRow}>
        <View>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>Manage your account and preferences</Text>
        </View>
        <NotificationButton onPress={onNotificationPress} />
      </View>
    </View>
  );
}

export default React.memo(ProfileHeader);
