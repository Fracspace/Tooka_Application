import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  BackButton,
  Button,
  Icon,
  PressableScale,
  Screen,
  Text,
} from '../../../components/ui';
import { usePaymentCard } from '../../../hooks/usePaymentCard';
import type {
  PaymentFilterTab,
  usePaymentHistoryScreen,
} from '../../../hooks/usePaymentHistoryScreen';
import {
  colors,
  fonts,
  motion,
  radii,
  rise,
  shadows,
  useReduceMotion,
} from '../../../theme';
import type { BackendBookingListItem } from '../../../types/booking';
import {
  extractPaymentDate,
  formatCurrency,
  getPaymentCategory,
  getPaymentStatusUI,
} from '../utils/paymentFormatters';

type Props = ReturnType<typeof usePaymentHistoryScreen>;

const FILTERS: { key: PaymentFilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

const EMPTY_MESSAGES: Record<
  PaymentFilterTab,
  { title: string; body: string }
> = {
  all: {
    title: 'No payments yet',
    body: "You haven't made any payments so far. Your booking payments will appear here.",
  },
  completed: {
    title: 'No paid bookings',
    body: 'You do not have any completed payments at this time.',
  },
  cancelled: {
    title: 'No cancelled payments',
    body: 'You do not have any cancelled or refunded payments.',
  },
};

const MONTH = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
});

/** "OCTOBER 2026" from the payment date, or the slot date when there is none. */
function monthOf(item: BackendBookingListItem): string {
  const iso = extractPaymentDate(item.raw) ?? item.appointmentAt ?? undefined;
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime())
    ? MONTH.format(date).toUpperCase()
    : 'EARLIER';
}

