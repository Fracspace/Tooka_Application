import React, { useEffect, useRef } from 'react';
import { Animated, Image, ImageSourcePropType, Pressable, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { colors, styles } from '../styles';

type Props = {
  source: ImageSourcePropType;
  compact?: boolean;
  onEditPress?: () => void;
};

function ProfileAvatar({ source, compact, onEditPress }: Props): React.ReactElement {
  const scale = useRef(new Animated.Value(0.94)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const editScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 6,
      }),
    ]).start();
  }, [opacity, scale]);

  const animateEdit = (value: number) => {
    Animated.spring(editScale, {
      toValue: value,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  const avatarStyle: ViewStyle[] = [
    styles.avatarWrap,
    compact ? styles.compactAvatar : undefined,
  ].filter(Boolean) as ViewStyle[];

  return (
    <Animated.View style={[avatarStyle, { opacity, transform: [{ scale }] }]}>
      <Image
        source={source}
        style={[styles.avatarImage, compact && styles.compactAvatarImage]}
        resizeMode="cover"
      />
      <Animated.View style={{ transform: [{ scale: editScale }] }}>
        <Pressable
          onPress={onEditPress}
          onPressIn={() => animateEdit(0.94)}
          onPressOut={() => animateEdit(1)}
          style={styles.editButton}
          hitSlop={15}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Ionicons name="create-outline" size={15} color={colors.white} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default React.memo(ProfileAvatar);
