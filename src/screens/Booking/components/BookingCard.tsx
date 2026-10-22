/**
 * BookingCard
 *
 * Reusable booking card UI component matching the Figma design for the
 * All Bookings screen. Supports Upcoming, Completed, and Cancelled tabs.
 *
 * Layout (per Figma):
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  ┌───────────────┐   🕘 03:00 PM       Remind me  [ON]   │
 *  │  │               │   ────────────────────────────────── │
 *  │  │   SPA IMAGE   │   Ebony spa                          │
 *  │  │               │   📍 HITECH City, Hyderabad          │
 *  │  │  ┌────────────┤   🗺 Open in maps                  › │
 *  │  │24│            │                                      │
 *  │  │Aug            │   Booking ID | TK987654              │
 *  │  └──┴────────────┘                                      │
 *  │                                                          │
 *  │  ┌────────────────────┐  ┌────────────────────────────┐ │
 *  │  │    Chat With Spa   │  │      Free Call Spa         │ │
 *  │  └────────────────────┘  └────────────────────────────┘ │
 *  └──────────────────────────────────────────────────────────┘
 */

import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { BackendBookingListItem, BookingSection } from '../../../types/booking';
import { BOOKING_FALLBACK_IMAGE, useBookingCard } from '../../../hooks/useBookingCard';

// ─── Constants ───────────────────────────────────────────────────────────────


// Tooka brand colours
const C = {
  primary: '#FFAE2B',
  primaryDark: '#F59B00',
  white: '#FFFFFF',
  bg: '#FFF8F0',
  cardBg: '#FFFFFF',
  border: '#F2EBE1',
  heading: '#1E1E1E',
  body: '#4D4D4D',
  muted: '#8A8A8A',
  divider: '#F0EAE0',
  completed: '#2DB87A',
  completedBg: '#E6F9EF',
  cancelled: '#D94A45',
  cancelledBg: '#FBE9E8',
  pending: '#B26A00',
  pendingBg: '#FFF1D6',
  outlinedBorder: '#FFAE2B',
};

export type { BookingSection };

export type BookingCardProps = {
  booking: BackendBookingListItem;
  style?: StyleProp<ViewStyle>;
};

// ─── Sub-component: StatusBadge ───────────────────────────────────────────────

type StatusBadgeProps = {
  section: BookingSection;
};

const StatusBadge = React.memo<StatusBadgeProps>(function StatusBadge({
  section,
}) {
  if (section === 'upcoming') {
    return null;
  }

  const isCompleted = section === 'completed';

  return (
    <View
      style={[
        styles.badge,
        isCompleted ? styles.badgeCompleted : styles.badgeCancelled,
      ]}
      accessibilityRole="text"
      accessibilityLabel={isCompleted ? 'Booking completed' : 'Booking cancelled'}
    >
      <Text
        style={[
          styles.badgeText,
          isCompleted ? styles.badgeTextCompleted : styles.badgeTextCancelled,
        ]}
      >
        {isCompleted ? 'Completed' : 'Cancelled'}
      </Text>
    </View>
  );
});

// ─── Sub-component: PaymentPendingBadge ───────────────────────────────────────

const PaymentPendingBadge = React.memo(function PaymentPendingBadge({
  label,
}: {
  label: string;
}) {
  return (
    <View
      style={[styles.badge, styles.badgePending]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.badgeText, styles.badgeTextPending]}>
        {label}
      </Text>
    </View>
  );
});

// ─── Sub-component: BookingActions ────────────────────────────────────────────

type BookingActionsProps = {
  onCall: () => void;
};

