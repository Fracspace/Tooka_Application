import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { CallState } from '../../../types/call';

interface CallAvatarProps {
  avatarUrl?: string;
  name: string;
  state: CallState;
}

export const CallAvatar: React.FC<CallAvatarProps> = React.memo(({ avatarUrl, name, state }) => {
  const pulseScale1 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0.5);
  
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0.3);

  const isRinging = state === CallState.RINGING || state === CallState.OUTGOING || state === CallState.INCOMING;

  useEffect(() => {
    if (isRinging) {
      pulseScale1.value = withRepeat(
        withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      pulseOpacity1.value = withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );

      // Staggered second pulse
      setTimeout(() => {
        if (!isRinging) return;
        pulseScale2.value = withRepeat(
          withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
          -1,
          false
        );
        pulseOpacity2.value = withRepeat(
          withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
          -1,
          false
        );
      }, 500);
    } else {
      pulseScale1.value = withTiming(1);
      pulseOpacity1.value = withTiming(0);
      pulseScale2.value = withTiming(1);
      pulseOpacity2.value = withTiming(0);
    }
  }, [isRinging, pulseScale1, pulseOpacity1, pulseScale2, pulseOpacity2]);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale1.value }],
    opacity: pulseOpacity1.value,
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale2.value }],
    opacity: pulseOpacity2.value,
  }));

  // Helper to get initials
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pulseCircle, animatedStyle2]} />
      <Animated.View style={[styles.pulseCircle, animatedStyle1]} />
      
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.fallbackAvatar]}>
            <Animated.Text style={styles.initials}>{initials}</Animated.Text>
          </View>
        )}
      </View>
    </View>
  );
});

const SIZE = 120;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE * 2,
    height: SIZE * 2,
  },
  pulseCircle: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#FFB02E',
  },
  avatarContainer: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#2A2A2A',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fallbackAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A4A4A',
  },
  initials: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
  },
});
