import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import { useMyBookings } from '../../hooks/useMyBookings';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { BackendBookingListItem } from '../../types/booking';
import PaymentCard from './components/PaymentCard';
import LegalHeader from '../Legal/components/LegalHeader';

const PALETTE = {
  heroOrange: '#FFAE2B',
  heroOrangeDark: '#F59B00',
  bg: '#FDF6EC',
  card: '#FFFFFF',
  title: '#FFFFFF',
  textMain: '#1A1A1A',
  textMuted: '#8A8A8A',
  chipBg: '#FFFFFF',
  chipText: '#FFAE2B',
};

const DEFAULT_ILLUSTRATION = {
  uri: 'https://d2f15ematxpwp4.cloudfront.net/appImages/PaymentHistory.png',
};

export const PaymentHistoryScreen: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const {
    completedBookings, // Assume payment history primarily cares about completed/cancelled bookings that have payments, but we will use all bookings for now, or completed as per useMyBookings
    cancelledBookings,
    upcomingBookings,
    loading,
    refreshing,
    onRefresh,
  } = useMyBookings();

  // Combine all bookings to show history, sorted by creation or appointment date if possible
  // For simplicity, just combine them
  const allPayments = useMemo(() => {
    return [...completedBookings, ...cancelledBookings, ...upcomingBookings];
  }, [completedBookings, cancelledBookings, upcomingBookings]);

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
    if (loading && !refreshing && allPayments.length === 0) {
      // Loading State - Shimmer skeleton approximation
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
        </View>
      );
    }

    const illustrationSize = isTablet ? 400 : Math.min(width * 0.8, 300);

    return (
      <View style={styles.emptyContainer}>
        <Image
          source={DEFAULT_ILLUSTRATION}
          style={{
            width: illustrationSize,
            height: illustrationSize,
            marginBottom: 0,
            opacity: 0.8,
          }}
          resizeMode="contain"
          accessible
          accessibilityLabel="No payment history illustration"
        />
        <Text style={styles.emptyTitle}>No Payment History Yet!</Text>
        <Text style={styles.emptyBody}>
          You haven't made any payments so far. Your booking payments and
          transaction receipts will appear here.
        </Text>
      </View>
    );
  }, [loading, refreshing, allPayments.length, isTablet, width]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={PALETTE.heroOrange}
        translucent={false}
      />

      {/* ── Header ── */}
      {/* <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && Platform.OS === 'ios' && { opacity: 0.7 },
            ]}
            hitSlop={10}
          >
            <Icon name="chevron-back" size={24} color={PALETTE.title} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Payment History
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <View style={styles.bubble1} />
        <View style={styles.bubble2} />
      </View> */}

      <LegalHeader title={'Payment History'} onBack={() => navigation.goBack()} />

      {/* ── Content Overlapping Header ── */}
      <View style={styles.contentWrapper}>
        <View style={[styles.contentContainer, { maxWidth: contentMaxWidth }]}>

          {/* Filter Chip */}
          {/* <View style={styles.filterContainer}>
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>All Payments</Text>
            </View>
          </View> */}

          {/* List */}
          <FlatList
            data={allPayments}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={EmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={PALETTE.heroOrange}
                colors={[PALETTE.heroOrange]}
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
  header: {
    paddingTop: 10,
    paddingBottom: 60, // Extra padding so content overlaps
    paddingHorizontal: 16,
    backgroundColor: PALETTE.heroOrange,
    position: 'relative',
    overflow: 'hidden',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 20,
    fontWeight: '700',
    color: PALETTE.title,
    flex: 1,
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 40, // Match back button width to center title
  },

  // Decorative
  bubble1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -30,
    right: -20,
  },
  bubble2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 10,
    left: 20,
  },

  contentWrapper: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    marginTop: -30, // Overlap the header
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },

  // Filter
  filterContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  filterChip: {
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.chipBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFE9DD',
  },
  filterChipText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.chipText,
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
    // justifyContent: 'center',
    paddingTop: 0,
    paddingHorizontal: 32,
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
    height: 200,
    backgroundColor: '#F0EAE0',
    borderRadius: 16,
    marginBottom: 16,
    opacity: 0.6,
  },
});