const PaymentHistoryV4: React.FC<Props> = ({
  activeTab,
  amountsPaid,
  setActiveTab,
  filteredPayments,
  tabCounts,
  loading,
  refreshing,
  error,
  refetch,
  onRefresh,
}) => {
  const navigation = useNavigation();
  const [openId, setOpenId] = useState<string | null>(null);

  // Payments in list order, with a month heading wherever the month changes.
  const sections = useMemo(() => {
    const groups: { title: string; data: BackendBookingListItem[] }[] = [];
    filteredPayments.forEach(item => {
      const title = monthOf(item);
      const last = groups[groups.length - 1];
      if (last && last.title === title) {
        last.data.push(item);
      } else {
        groups.push({ title, data: [item] });
      }
    });
    return groups;
  }, [filteredPayments]);

  const toggle = useCallback(
    (id: string) => setOpenId(current => (current === id ? null : id)),
    [],
  );

  const renderEmpty = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.state}>
          <ActivityIndicator color={colors.brand} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.state}>
          <Text variant="cardTitle">Couldn't load your payments</Text>
          <Text variant="bodySm" color={colors.muted} style={styles.stateBody}>
            {error}
          </Text>
          <Button
            label="Try again"
            size="md"
            variant="secondary"
            onPress={refetch}
            style={styles.retry}
          />
        </View>
      );
    }
    const message = EMPTY_MESSAGES[activeTab];
    return (
      <View style={styles.state}>
        <View style={styles.stateIcon}>
          <Icon name="card" size={22} color={colors.brand} />
        </View>
        <Text variant="cardTitle">{message.title}</Text>
        <Text variant="bodySm" color={colors.muted} style={styles.stateBody}>
          {message.body}
        </Text>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to Profile"
        />
        <Text variant="title">Payment history</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {amountsPaid && amountsPaid.count > 0 ? (
              <Animated.View
                entering={rise(0, 14)}
                style={styles.sum}
                accessibilityLabel="Summary"
              >
                <Text style={styles.sumLabel}>BOOKING AMOUNTS PAID</Text>
                <Text style={styles.sumBig}>
                  {formatCurrency(amountsPaid.total)}
                </Text>
                <Text
                  variant="bodySm"
                  color={colors.muted}
                  style={styles.sumNote}
                >
                  {amountsPaid.count}{' '}
                  {amountsPaid.count === 1 ? 'booking' : 'bookings'} ·
                  treatments are paid at the spa
                </Text>
              </Animated.View>
            ) : null}
            <View style={styles.chips} accessibilityRole="tablist">
              {FILTERS.map(filter => {
                const on = filter.key === activeTab;
                return (
                  <PressableScale
                    key={filter.key}
                    onPress={() => setActiveTab(filter.key)}
                    scaleTo={0.95}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${filter.label}, ${
                      tabCounts[filter.key]
                    }`}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {filter.label}
                    </Text>
                    <Text style={[styles.chipCount, on && styles.chipTextOn]}>
                      {tabCounts[filter.key]}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.month}>{section.title}</Text>
        )}
        renderItem={({ item, index }) => (
          <PaymentRow
            booking={item}
            index={index}
            open={openId === item.id}
            onToggle={() => toggle(item.id)}
          />
        )}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      />
    </Screen>
  );
};

type RowProps = {
  booking: BackendBookingListItem;
  index: number;
  open: boolean;
  onToggle: () => void;
};

function PaymentRow({ booking, index, open, onToggle }: RowProps) {
  const {
    spaName,
    spaImageSource,
    amountStr,
    statusToDisplay,
    paymentDateTimeStr,
    slotTimingStr,
    paymentMethodInfo,
  } = usePaymentCard(booking);
  const statusLabel = getPaymentStatusUI(statusToDisplay).label;
  const category = getPaymentCategory(statusToDisplay);
  const label = category === 'completed' ? 'Paid' : statusLabel;
  const statusColor =
    statusLabel === 'Refunded'
      ? colors.sage
      : statusLabel === 'Failed'
      ? colors.danger
      : category === 'pending'
      ? colors.text
      : colors.muted;
  const bookingId = booking.bookingReference || booking.bookingId;

  const reduceMotion = useReduceMotion();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = reduceMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: 320, easing: motion.out });
  }, [open, reduceMotion, turn]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 180}deg` }],
  }));

  return (
    <Animated.View
      entering={rise(Math.min(index, 6) * 60, 14)}
      style={styles.pay}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${spaName}, ${amountStr}, ${label}`}
        style={styles.payHead}
      >
        <Image source={spaImageSource} style={styles.payImage} />
        <View style={styles.payText}>
          <Text style={styles.payName} numberOfLines={1}>
            {spaName}
          </Text>
          <Text variant="caption" color={colors.muted} numberOfLines={1}>
            Slot · {slotTimingStr}
          </Text>
        </View>
        <View style={styles.payRight}>
          <Text style={styles.amount}>{amountStr}</Text>
          <View style={styles.status}>
            {category === 'pending' ? (
              <ActivityIndicator
                size="small"
                color={colors.brand}
                style={styles.spin}
              />
            ) : null}
            <Text style={[styles.statusText, { color: statusColor }]}>
              {label}
            </Text>
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Icon name="chevronDown" size={16} color={colors.subtle} />
        </Animated.View>
      </Pressable>

      {open ? (
        <Animated.View
          entering={rise(0, 10).duration(360)}
          style={styles.receipt}
        >
          <ReceiptRow label="Paid on" value={paymentDateTimeStr} />
          <ReceiptRow label="Method" value={paymentMethodInfo.label} />
          {bookingId ? (
            <ReceiptRow label="Booking ID" value={bookingId} />
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 52,
    paddingHorizontal: 16,
  },
  list: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 60,
    flexGrow: 1,
  },

  sum: {
    marginBottom: 18,
    padding: 18,
    borderRadius: radii.card,
    experimental_backgroundImage:
      'radial-gradient(120% 100% at 100% 0%, #3A2A12 0%, #1D1915 62%)',
    boxShadow: shadows.brandRing,
  },
  sumLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.54,
    color: colors.muted,
  },
  sumBig: {
    marginTop: 10,
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.08,
  },
  sumNote: { marginTop: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    boxShadow: shadows.ringHi,
  },
  chipOn: { backgroundColor: colors.brand, boxShadow: 'none' },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.text,
  },
  chipCount: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 13,
    color: colors.text,
    opacity: 0.6,
  },
  chipTextOn: { color: colors.onBrand },

  month: {
    marginTop: 22,
    marginBottom: 10,
    marginHorizontal: 4,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.54,
    color: colors.brand2,
  },

  pay: {
    marginBottom: 10,
    borderRadius: radii.xl,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
    overflow: 'hidden',
  },
  payHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  payImage: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.s2,
  },
  payText: { flex: 1, minWidth: 0 },
  payName: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
  payRight: { alignItems: 'flex-end' },
  amount: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 19,
    color: colors.brand2,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  spin: { transform: [{ scale: 0.6 }], width: 10, height: 10 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13 },

  receipt: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.s2,
    gap: 8,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  receiptLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  receiptValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },

  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
  },
  stateBody: { marginTop: 6, textAlign: 'center' },
  retry: { marginTop: 16 },
});

export default PaymentHistoryV4;
