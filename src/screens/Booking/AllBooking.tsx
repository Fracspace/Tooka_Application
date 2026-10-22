import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FullScreenLoader from '../../components/loaders/FullScreenLoader';
import { useAllBookingScreen } from '../../hooks/useAllBookingScreen';
import { isV4 } from '../../config/uiFlags';
import type { BackendBookingListItem, BookingSection } from '../../types/booking';
import AllBookingHeader from './components/AllBookingHeader';
import BookingCard from './components/BookingCard';
import AllBookingV4 from './v4/AllBookingV4';

type TabButtonProps = {
  label: string;
  isActive: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const NO_BOOKINGS_ILLUSTRATION = {
  uri: 'https://d2f15ematxpwp4.cloudfront.net/appImages/nobookings.png',
};

const EMPTY_STATE_MESSAGES: Record<BookingSection, string> = {
  upcoming: 'No upcoming bookings',
  completed: 'No completed bookings',
  cancelled: 'No cancelled bookings',
  'no-show': 'No cancelled bookings',
};

const TabButton = React.memo<TabButtonProps>(function RenderTabButton({
  label,
  isActive,
  onPress,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, isActive && styles.tabButtonActive, style]}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
    >
      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
});

const AllBookingScreen: React.FC = () => {
  const screen = useAllBookingScreen();
  if (isV4('bookings')) {
    return <AllBookingV4 {...screen} />;
  }
  return <AllBookingLegacy screen={screen} />;
};

const AllBookingLegacy: React.FC<{ screen: ReturnType<typeof useAllBookingScreen> }> = ({ screen }) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const {
    activeBookings,
    availableTabs,
    effectiveActiveTab,
    error,
    handleBack,
    handleExploreNow,
    handleTabPress,
    hasFetchedOnce,
    loading,
    onRefresh,
    refetch,
    refreshing,
  } = screen;

  const renderBooking = useCallback(
    ({ item, index }: { item: BackendBookingListItem; index: number }) => (
      <BookingCard
        booking={item}
        style={[
          styles.bookingCardItem,
          isTablet && styles.bookingCardItemTablet,
          index % 2 === 1 && isTablet && styles.tabletCardRight,
        ]}
      />
    ),
    [isTablet],
  );

  const keyExtractor = useCallback(
    (item: BackendBookingListItem) => item.id,
    [],
  );

  const listHeader = useMemo(() => {
    if (availableTabs.length === 0) {
      return null;
    }

    return (
      <>
        {availableTabs.length >= 2 && (
          <View
            style={[styles.tabContainer, isTablet && styles.tabContainerTablet]}
          >
            {availableTabs.map((tab) => (
              <TabButton
                key={tab.section}
                label={tab.label}
                isActive={effectiveActiveTab === tab.section}
                onPress={() => handleTabPress(tab.section)}
              />
            ))}
          </View>
        )}

        {/* <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {effectiveActiveTab === 'upcoming' && 'Upcoming Bookings'}
            {effectiveActiveTab === 'completed' && 'Completed Bookings'}
            {effectiveActiveTab === 'cancelled' && 'Cancelled Bookings'}
          </Text>
        </View> */}
      </>
    );
  }, [availableTabs, effectiveActiveTab, handleTabPress, isTablet]);

  const listEmpty = useMemo(() => {
    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Unable to load bookings</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>{EMPTY_STATE_MESSAGES[effectiveActiveTab]}</Text>
      </View>
    );
  }, [effectiveActiveTab, error, refetch]);

  if (loading && !hasFetchedOnce) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <FullScreenLoader />
      </SafeAreaView>
    );
  }

  const hasBookings = availableTabs.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      {/* ── Top Hero / Header Area (Shown in both states) ── */}
      <AllBookingHeader onBack={handleBack} />

      {/* ── Content Container Overlapping Header ── */}
      <View style={styles.contentWrapper}>
        {!hasBookings && error ? (
          /* A failed load used to fall through to "Your next wellness moment
             awaits", so offline / server errors looked like an empty account. */
          <ScrollView
            contentContainerStyle={styles.emptyScrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFB02E"
                colors={['#FFB02E']}
              />
            }
          >
            {listEmpty}
          </ScrollView>
        ) : !hasBookings ? (
          /* ── CASE A: NO BOOKINGS EMPTY STATE ── */
          <ScrollView
            contentContainerStyle={styles.emptyScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFB02E"
                colors={['#FFB02E']}
              />
            }
          >
            <Image
              source={NO_BOOKINGS_ILLUSTRATION}
              style={styles.emptyIllustration}
              resizeMode="contain"
              accessible
              accessibilityLabel="No bookings yet"
            />
            <Text style={styles.emptyHeading}>
              Your next wellness moment awaits ✨
            </Text>
            <Text style={styles.emptySubheading}>
              {'Explore nearby spas and book your first\nsession.'}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.exploreButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleExploreNow}
              accessibilityRole="button"
              accessibilityLabel="Explore Now"
            >
              <Text style={styles.exploreButtonText}>Explore Now →</Text>
            </Pressable>
          </ScrollView>
        ) : (
          /* ── CASE B: BOOKINGS EXIST (Preserved Booking UI) ── */
          <FlatList
            data={activeBookings}
            key={isTablet ? 'tablet' : 'phone'}
            numColumns={isTablet ? 2 : 1}
            keyExtractor={keyExtractor}
            renderItem={renderBooking}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFB02E"
                colors={['#FFB02E']}
              />
            }
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // backgroundColor: '#FFB02E',
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#FAF6EF',
    marginTop: -32, // Smooth overlap onto header
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 24,
    flexGrow: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    // gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    // padding: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tabContainerTablet: {
    maxWidth: 400,
    alignSelf: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabButtonMiddle: {
    marginHorizontal: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFB02E',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6D6D6D',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1E1E',
  },
  bookingCardItem: {
    marginBottom: 8,
  },
  bookingCardItemTablet: {
    width: '48%',
    marginBottom: 20,
  },
  tabletCardRight: {
    marginLeft: 12,
  },
  stateContainer: {
    paddingVertical: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 17,
    color: '#1E1E1E',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  stateText: {
    fontSize: 14,
    color: '#8A8A8A',
    fontWeight: '600',
    textAlign: 'center',
  },

  // ─── New No Bookings Empty State ───
  emptyScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
    paddingBottom: 120, // Accommodate floating bottom navigation bar
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  emptyIllustration: {
    width: 250,
    height: 250,
  },
  emptyHeading: {
    fontFamily: 'Sora-Bold',
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1816',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  emptySubheading: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: '#707070',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  exploreButton: {
    backgroundColor: '#FFAE2B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 24,
    alignSelf: 'center',
  },
  exploreButtonText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  retryButton: {
    marginTop: 18,
    backgroundColor: '#FFB02E',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default AllBookingScreen;
