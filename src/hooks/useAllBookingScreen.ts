import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';

import { useMyBookings } from './useMyBookings';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { BookingSection } from '../types/booking';

export const BOOKING_TABS: Array<{ label: string; section: BookingSection }> = [
  { label: 'Upcoming', section: 'upcoming' },
  { label: 'Completed', section: 'completed' },
  { label: 'Cancelled', section: 'cancelled' },
];

/** My Bookings data and actions, shared by the old and v4 layouts. */
export function useAllBookingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<BookingSection>('upcoming');

  const {
    upcomingBookings,
    completedBookings,
    cancelledBookings,
    loading,
    refreshing,
    error,
    hasFetchedOnce,
    refetch,
    onRefresh,
  } = useMyBookings();

  const availableTabs = useMemo(() => {
    return BOOKING_TABS.filter((tab) => {
      switch (tab.section) {
        case 'upcoming':
          return upcomingBookings.length > 0;
        case 'completed':
          return completedBookings.length > 0;
        case 'cancelled':
          return cancelledBookings.length > 0;
        default:
          return false;
      }
    });
  }, [upcomingBookings.length, completedBookings.length, cancelledBookings.length]);

  const effectiveActiveTab = useMemo(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.section === activeTab)) {
      return availableTabs[0].section;
    }
    return activeTab;
  }, [activeTab, availableTabs]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.section === activeTab)) {
      setActiveTab(availableTabs[0].section);
    }
  }, [availableTabs, activeTab]);

  const activeBookings = useMemo(() => {
    switch (effectiveActiveTab) {
      case 'upcoming':
        return upcomingBookings;
      case 'completed':
        return completedBookings;
      case 'cancelled':
        return cancelledBookings;
      default:
        return upcomingBookings;
    }
  }, [effectiveActiveTab, upcomingBookings, completedBookings, cancelledBookings]);

  const tabCounts: Record<BookingSection, number> = {
    upcoming: upcomingBookings.length,
    completed: completedBookings.length,
    cancelled: cancelledBookings.length,
    'no-show': 0,
  };

  const handleTabPress = useCallback((section: BookingSection) => {
    setActiveTab(section);
  }, []);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const handleExploreNow = useCallback(() => {
    navigation.navigate('Home');
  }, [navigation]);

  // A failed refresh with bookings already on screen used to just stop the spinner.
  const hasBookings = availableTabs.length > 0;
  useEffect(() => {
    if (error && hasBookings) {
      Toast.show({ type: 'error', text1: "Couldn't refresh bookings", text2: error });
    }
  }, [error, hasBookings]);

  return {
    activeBookings,
    availableTabs,
    effectiveActiveTab,
    error,
    handleBack,
    handleExploreNow,
    handleTabPress,
    hasBookings,
    hasFetchedOnce,
    loading,
    onRefresh,
    refetch,
    refreshing,
    tabCounts,
  };
}
