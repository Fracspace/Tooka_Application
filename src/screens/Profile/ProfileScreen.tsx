// ─────────────────────────────────────────────────────────────────────────────
// ProfileScreen
//
// UI rebuilt to match the provided Figma while preserving existing behavior:
//  • Reads live user data from AuthContext.
//  • Navigates to NoPayment for Payment History.
//  • Keeps guarded logout and navigation reset to BottomNavigation.
//  • Keeps delete-account confirmation and TODO placeholder.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import ProfileHeader from './components/ProfileHeader';
import UserInfoCard from './components/UserInfoCard';
import SupportCard from './components/SupportCard';
import MenuList from './components/MenuList';
import VersionInfo from './components/VersionInfo';
import type { MenuItemConfig } from './components/MenuItem';
import { styles } from './styles';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BottomNavigation'>;

const APP_VERSION = '1.0.5';
const SUPPORT_PHONE = 'tel:+919247952343';
const SUPPORT_EMAIL = 'mailto:hello@tooka.app';

function normalizePhone(phoneNumber?: string | null): string {
  const trimmed = phoneNumber?.trim();

  if (!trimmed) {
    return 'Not provided';
  }

  return trimmed.startsWith('+') ? trimmed : `+91 ${trimmed}`;
}

const ProfileScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const navigation = useNavigation<ProfileNavigationProp>();
  const { user, logout, deleteAccount } = useAuth();
  const { profile, loading: profileLoading, clearProfile } = useProfile();

  const isLoggingOut = useRef<boolean>(false);
  const isDeletingAccount = useRef<boolean>(false);

  const displayName =
    profile?.fullName?.trim() ||
    profile?.fullName?.trim() ||
    profile?.username?.trim() ||
    user?.userName?.trim() ||
    user?.fullName?.trim() ||
    'No Name';
  const displayEmail = profile?.email?.trim() || user?.email?.trim() || 'Add your email';
  const displayPhone = normalizePhone(profile?.phone ?? user?.phone ?? user?.phoneNumber);
  const avatarSource = profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined;
  console.log("userAvatar: ", profile);

  const showUnavailableToast = useCallback((title: string) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: 'This feature will be available soon.',
    });
  }, []);

  const openExternalUrl = useCallback(async (url: string, fallbackTitle: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      // console.log(`Attempting to open URL: ${url}, supported: ${supported}`);

      if (true) {
        await Linking.openURL(url);
        return;
      }

      showUnavailableToast(fallbackTitle);
    } catch (error) {
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
    } catch (error) {
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

  const menuItems = useMemo<MenuItemConfig[]>(
    () => [
      {
        id: 'payment-history',
        title: 'Payment History',
        iconName: 'receipt-outline',
        onPress: () => navigation.navigate('NoPayment'),
      },
      // {
      //   id: 'saved-spas',
      //   title: 'Saved Spas',
      //   iconName: 'heart-outline',
      //   onPress: () => showUnavailableToast('Saved Spas'),
      // },
      {
        id: 'rate-app',
        title: 'Rate our App',
        iconName: 'star-outline',
        // onPress: () => showUnavailableToast('Rate our App'),
        onPress: () => {
          if (Platform.OS === 'ios') {
            openExternalUrl('https://apps.apple.com/in/app/tooka-near-you/id6784173654', 'Rate our App')
          } else if (Platform.OS === 'android') {
            openExternalUrl('https://play.google.com/store/apps/details?id=com.fracspace.tooka', 'Rate our App')
          } else {
            showUnavailableToast('Rate our App')
          }
        },
      },
      {
        id: 'terms',
        title: 'Terms & Conditions',
        iconName: 'information-circle-outline',
        onPress: () => navigation.navigate('TermsAndConditions'),
      },
      {
        id: 'privacy',
        title: 'Privacy & Policy',
        iconName: 'shield-checkmark-outline',
        onPress: () => navigation.navigate('PrivacyPolicy'),
      },
      {
        id: 'refund',
        title: 'Refund & Cancellation Policy',
        iconName: 'warning-outline',
        onPress: () => navigation.navigate('RefundPolicy'),
      },
      {
        id: 'logout',
        title: 'Logout',
        iconName: 'log-out-outline',
        destructive: true,
        onPress: handleLogout,
      },
      {
        id: 'delete-account',
        title: 'Delete Account',
        iconName: 'trash-outline',
        destructive: true,
        onPress: handleDeleteAccount,
      },
    ],
    [handleDeleteAccount, handleLogout, navigation, showUnavailableToast],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isTablet && styles.tabletContent]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <ProfileHeader onNotificationPress={() => showUnavailableToast('Notifications')} />
        <View style={styles.root}>
          {profileLoading && !profile ? (
            <View style={styles.loadingProfileBlock}>
              <ActivityIndicator size="large" color="#FFAE2B" />
            </View>
          ) : (
            <UserInfoCard
              name={displayName}
              email={displayEmail}
              phone={displayPhone}
              avatarSource={avatarSource}
              onEditPress={() => navigation.navigate('EditProfile')}
            />
          )}

          <View style={{paddingHorizontal: 16}}>
            <Image 
              source={{uri:'https://d2f15ematxpwp4.cloudfront.net/appImages/pr.png'}}
              style={{width: '100%', height: isTablet ? 90 : 70, resizeMode: 'stretch'}}
            />
          </View>

          <View style={styles.supportRow}>
            <SupportCard
              eyebrow="Need Help?"
              title="Call Support"
              iconName="call-outline"
              onPress={() => openExternalUrl(SUPPORT_PHONE, 'Call Support')}
            />
            <SupportCard
              eyebrow="Drop a Message"
              title="Email Support"
              iconName="mail-outline"
              onPress={() => openExternalUrl(SUPPORT_EMAIL, 'Email Support')}
            />
          </View>

          <MenuList items={menuItems} />
          <VersionInfo appName="TOOKA: Near You" version={APP_VERSION} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
