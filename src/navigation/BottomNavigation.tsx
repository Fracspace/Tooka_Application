// ─────────────────────────────────────────────────────────────────────────────
// BottomNavigation
//
// Profile Tab Auth Gate:
//  • While auth state is hydrating (loading=true) → show a centered spinner
//    to prevent the Login ↔ Profile flicker during app startup.
//  • When user is NOT authenticated → render LoginScreen inline inside the
//    Profile tab (no navigation, no stack issues, no blank screens).
//  • When user IS authenticated → render ProfileScreen.
//
// This approach avoids navigation loops and works correctly after:
//  • OTP success from SpaDetails flow (Profile tab auto-reflects new auth state)
//  • App restart with existing session (hydration restores ProfileScreen)
//  • Logout (ProfileScreen swaps back to LoginScreen instantly)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import HomeScreen from '../screens/Home/HomeScreen';
import ExploreScreen from '../screens/Explore/ExploreScreen';
import AllBookingScreen from '../screens/Booking/AllBooking';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import { useAuth } from '../context/AuthContext';
import AuthenticationScreen from '../authentication/screens/AuthenticationScreen';
import { TabBar, type IconName } from '../components/ui';
import { isV4 } from '../config/uiFlags';

/** Explore can be reopened on a spa (e.g. after logging in to book it). */
export type ExploreParams =
  | {
      spaId?: string;
      selectedDateId?: string;
      selectedSlotId?: string;
      openBooking?: boolean;
    }
  | undefined;

export type BottomTabParamList = {
  Home: undefined;
  Explore: ExploreParams;
  Bookings: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const ICONS: Record<string, string> = {
  Home: 'home-outline',
  Explore: 'map-outline',
  Bookings: 'calendar-outline',
  Profile: 'person-outline',
};

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

function TabItem({ isFocused, label, iconName, onPress }: { isFocused: boolean; label: string; iconName: string; onPress: () => void }) {
  const focusAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, focusAnim]);

  const bgColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 176, 46, 0)', '#FFB02E'],
  });

  const iconColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFB02E', '#FFFFFF'],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      style={[
        styles.tabButton,
        { flex: 1 },
      ]}>
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: bgColor,
            maxWidth: '100%',
            paddingHorizontal: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 8],
            }),
            transform: [
              {
                scale: focusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          },
        ]}>
        <AnimatedIcon name={iconName} size={16} color={iconColor} />
        
        <Animated.View
          style={{
            flexShrink: 1,
            maxWidth: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 120],
            }),
            opacity: focusAnim,
            overflow: 'hidden',
            marginLeft: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 3],
            }),
          }}>
          <Text
            style={styles.activeLabel}
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit={false}>
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const V4_ICONS: Record<string, IconName> = {
  Home: 'home',
  Explore: 'explore',
  Bookings: 'bookings',
  Profile: 'profile',
};

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRoute = state.routes[state.index].name;
  const hideTabBar = currentRoute === 'Explore';

  if (hideTabBar) {
    return null;
  }

  const labelFor = (route: (typeof state.routes)[number]) => {
    const rawLabel =
      descriptors[route.key].options.title ??
      descriptors[route.key].options.tabBarLabel ??
      route.name;

    return typeof rawLabel === 'string' ? rawLabel : route.name;
  };

  const pressTab = (route: (typeof state.routes)[number], isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  if (isV4('tabBar')) {
    const activeKey = state.routes[state.index].key;
    return (
      <TabBar
        items={state.routes.map(route => {
          const label = labelFor(route);
          return { key: route.key, label, icon: V4_ICONS[label] ?? 'home' };
        })}
        activeKey={activeKey}
        onPress={key => {
          const route = state.routes.find(r => r.key === key);
          if (route) {
            pressTab(route, key === activeKey);
          }
        }}
      />
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: insets.bottom > 0 ? insets.bottom + 5 : 16,
        },
      ]}>
      <View style={styles.tabBackground}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const label = labelFor(route);
          const onPress = () => pressTab(route, isFocused);

          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              label={label}
              iconName={ICONS[label] || 'ellipse-outline'}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function BookingTabScreen(): React.ReactElement {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB02E" />
      </View>
    );
  }

  if (!isAuthenticated) {
    // Render LoginScreen in embedded mode — it hides the back button
    // and does not attempt to navigate backwards.
    return <AuthenticationScreen isEmbedded={true} />;
  }

  return <AllBookingScreen />;
}

// ─── Profile Tab Screen — Auth Gate ─────────────────────────────────────────

/**
 * Wraps the Profile tab content with an auth gate.
 *
 * States:
 *  1. loading=true  → Spinner (prevents hydration flicker)
 *  2. !isAuthenticated → LoginScreen in embedded mode (no back button)
 *  3. isAuthenticated  → ProfileScreen with real user data
 */
function ProfileTabScreen(): React.ReactElement {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB02E" />
      </View>
    );
  }

  if (!isAuthenticated) {
    // Render LoginScreen in embedded mode — it hides the back button
    // and does not attempt to navigate backwards.
    return <AuthenticationScreen isEmbedded={true} />;
  }

  return <ProfileScreen />;
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  tabBackground: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 5,

    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 5,
    minHeight: 44,
  },

  activeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#F6F1E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function BottomNavigation() {
  const { isAuthenticated } = useAuth();
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      {isAuthenticated &&
        <Tab.Screen name="Bookings" component={BookingTabScreen} />
      }
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
}