// Only rendered for upcoming, confirmed bookings with a spa to call (see BookingCard).
const BookingActions = React.memo<BookingActionsProps>(function BookingActions({
  onCall,
}) {
  return (
    <View style={styles.actionsRow}>
      <Pressable
        onPress={onCall}
        style={({ pressed }) => [
          styles.actionBtn,
          styles.actionBtnPrimary,
          styles.actionBtnHalf,
          pressed && styles.actionBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Free call spa"
      >
        <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
          Free Call Spa
        </Text>
      </Pressable>
    </View>
  );
});

// ─── Sub-component: PendingPaymentActions ─────────────────────────────────────

// For pending_payment bookings. Every one of them used to say "Payment processing"
// forever, even when the user had simply cancelled at the gateway, with no way to pay.
const PendingPaymentActions = React.memo(function PendingPaymentActions({
  inFlight,
  starting,
  onCompletePayment,
}: {
  inFlight: boolean;
  starting: boolean;
  onCompletePayment: () => void;
}) {
  if (inFlight) {
    return (
      <Text style={styles.pendingNote}>
        We'll confirm this booking as soon as your payment is verified.
      </Text>
    );
  }

  return (
    <View style={styles.actionsRow}>
      <Pressable
        onPress={onCompletePayment}
        disabled={starting}
        style={({ pressed }) => [
          styles.actionBtn,
          styles.actionBtnPrimary,
          styles.actionBtnHalf,
          (pressed || starting) && styles.actionBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Complete payment"
        accessibilityState={{ disabled: starting, busy: starting }}
      >
        {starting ? (
          <ActivityIndicator color={C.white} />
        ) : (
          <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
            Complete payment
          </Text>
        )}
      </Pressable>
    </View>
  );
});

// ─── Main Component: BookingCard ──────────────────────────────────────────────

const BookingCard = React.memo<BookingCardProps>(function BookingCard({
  booking,
  style,
}) {
  const { width } = useWindowDimensions();
  const {
    badgeDate,
    bookingCode,
    handleCompletePayment,
    handleFreeCallSpa,
    handleOpenMaps,
    isPaymentPending,
    locationText,
    paymentInFlight,
    section,
    spaId,
    starting,
  } = useBookingCard(booking);

  const imageWidth = Math.min(Math.floor(width * 0.28), 115);

  return (
    <View style={[styles.card, style]} accessibilityRole="none">
      {/* ── Main Content Row ── */}
      <View style={styles.mainRow}>
        {/* Left Column: Spa Image + Overlapping Date Badge */}
        <View style={[styles.imageCol, { width: imageWidth }]}>
          <Image
            source={
              booking.raw?.spa_snapshot?.cover_photo_url
                ? { uri: booking.raw.spa_snapshot.cover_photo_url }
                : BOOKING_FALLBACK_IMAGE
            }
            style={styles.spaImage}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel={`${booking.spaName} spa image`}
          />
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeDay}>{badgeDate.day}</Text>
            <Text style={styles.dateBadgeMonth}>{badgeDate.month}</Text>
          </View>
        </View>

        {/* Right Column: Details */}
        <View style={styles.detailsCol}>
          {/* Time + Reminder/Status Row */}
          <View style={styles.timeStatusRow}>
            <View style={styles.timeSubRow}>
              <Ionicons name="time-outline" size={14} color={C.primary} style={{ marginRight: 4 }} />
              <Text style={styles.timeText}>{booking.time || '--'}</Text>
            </View>
            {isPaymentPending ? (
              <PaymentPendingBadge
                label={paymentInFlight ? 'Payment processing' : 'Awaiting payment'}
              />
            ) : (
              <StatusBadge section={section} />
            )}
          </View>

          {/* Divider */}
          <View style={styles.timeDivider} />

          {/* Spa Name */}
          <Text style={styles.spaName} numberOfLines={1} ellipsizeMode="tail">
            {booking.spaName}
          </Text>

          {/* Location Row */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={C.primary} style={{ marginRight: 3 }} />
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
              {locationText}
            </Text>
          </View>

          {/* Open In Maps Row */}
          <Pressable
            onPress={handleOpenMaps}
            style={({ pressed }) => [
              styles.openMapsBtn,
              pressed && styles.openMapsBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open spa in Google Maps"
          >
            <View style={styles.openMapsLeft}>
              <Ionicons name="map-outline" size={13} color={C.primary} style={{ marginRight: 5 }} />
              <Text style={styles.openMapsText}>Open in maps</Text>
            </View>
            <Ionicons name="chevron-forward" size={13} color={C.primary} />
          </Pressable>

          {/* Booking ID Row */}
          <View style={styles.bookingIdRow}>
            <Text style={styles.bookingIdLabel}>Booking ID </Text>
            <Text style={styles.bookingIdSep}>| </Text>
            <Text style={styles.bookingIdValue} numberOfLines={1} ellipsizeMode="tail">
              {bookingCode}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Bottom Actions ── */}
      {/* Not confirmed until the payment clears, so no call action yet. */}
      {isPaymentPending ? (
        <PendingPaymentActions
          inFlight={paymentInFlight}
          starting={starting}
          onCompletePayment={handleCompletePayment}
        />
      ) : section === 'upcoming' && spaId ? (
        // No spa id: there is nobody to call (this used to dial the placeholder 'unknown_spa').
        <BookingActions onCall={handleFreeCallSpa} />
      ) : null}
    </View>
  );
});

export default BookingCard;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Image & Date Badge
  imageCol: {
    position: 'relative',
    height: 145,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F0EAE0',
    flexShrink: 0,
  },
  spaImage: {
    width: '100%',
    height: '100%',
  },
  dateBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: C.primary,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
  },
  dateBadgeDay: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: C.white,
    lineHeight: 20,
  },
  dateBadgeMonth: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 11,
    color: C.white,
    lineHeight: 13,
  },

  // Right Details Column
  detailsCol: {
    flex: 1,
    flexShrink: 1,
    justifyContent: 'space-between',
  },

  // Time & Status Row
  timeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    color: C.muted,
  },
  timeDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginVertical: 4,
  },

  // Spa Name & Location
  spaName: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: C.heading,
    marginTop: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: C.muted,
    flex: 1,
  },

  // Open In Maps
  openMapsBtn: {
    backgroundColor: '#FFF8F0',
    borderRadius: 8,
    height: 30,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  openMapsBtnPressed: {
    opacity: 0.75,
  },
  openMapsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openMapsText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    color: C.primary,
  },

  // Booking ID
  bookingIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  bookingIdLabel: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 11,
    color: C.muted,
  },
  bookingIdSep: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 11,
    color: '#CCC4B8',
  },
  bookingIdValue: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 11,
    color: C.heading,
    flexShrink: 1,
  },

  // Status Badges
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeCompleted: {
    backgroundColor: C.completedBg,
  },
  badgeCancelled: {
    backgroundColor: C.cancelledBg,
  },
  badgeText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextCompleted: {
    color: C.completed,
  },
  badgeTextCancelled: {
    color: C.cancelled,
  },
  badgePending: {
    backgroundColor: C.pendingBg,
  },
  badgeTextPending: {
    color: C.pending,
  },
  pendingNote: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 10,
    textAlign: 'center',
  },

  // Actions Row
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  actionBtn: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionBtnHalf: {
    flex: 1,
  },
  actionBtnFull: {
    flex: 1,
  },
  actionBtnPrimary: {
    backgroundColor: C.primary,
  },
  actionBtnOutlined: {
    borderWidth: 1,
    borderColor: C.outlinedBorder,
    backgroundColor: C.white,
  },
  actionBtnPressed: {
    opacity: 0.8,
  },
  actionBtnText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnTextPrimary: {
    color: C.white,
  },
  actionBtnTextOutlined: {
    color: C.primaryDark,
  },
});
