import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion, radii, shadows, type as typeStyles } from '../../theme';
import { Icon, type IconName } from './Icon';

export type TabBarItem = {
  key: string;
  label: string;
  icon: IconName;
};

type Props = {
  items: TabBarItem[];
  activeKey: string;
  onPress: (key: string) => void;
  onLongPress?: (key: string) => void;
};

export const TAB_BAR_HEIGHT = 68;

/** Bottom space a screen should leave so its content clears the floating bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + 16;
}

const tabBarBottom = (insetBottom: number) => Math.max(16, insetBottom - 10);

/**
 * The floating v4 tab bar. It only draws the tabs: the navigator decides what a
 * press does, so it can sit behind the existing tab bar's logic unchanged.
 */
export function TabBar({ items, activeKey, onPress, onLongPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { bottom: tabBarBottom(insets.bottom) }]}>
      {items.map(item => (
        <Tab
          key={item.key}
          item={item}
          focused={item.key === activeKey}
          onPress={() => onPress(item.key)}
          onLongPress={onLongPress ? () => onLongPress(item.key) : undefined}
        />
      ))}
    </View>
  );
}

function Tab({
  item,
  focused,
  onPress,
  onLongPress,
}: {
  item: TabBarItem;
  focused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const indicator = useSharedValue(focused ? 1 : 0);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    indicator.value = withTiming(focused ? 1 : 0, {
      duration: motion.select,
      easing: motion.spring,
      reduceMotion: ReduceMotion.System,
    });
  }, [focused, indicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicator.value,
    transform: [{ scaleX: indicator.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  const spring = { damping: 14, stiffness: 320, reduceMotion: ReduceMotion.System };
  const color = focused ? colors.brand : colors.subtle;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        iconScale.value = withSpring(0.8, spring);
      }}
      onPressOut={() => {
        iconScale.value = withSpring(1, spring);
      }}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: focused }}
      style={styles.tab}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      <Animated.View style={iconStyle}>
        <Icon name={item.icon} size={22} color={color} />
      </Animated.View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.card,
    // The design blurs what is behind the bar; without a blur library it stays nearly solid.
    backgroundColor: 'rgba(29,25,21,0.97)',
    boxShadow: shadows.tabBar,
  },
  tab: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  indicator: {
    position: 'absolute',
    top: 8,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand,
    boxShadow: '0 0 12px rgba(255,176,46,0.7)',
  },
  label: {
    ...typeStyles.tab,
  },
});
