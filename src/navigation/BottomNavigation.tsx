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

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/Home/HomeScreen';
import ExploreScreen from '../screens/Explore/ExploreScreen';
import AllBookingScreen from '../screens/Booking/AllBooking';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import { useAuth } from '../context/AuthContext';
import AuthenticationScreen from '../authentication/screens/AuthenticationScreen';
import { TabBar, type IconName } from '../components/ui';
import { ProfileSkeleton } from '../screens/Profile/components/ProfileSkeleton';
import { colors } from '../theme';

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

const TAB_ICONS: Record<string, IconName> = {
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

  const activeKey = state.routes[state.index].key;
  return (
    <TabBar
      items={state.routes.map(route => {
        const label = labelFor(route);
        return { key: route.key, label, icon: TAB_ICONS[label] ?? 'home' };
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

function BookingTabScreen(): React.ReactElement {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <ProfileSkeleton />;
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
      <Tab.Screen
        name="Profile"
        component={ProfileTabScreen}
        // The dark page colour behind the tab, so its first visit never flashes
        // the navigator's default light background before the screen draws.
        options={{ sceneStyle: { backgroundColor: colors.bg } }}
      />
    </Tab.Navigator>
  );
}
