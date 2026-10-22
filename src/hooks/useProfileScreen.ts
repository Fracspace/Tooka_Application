import { useCallback, useMemo, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';

import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useMyBookings } from './useMyBookings';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { UserProfile } from '../types/profile';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BottomNavigation'>;

// Read from the installed binary. This was the literal '1.0.5', which would have
// kept saying 1.0.5 after every release.
export const APP_VERSION = `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`;
const SUPPORT_PHONE = 'tel:+919247952343';
const SUPPORT_EMAIL = 'mailto:hello@tooka.app';

function normalizePhone(phoneNumber?: string | null): string {
  const trimmed = phoneNumber?.trim();

  if (!trimmed) {
    return 'Not provided';
  }

  return trimmed.startsWith('+') ? trimmed : `+91 ${trimmed}`;
}

/** The details that make a profile complete, in the order the hint asks for them. */
const COMPLETION_STEPS: { hint: string; done: (profile: UserProfile) => boolean }[] = [
  { hint: 'Add your name', done: (p) => !!(p.fullName?.trim() || p.displayName?.trim() || p.username?.trim()) },
  { hint: 'Add your email', done: (p) => !!p.email?.trim() },
  { hint: 'Add your gender', done: (p) => !!p.gender },
  { hint: 'Add your birthday', done: (p) => !!p.dateOfBirth },
  { hint: 'Add your address', done: (p) => !!p.residentialLocation },
];

const toAmount = (value: unknown): number => {
  const amount = typeof value === 'string' ? Number(value) : value;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
};

/**
 * Data and actions for the Profile screen, shared by the old and v4 layouts.
 */
export function useProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { user, logout, deleteAccount } = useAuth();
  const { profile, loading: profileLoading, clearProfile } = useProfile();

  const isLoggingOut = useRef<boolean>(false);
  const isDeletingAccount = useRef<boolean>(false);

  const displayName =
    profile?.fullName?.trim() ||
    profile?.displayName?.trim() ||
    profile?.username?.trim() ||
    user?.userName?.trim() ||
    user?.fullName?.trim() ||
    'No Name';
  const displayEmail = profile?.email?.trim() || user?.email?.trim() || 'Add your email';
  const displayPhone = normalizePhone(profile?.phone ?? user?.phone ?? user?.phoneNumber);
  const avatarSource = profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined;

  const showUnavailableToast = useCallback((title: string) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: 'This feature will be available soon.',
    });
  }, []);

  const openExternalUrl = useCallback(async (url: string, fallbackTitle: string) => {
    // Open directly: canOpenURL returns false for tel:/mailto: unless the scheme is
    // declared in Info.plist / the Android manifest, and openURL rejects when
    // nothing can handle the link, which lands in the catch.
    try {
      await Linking.openURL(url);
    } catch {
      showUnavailableToast(fallbackTitle);
    }
  }, [showUnavailableToast]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut.current) {
      return;
    }

    isLoggingOut.current = true;

    try {
      await logout();

      navigation.reset({
        index: 0,
        routes: [{ name: 'BottomNavigation' }],
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Logout failed',
        text2: 'Please try again.',
      });
    } finally {
      isLoggingOut.current = false;
    }
  }, [logout, navigation]);

  const handleDeleteAccount = useCallback(() => {
    if (isDeletingAccount.current) {
      return;
    }

    isDeletingAccount.current = true;

    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            isDeletingAccount.current = false;
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              clearProfile();

              navigation.reset({
                index: 0,
                routes: [{ name: 'BottomNavigation' }],
              });

              Toast.show({
                type: 'success',
                text1: 'Account Deleted',
                text2: 'Your account has been deleted successfully.',
              });
            } catch (error: any) {
              const errorMessage =
                error?.response?.data?.message ||
                error?.message ||
                'Please try again later.';

              Toast.show({
                type: 'error',
                text1: 'Delete failed',
                text2: errorMessage,
              });
            } finally {
              isDeletingAccount.current = false;
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          isDeletingAccount.current = false;
        },
      },
    );
  }, [clearProfile, deleteAccount, navigation]);

  const handleRateApp = useCallback(() => {
    if (Platform.OS === 'ios') {
      openExternalUrl('https://apps.apple.com/in/app/tooka-near-you/id6784173654', 'Rate our App')
    } else if (Platform.OS === 'android') {
      openExternalUrl('https://play.google.com/store/apps/details?id=com.fracspace.tooka', 'Rate our App')
    } else {
      showUnavailableToast('Rate our App')
    }
  }, [openExternalUrl, showUnavailableToast]);

  const openPaymentHistory = useCallback(() => navigation.navigate('NoPayment'), [navigation]);
  const openTerms = useCallback(() => navigation.navigate('TermsAndConditions'), [navigation]);
  const openPrivacy = useCallback(() => navigation.navigate('PrivacyPolicy'), [navigation]);
  const openRefund = useCallback(() => navigation.navigate('RefundPolicy'), [navigation]);
  const openEditProfile = useCallback(() => navigation.navigate('EditProfile'), [navigation]);
  const callSupport = useCallback(() => openExternalUrl(SUPPORT_PHONE, 'Call Support'), [openExternalUrl]);
  const emailSupport = useCallback(() => openExternalUrl(SUPPORT_EMAIL, 'Email Support'), [openExternalUrl]);
  const handleNotificationPress = useCallback(() => showUnavailableToast('Notifications'), [showUnavailableToast]);

  // Share of the profile that is filled in, and a hint for the first missing detail.
  const completion = useMemo(() => {
    if (!profile) {
      return null;
    }
    const missing = COMPLETION_STEPS.filter((step) => !step.done(profile));
    return {
      percent: Math.round(((COMPLETION_STEPS.length - missing.length) / COMPLETION_STEPS.length) * 100),
      hint: missing[0]?.hint ?? null,
    };
  }, [profile]);

  // Booking totals for the account card. Paid sums amount_paid on upcoming and
  // completed bookings; cancelled ones are left out because they may be refunded.
  const { upcomingBookings, completedBookings, hasFetchedOnce: bookingsLoaded } = useMyBookings();
  const bookingStats = useMemo(() => {
    if (!bookingsLoaded) {
      return null;
    }
    const paid = [...upcomingBookings, ...completedBookings].reduce(
      (sum, booking) => sum + toAmount(booking.raw?.amount_paid),
      0,
    );
    return { upcoming: upcomingBookings.length, visits: completedBookings.length, paid };
  }, [bookingsLoaded, completedBookings, upcomingBookings]);

  const openBookings = useCallback(
    () => navigation.navigate('BottomNavigation', { screen: 'Bookings' }),
    [navigation],
  );

  return {
    profile,
    profileLoading,
    displayName,
    displayEmail,
    displayPhone,
    avatarSource,
    appVersion: APP_VERSION,
    completion,
    bookingStats,
    openBookings,
    handleLogout,
    handleDeleteAccount,
    handleRateApp,
    handleNotificationPress,
    openPaymentHistory,
    openTerms,
    openPrivacy,
    openRefund,
    openEditProfile,
    callSupport,
    emailSupport,
  };
}
