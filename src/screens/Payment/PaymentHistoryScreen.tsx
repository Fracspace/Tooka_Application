import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMyBookings } from '../../hooks/useMyBookings';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { BackendBookingListItem } from '../../types/booking';
import PaymentCard from './components/PaymentCard';
import PaymentHeader from './components/PaymentHeader';

type PaymentFilterTab = 'all' | 'completed' | 'cancelled';

const TABS: Array<{ label: string; key: PaymentFilterTab }> = [
  { label: 'All', key: 'all' },
  { label: 'Completed', key: 'completed' },
  { label: 'Cancelled', key: 'cancelled' },
];

const PALETTE = {
  heroOrange: '#FFAE2B',
  bg: '#FAF6EF',
  card: '#FFFFFF',
  textMain: '#1A1A1A',
  textMuted: '#8A8A8A',
  tabActiveBg: '#F89C1D',
  tabActiveText: '#FFFFFF',
  tabInactiveBg: '#EDE7DE',
  tabInactiveText: '#282624',
};

const DEFAULT_ILLUSTRATION = {
  uri: 'https://d2f15ematxpwp4.cloudfront.net/appImages/nopay1.png',
};

export const PaymentHistoryScreen: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<PaymentFilterTab>('all');

  const {
    allBookings,
    completedBookings,
    cancelledBookings,
    upcomingBookings,
    loading,
    refreshing,
    onRefresh,
  } = useMyBookings();

  // Combine all bookings to show history
  const allPayments = useMemo(() => {
    if (allBookings && allBookings.length > 0) {
      return allBookings;
    }
    return [...completedBookings, ...cancelledBookings, ...upcomingBookings];
  }, [allBookings, completedBookings, cancelledBookings, upcomingBookings]);

  // Helper to check if payment is captured (completed)
  const isPaymentCaptured = useCallback((item: BackendBookingListItem) => {
    const rawPaymentStatus = (item.raw as Record<string, unknown>)?.payment_status;
    const status = (item.paymentStatus || rawPaymentStatus || '')
      .toString()
      .toLowerCase()
      .trim();
    return status === 'captured';
  }, []);

  // Filter based on selected tab:
  // "completed" -> payment_status === "captured"
  // "cancelled" -> payment_status !== "captured"
  // "all"       -> all payments
  const filteredPayments = useMemo(() => {
    switch (activeTab) {
      case 'completed':
        return allPayments.filter(item => isPaymentCaptured(item));
      case 'cancelled':
        return allPayments.filter(item => !isPaymentCaptured(item));
      case 'all':
      default:
        return allPayments;
    }
  }, [activeTab, allPayments, isPaymentCaptured]);

  const isTablet = Math.min(width, height) >= 600;
  const contentMaxWidth = isTablet ? 720 : width;

  const renderItem = useCallback(
    ({ item }: { item: BackendBookingListItem }) => (
      <View style={styles.cardContainer}>
        <PaymentCard booking={item} />
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: BackendBookingListItem) => item.id, []);

  // Empty State Component
  const EmptyState = useMemo(() => {
    if (loading && !refreshing && filteredPayments.length === 0) {
      // Loading State - Shimmer skeleton approximation
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
        </View>
      );
    }

    const illustrationSize = isTablet ? 400 : Math.min(width * 0.8, 280);

    const emptyMessages: Record<PaymentFilterTab, { title: string; body: string }> = {
      all: {
        title: 'No Payment History Yet!',
        body: "You haven't made any payments so far. Your booking payments and transaction receipts will appear here.",
      },
      completed: {
        title: 'No Completed Payments',
        body: 'You do not have any completed payments at this time.',
      },
      cancelled: {
        title: 'No Cancelled Payments',
        body: 'You do not have any cancelled or refunded payments.',
      },
    };

    const currentMsg = emptyMessages[activeTab];

    return (
      <View style={styles.emptyContainer}>
        <Image
          source={DEFAULT_ILLUSTRATION}
          style={[styles.emptyImage, { width: illustrationSize, height: illustrationSize }]}
          resizeMode="contain"
          accessible
          accessibilityLabel="No payment history illustration"
        />
        <Text style={styles.emptyTitle}>{currentMsg.title}</Text>
        <Text style={styles.emptyBody}>{currentMsg.body}</Text>
      </View>
    );
  }, [loading, refreshing, filteredPayments.length, isTablet, width, activeTab]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={PALETTE.heroOrange}
        translucent={false}
      />

      {/* ── Top Hero / Header Area ── */}
      <PaymentHeader title="Payment History" onBack={() => navigation.goBack()} />

      {/* ── Content Overlapping Header ── */}
      <View style={styles.contentWrapper}>
        <View style={[styles.contentContainer, { maxWidth: contentMaxWidth }]}>
          {/* ── Filter Tabs ── */}
          <View style={styles.tabContainer}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabButton,
                    isActive ? styles.tabButtonActive : styles.tabButtonInactive,
                  ]}
                  accessibilityRole="tab"
                  accessibilityLabel={`${tab.label} payments filter`}
                  accessibilityState={{ selected: isActive }}
                  android_ripple={{
                    color: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                    borderless: false,
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      isActive ? styles.tabTextActive : styles.tabTextInactive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Payment List ── */}
          <FlatList
            data={filteredPayments}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={EmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={PALETTE.tabActiveBg}
                colors={[PALETTE.tabActiveBg]}
              />
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default PaymentHistoryScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.heroOrange,
  },

  contentWrapper: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    marginTop: -32, // Smooth overlap onto the header
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },

  // Filter Tabs
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  tabButton: {
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  tabButtonActive: {
    backgroundColor: PALETTE.tabActiveBg,
    paddingHorizontal: 22,
  },
  tabButtonInactive: {
    backgroundColor: PALETTE.tabInactiveBg,
    paddingHorizontal: 18,
  },
  tabText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: PALETTE.tabActiveText,
  },
  tabTextInactive: {
    color: PALETTE.tabInactiveText,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  cardContainer: {
    width: '100%',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 32,
  },
  emptyImage: {
    marginBottom: 0,
    opacity: 0.85,
  },
  emptyTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.textMain,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: PALETTE.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Skeleton
  skeletonCard: {
    width: '100%',
    height: 180,
    backgroundColor: '#EDE6DB',
    borderRadius: 20,
    marginBottom: 16,
    opacity: 0.6,
  },
});
