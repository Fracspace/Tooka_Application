import React, { useMemo } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import type { BackendBookingListItem } from '../../../types/booking';
import {
  extractPaymentDate,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  getPaymentStatusUI,
} from '../utils/paymentFormatters';

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_IMAGE = {
  uri: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=400&q=60',
};

const PALETTE = {
  white: '#FFFFFF',
  cardBorder: '#F2ECE1',
  divider: '#F0EBE1',
  heading: '#1E1E1E',
  muted: '#6E6E6E',
  iconMuted: '#8A8A8A',
  slotBg: '#FAF5EC',
  slotLabel: '#8A8275',
  orange: '#F59E0B',
  methodText: '#2A2A2A',
};

export interface PaymentCardProps {
  booking: BackendBookingListItem;
  style?: StyleProp<ViewStyle>;
}

// ─── Sub-component: PaymentCardStatusBadge ────────────────────────────────────

const PaymentCardStatusBadge = React.memo<{ status: string | null | undefined }>(
  function StatusBadgeComponent({ status }) {
    const ui = useMemo(() => getPaymentStatusUI(status), [status]);

    return (
      <View
        style={[styles.badge, { backgroundColor: ui.backgroundColor }]}
        accessibilityRole="text"
        accessibilityLabel={`Payment status: ${ui.label}`}
      >
        <Text style={[styles.badgeText, { color: ui.textColor }]}>
          {ui.label}
        </Text>
      </View>
    );
  },
);

// ─── Main Component: PaymentCard ──────────────────────────────────────────────

