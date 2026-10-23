import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button, Icon, Screen, Text, useTabBarSpace } from '../../../components/ui';
import { BOOKING_FALLBACK_IMAGE, useBookingCard } from '../../../hooks/useBookingCard';
import type { useAllBookingScreen } from '../../../hooks/useAllBookingScreen';
import {
  brandAlpha,
  colors,
  fonts,
  motion,
  radii,
  rise,
  shadows,
  type as typeStyles,
  useReduceMotion,
} from '../../../theme';
import { BookingsSkeleton } from './BookingsSkeleton';
import type { BackendBookingListItem, BookingSection } from '../../../types/booking';

type Props = ReturnType<typeof useAllBookingScreen>;

const EMPTY_MESSAGES: Record<BookingSection, string> = {
  upcoming: 'No upcoming bookings',
  completed: 'No completed bookings',
  cancelled: 'No cancelled bookings',
  'no-show': 'No cancelled bookings',
};

const AllBookingV4: React.FC<Props> = ({
  activeBookings,
  availableTabs,
  effectiveActiveTab,
  error,
  handleExploreNow,
  handleTabPress,
  hasBookings,
  hasFetchedOnce,
  loading,
  onRefresh,
  refetch,
  refreshing,
  tabCounts,
}) => {
  const bottomSpace = useTabBarSpace();

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.brand}
      colors={[colors.brand]}
    />
  );

  const header = (
    <>
      <View style={styles.header}>
        <Text variant="h1" style={styles.title}>
          Bookings
        </Text>
        <Text variant="bodySm" color={colors.muted} style={styles.subtitle}>
          Your visits, past and upcoming
        </Text>
      </View>
      {hasBookings ? (
        <Segment
          tabs={availableTabs.map(t => ({ ...t, count: tabCounts[t.section] }))}
          active={effectiveActiveTab}
          onPress={handleTabPress}
        />
      ) : null}
    </>
  );

  const renderItem = useCallback(
    ({ item, index }: { item: BackendBookingListItem; index: number }) => (
      <Animated.View entering={rise(index * 70, 18).duration(520)}>
        {effectiveActiveTab === 'upcoming' ? (
          <UpcomingCard booking={item} />
        ) : (
          <PastRow booking={item} cancelled={effectiveActiveTab !== 'completed'} />
        )}
      </Animated.View>
    ),
    [effectiveActiveTab],
  );

  if (loading && !hasFetchedOnce) {
    return (
      <BookingsSkeleton />
    );
  }

  if (!hasBookings) {
    return (
      <Screen haze>
        <ScrollView
          contentContainerStyle={[styles.emptyContent, { paddingBottom: bottomSpace }]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}>
          {header}
          <Animated.View entering={rise(60)} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="bookings" size={28} color={colors.brand} />
            </View>
            {error ? (
              <>
                <Text variant="title" style={styles.emptyTitle}>
                  Unable to load bookings
                </Text>
                <Text variant="bodySm" color={colors.muted} style={styles.emptyText}>
                  {error}
                </Text>
                <Button label="Retry" variant="secondary" onPress={refetch} style={styles.emptyButton} />
              </>
            ) : (
              <>
                <Text variant="title" style={styles.emptyTitle}>
                  Your next wellness moment awaits
                </Text>
                <Text variant="bodySm" color={colors.muted} style={styles.emptyText}>
                  Explore nearby spas and book your first session.
                </Text>
                <Button label="Explore now" onPress={handleExploreNow} style={styles.emptyButton} />
              </>
            )}
          </Animated.View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen haze>
      <FlatList
        data={activeBookings}
        keyExtractor={item => `${effectiveActiveTab}:${item.id}`}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={styles.listHeader}
        ListEmptyComponent={
          <Text variant="bodySm" color={colors.muted} style={styles.listEmpty}>
            {EMPTY_MESSAGES[effectiveActiveTab]}
          </Text>
        }
        ListFooterComponent={
          effectiveActiveTab === 'upcoming' && activeBookings.length > 0 ? (
            <Animated.View
              key={effectiveActiveTab}
              entering={rise(activeBookings.length * 70 + 80, 18).duration(520)}>
              <Text variant="caption" color={colors.subtle} style={styles.note}>
                Pick your treatment at the spa. The ₹199 booking amount is refundable as per the
                spa's terms.
              </Text>
            </Animated.View>
          ) : null
        }
        contentContainerStyle={[styles.list, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </Screen>
  );
};

// ─── Segment ─────────────────────────────────────────────────────────────────

// Matches the canvas: the pill glides over 440ms with a small overshoot, the
// labels recolour over 260ms, and a held tab shrinks slightly.
const PILL = { duration: 440, easing: motion.spring, reduceMotion: ReduceMotion.System };
const RECOLOUR = { duration: 260, easing: motion.out, reduceMotion: ReduceMotion.System };
const PRESS = { duration: motion.press, easing: motion.out, reduceMotion: ReduceMotion.System };

function Segment({
  tabs,
  active,
  onPress,
}: {
  tabs: Array<{ label: string; section: BookingSection; count: number }>;
  active: BookingSection;
  onPress: (section: BookingSection) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex(t => t.section === active));
  const pillWidth = tabs.length > 0 ? width / tabs.length : 0;
  const x = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!pillWidth) return;
    // The first placement jumps; only real switches glide.
    x.value = placed.current ? withTiming(index * pillWidth, PILL) : index * pillWidth;
    placed.current = true;
  }, [index, pillWidth, x]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={styles.seg}
      onLayout={e => setWidth(e.nativeEvent.layout.width - 8)}
      accessibilityRole="tablist">
      {width > 0 ? <Animated.View style={[styles.pill, { width: pillWidth }, pillStyle]} /> : null}
      {tabs.map(tab => (
        <SegmentTab
          key={tab.section}
          label={tab.label}
          count={tab.count}
          on={tab.section === active}
          onPress={() => onPress(tab.section)}
        />
      ))}
    </View>
  );
}

