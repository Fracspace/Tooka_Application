// ─────────────────────────────────────────────────────────────────────────────
// ProfileScreen
//
// UI rebuilt to match the provided Figma while preserving existing behavior:
//  • Reads live user data from AuthContext.
//  • Navigates to NoPayment for Payment History.
//  • Keeps guarded logout and navigation reset to BottomNavigation.
//  • Keeps delete-account confirmation and TODO placeholder.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { ActivityIndicator, Image, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from './components/ProfileHeader';
import UserInfoCard from './components/UserInfoCard';
import SupportCard from './components/SupportCard';
import MenuList from './components/MenuList';
import VersionInfo from './components/VersionInfo';
import type { MenuItemConfig } from './components/MenuItem';
import { styles } from './styles';
import ProfileV4 from './v4/ProfileV4';
import { isV4 } from '../../config/uiFlags';
import { useProfileScreen } from '../../hooks/useProfileScreen';

const ProfileScreen: React.FC = () => {
  const screen = useProfileScreen();
  if (isV4('profile')) {
    return <ProfileV4 {...screen} />;
  }
  return <ProfileLegacy screen={screen} />;
};

const ProfileLegacy: React.FC<{ screen: ReturnType<typeof useProfileScreen> }> = ({ screen }) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const {
    profile,
    profileLoading,
    displayName,
    displayEmail,
    displayPhone,
    avatarSource,
    appVersion,
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
  } = screen;

  const menuItems = useMemo<MenuItemConfig[]>(
    () => [
      {
        id: 'payment-history',
        title: 'Payment History',
        iconName: 'receipt-outline',
        onPress: openPaymentHistory,
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
        onPress: handleRateApp,
      },
      {
        id: 'terms',
        title: 'Terms & Conditions',
        iconName: 'information-circle-outline',
        onPress: openTerms,
      },
      {
        id: 'privacy',
        title: 'Privacy & Policy',
        iconName: 'shield-checkmark-outline',
        onPress: openPrivacy,
      },
      {
        id: 'refund',
        title: 'Refund & Cancellation Policy',
        iconName: 'warning-outline',
        onPress: openRefund,
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
    [handleDeleteAccount, handleLogout, handleRateApp, openPaymentHistory, openPrivacy, openRefund, openTerms],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isTablet && styles.tabletContent]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <ProfileHeader onNotificationPress={handleNotificationPress} />
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
              onEditPress={openEditProfile}
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
              onPress={callSupport}
            />
            <SupportCard
              eyebrow="Drop a Message"
              title="Email Support"
              iconName="mail-outline"
              onPress={emailSupport}
            />
          </View>

          <MenuList items={menuItems} />
          <VersionInfo appName="TOOKA: Near You" version={appVersion} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