export const PaymentCard = React.memo<PaymentCardProps>(function PaymentCardComponent({
  booking,
  style,
}) {
  // Spa Name
  const spaName =
    booking.spaName ||
    booking.raw?.spa_snapshot?.name ||
    'Unknown Spa';

  // Location
  const locality = booking.raw?.spa_snapshot?.locality_name;
  const city = booking.raw?.spa_snapshot?.city_name;
  const location =
    locality && city
      ? `${locality}, ${city}`
      : locality ||
        city ||
        booking.location ||
        booking.raw?.spa_snapshot?.address ||
        '';

  // Spa Image
  const rawCover = booking.raw?.spa_snapshot?.cover_photo_url;
  const spaImageUri = booking.spaImage || rawCover;
  const spaImageSource = spaImageUri ? { uri: spaImageUri } : FALLBACK_IMAGE;

  // Amount
  const bookingPrice =
    typeof booking.price === 'number' || typeof booking.price === 'string'
      ? booking.price
      : null;
  const rawTotal =
    typeof booking.raw?.amount_total === 'string' ||
    typeof booking.raw?.amount_total === 'number'
      ? booking.raw.amount_total
      : null;
  const rawBase =
    typeof (booking.raw as Record<string, unknown>)?.base_price === 'string' ||
    typeof (booking.raw as Record<string, unknown>)?.base_price === 'number'
      ? ((booking.raw as Record<string, unknown>).base_price as string | number)
      : null;
  const rawPaid =
    typeof booking.raw?.amount_paid === 'string' ||
    typeof booking.raw?.amount_paid === 'number'
      ? booking.raw.amount_paid
      : null;
  const rawAmount = rawTotal ?? rawBase ?? rawPaid ?? bookingPrice;
  const amountStr = formatCurrency(rawAmount);

  // Status: payment_status === "captured" is Completed, rest is Cancelled
  const isCaptured =
    (
      booking.paymentStatus ||
      (booking.raw as Record<string, unknown>)?.payment_status ||
      ''
    )
      .toString()
      .toLowerCase()
      .trim() === 'captured';
  const statusToDisplay = isCaptured ? 'captured' : 'cancelled';

  // Transaction Date/Time
  const appointmentAtStr = booking.appointmentAt ?? undefined;
  const paymentDateIso = extractPaymentDate(booking.raw);
  const paymentDateTimeStr =
    formatDateTime(paymentDateIso) ||
    formatDateTime(appointmentAtStr) ||
    '--';

  // Booked Slot Timing
  const slotDate = booking.date;
  const slotTime = booking.time;
  const slotTimingStr =
    slotDate && slotTime
      ? `${slotDate} | ${slotTime}`
      : formatDateTime(appointmentAtStr) || 'Slot Details Unavailable';

  // Payment Method
  const paymentMethodInfo = useMemo(
    () => formatPaymentMethod(booking.raw?.payment),
    [booking.raw?.payment],
  );

  return (
    <View style={[styles.card, style]} accessibilityRole="none">
      {/* ── Top Section: Left Image + Right Details ── */}
      <View style={styles.topSection}>
        {/* Spa Image on Left */}
        <Image
          source={spaImageSource}
          style={styles.spaImage}
          resizeMode="cover"
          accessible
          accessibilityLabel={`${spaName} image`}
        />

        {/* Right Info Column */}
        <View style={styles.infoColumn}>
          {/* Row 1: Spa Name + Status Badge */}
          <View style={styles.nameBadgeRow}>
            <Text style={styles.spaNameText} numberOfLines={1}>
              {spaName}
            </Text>
            <PaymentCardStatusBadge status={statusToDisplay} />
          </View>

          {/* Row 2: Location + Amount */}
          <View style={styles.locationAmountRow}>
            <View style={styles.locationContainer}>
              <Icon
                name="location-outline"
                size={13}
                color={PALETTE.iconMuted}
                style={styles.metaIcon}
              />
              <Text style={styles.locationText} numberOfLines={1}>
                {location || 'Location details pending'}
              </Text>
            </View>
            <Text style={styles.amountText} numberOfLines={1}>
              {amountStr}
            </Text>
          </View>

          {/* Row 3: Payment/Transaction Date */}
          <View style={styles.dateRow}>
            <Icon
              name="calendar-outline"
              size={13}
              color={PALETTE.iconMuted}
              style={styles.metaIcon}
            />
            <Text style={styles.dateText} numberOfLines={1}>
              {paymentDateTimeStr}
            </Text>
          </View>

          {/* Row 4: Booked Slot Section */}
          <View style={styles.bookedSlotBox}>
            <Icon
              name="time-outline"
              size={15}
              color={PALETTE.orange}
              style={styles.slotClockIcon}
            />
            <View style={styles.slotTextContainer}>
              <Text style={styles.slotLabelText}>Booked Slot</Text>
              <Text style={styles.slotValueText} numberOfLines={1}>
                {slotTimingStr}
              </Text>
            </View>
            {/* <Icon
              name="chevron-forward"
              size={14}
              color={PALETTE.orange}
            /> */}
          </View>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Bottom Section: Masked Payment Method (Centered) ── */}
      <View style={styles.bottomSection}>
        <Icon
          name={paymentMethodInfo.icon}
          size={16}
          color={PALETTE.methodText}
          style={styles.methodIcon}
        />
        <Text style={styles.methodText} numberOfLines={1}>
          {paymentMethodInfo.label}
        </Text>
      </View>
    </View>
  );
});

export default PaymentCard;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#1a1a1a98',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // Top Section
  topSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  spaImage: {
    width: 86,
    height: 112,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  infoColumn: {
    flex: 1,
    marginLeft: 12,
  },

  // Row 1: Name & Status
  nameBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spaNameText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.heading,
    flex: 1,
    marginRight: 6,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Row 2: Location & Amount
  locationAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  metaIcon: {
    marginRight: 4,
  },
  locationText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: PALETTE.muted,
    flexShrink: 1,
  },
  amountText: {
    fontFamily: 'Sora-Bold',
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.heading,
  },

  // Row 3: Date
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: PALETTE.muted,
  },

  // Row 4: Booked Slot Box
  bookedSlotBox: {
    backgroundColor: PALETTE.slotBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotClockIcon: {
    marginRight: 7,
  },
  slotTextContainer: {
    flex: 1,
  },
  slotLabelText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 10,
    color: PALETTE.slotLabel,
  },
  slotValueText: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.heading,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: PALETTE.divider,
    marginTop: 14,
    marginBottom: 11,
  },

  // Bottom Section: Centered Payment Method
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  methodIcon: {
    marginRight: 7,
  },
  methodText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 13,
    fontWeight: '500',
    color: PALETTE.methodText,
  },
});