function SegmentTab({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(on ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(on ? 1 : 0, RECOLOUR);
  }, [on, progress]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.muted, colors.onBrand]),
  }));
  const countStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.s3, colors.onBrand]),
  }));
  const countTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.text, colors.brand]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(motion.pressScale, PRESS);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, PRESS);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${count}`}
      style={styles.segBtnWrap}>
      <Animated.View style={[styles.segBtn, pressStyle]}>
        <Animated.Text style={[typeStyles.label, labelStyle]}>{label}</Animated.Text>
        <Animated.View style={[styles.count, countStyle]}>
          <Animated.Text style={[styles.countText, countTextStyle]}>{count}</Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Upcoming card ───────────────────────────────────────────────────────────

const UpcomingCard = React.memo(function UpcomingCardView({ booking }: { booking: BackendBookingListItem }) {
  const {
    bookingCode,
    coverPhoto,
    handleCompletePayment,
    handleFreeCallSpa,
    handleOpenMaps,
    isPaymentPending,
    locationText,
    paymentInFlight,
    spaId,
    starting,
  } = useBookingCard(booking);

  return (
    <View style={styles.up}>
      <View style={styles.upImg}>
        <Image
          source={coverPhoto ? { uri: coverPhoto } : BOOKING_FALLBACK_IMAGE}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityLabel={`${booking.spaName} spa image`}
        />
        <View style={styles.upFade} />
      </View>
      <View style={styles.upBody}>
        {isPaymentPending ? (
          <StatusChip
            label={paymentInFlight ? 'Payment processing' : 'Awaiting payment'}
            tone="pending"
          />
        ) : (
          <StatusChip label="Confirmed" tone="ok" />
        )}
        <Text variant="title" style={styles.upName} numberOfLines={2}>
          {booking.spaName}
        </Text>
        <Text variant="bodySm" color={colors.muted} numberOfLines={1} style={styles.upLoc}>
          {locationText}
        </Text>

        <View style={styles.when}>
          <WhenCell label="DATE" value={booking.date || '--'} />
          <WhenCell label="TIME" value={booking.time || '--'} highlight />
          {booking.guestCount ? (
            <WhenCell label="GUESTS" value={String(booking.guestCount)} />
          ) : null}
        </View>

        {/* Not confirmed until the payment clears, so no call action yet. */}
        {isPaymentPending ? (
          paymentInFlight ? (
            <Text variant="caption" color={colors.muted} style={styles.pendingNote}>
              We'll confirm this booking as soon as your payment is verified.
            </Text>
          ) : (
            <Button
              label="Complete payment"
              size="md"
              loading={starting}
              disabled={starting}
              onPress={handleCompletePayment}
              style={styles.actionsTop}
            />
          )
        ) : (
          <View style={[styles.actions, styles.actionsTop]}>
            <Button
              label="Directions"
              variant="cream"
              size="md"
              iconLeft={<Icon name="directions" size={16} color={colors.ink} />}
              onPress={handleOpenMaps}
              accessibilityLabel="Open spa in Google Maps"
              style={styles.actionBtn}
            />
            {spaId ? (
              <Button
                label="Call spa"
                variant="secondary"
                size="md"
                iconLeft={<Icon name="phone" size={16} color={colors.text} />}
                onPress={handleFreeCallSpa}
                accessibilityLabel="Free call spa"
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        )}

        <View style={styles.idRow}>
          <Text variant="caption" color={colors.muted}>
            Booking ID
          </Text>
          <Text style={styles.idValue} numberOfLines={1}>
            {bookingCode}
          </Text>
        </View>
      </View>
    </View>
  );
});

function WhenCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.whenCell}>
      <Text style={styles.whenLabel}>{label}</Text>
      <Text style={[styles.whenValue, highlight && { color: colors.brand }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── Completed / cancelled row ───────────────────────────────────────────────

const PastRow = React.memo(function PastRowView({
  booking,
  cancelled,
}: {
  booking: BackendBookingListItem;
  cancelled: boolean;
}) {
  const { badgeDate, coverPhoto, locationText } = useBookingCard(booking);

  return (
    <View style={styles.row}>
      <View style={styles.mini}>
        <Image
          source={coverPhoto ? { uri: coverPhoto } : BOOKING_FALLBACK_IMAGE}
          style={[StyleSheet.absoluteFill, cancelled && styles.dim]}
          resizeMode="cover"
          accessibilityLabel={`${booking.spaName} spa image`}
        />
        <View style={styles.miniBadge}>
          <Text style={styles.miniText}>
            {badgeDate.day}
            {'\n'}
            {badgeDate.month.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <StatusChip label={cancelled ? 'Cancelled' : 'Completed'} tone={cancelled ? 'cx' : 'done'} />
          <Text variant="caption" color={colors.muted}>
            {booking.time || '--'}
          </Text>
        </View>
        <Text variant="cardTitle" numberOfLines={1} style={styles.rowName}>
          {booking.spaName}
        </Text>
        <Text variant="caption" color={colors.muted} numberOfLines={1}>
          {[locationText, booking.date].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
});

// ─── Status chip ─────────────────────────────────────────────────────────────

type Tone = 'ok' | 'pending' | 'done' | 'cx';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: 'rgba(156,199,168,0.14)', fg: colors.sage },
  pending: { bg: colors.brandTint, fg: colors.brand2 },
  done: { bg: colors.brandTint, fg: colors.brand2 },
  cx: { bg: colors.s2, fg: colors.muted },
};

function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  const reduceMotion = useReduceMotion();
  const dot = useSharedValue(1);
  const live = tone === 'ok' || tone === 'pending';

  useEffect(() => {
    if (live && !reduceMotion) {
      dot.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 1200 }), withTiming(1, { duration: 1200 })),
        -1,
      );
    }
  }, [dot, live, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));
  const { bg, fg } = TONES[tone];

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {live ? <Animated.View style={[styles.chipDot, { backgroundColor: fg }, dotStyle]} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export default AllBookingV4;

const styles = StyleSheet.create({
  header: { paddingTop: 60, paddingHorizontal: 4 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  subtitle: { marginTop: 4, fontSize: 14 },
  listHeader: { marginBottom: 6 },
  list: { paddingHorizontal: 16, gap: 12 },
  listEmpty: { textAlign: 'center', paddingVertical: 32 },
  note: { textAlign: 'center', paddingVertical: 6, paddingHorizontal: 24 },

  seg: {
    marginTop: 20,
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  pill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    boxShadow: shadows.selected,
  },
  segBtnWrap: { flex: 1 },
  segBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: fonts.display, fontSize: 10, lineHeight: 18 },

  up: {
    borderRadius: radii.poster,
    overflow: 'hidden',
    backgroundColor: colors.s1,
    boxShadow: `inset 0 0 0 1px ${brandAlpha(0.26)}, 0 16px 36px ${brandAlpha(0.06)}`,
  },
  upImg: { height: 150 },
  upFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    experimental_backgroundImage: 'linear-gradient(180deg, rgba(18,16,14,0.2) 0%, rgba(29,25,21,1) 100%)',
  },
  upBody: { marginTop: -54, paddingHorizontal: 16, paddingBottom: 16 },
  upName: { marginTop: 12 },
  upLoc: { marginTop: 2 },
  when: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 14,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.edge,
  },
  whenCell: { flex: 1, backgroundColor: colors.s2, paddingVertical: 10, paddingHorizontal: 12 },
  whenLabel: { fontFamily: fonts.bodySemiBold, fontSize: 10, lineHeight: 12, letterSpacing: 1.2, color: colors.subtle },
  whenValue: { marginTop: 6, fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  actionsTop: { marginTop: 12 },
  actionBtn: { flex: 1, height: 46, borderRadius: 15 },
  pendingNote: { marginTop: 12 },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.s3,
  },
  idValue: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.text,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  mini: { width: 72, height: 84, borderRadius: radii.sm, overflow: 'hidden' },
  dim: { opacity: 0.55 },
  miniBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(18,16,14,0.8)',
  },
  miniText: { fontFamily: fonts.display, fontSize: 10, lineHeight: 12, textAlign: 'center', color: colors.brand2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { marginTop: 8 },

  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13 },

  emptyContent: { flexGrow: 1, paddingHorizontal: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
  },
  emptyTitle: { marginTop: 18, textAlign: 'center' },
  emptyText: { marginTop: 6, textAlign: 'center' },
  emptyButton: { marginTop: 22, alignSelf: 'stretch' },
});
