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

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BackendBookingListItem, BookingSection } from '../../../types/booking';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { getBookingSection } from '../../../utils/getBookingSection';

// ─── Constants ───────────────────────────────────────────────────────────────

const FALLBACK_IMAGE = {
  uri: 'https://d2f15ematxpwp4.cloudfront.net/appImages/bookingPlaceholder.png',
};

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
  outlinedBorder: '#FFAE2B',
};

export type { BookingSection };

export type BookingCardProps = {
  booking: BackendBookingListItem;
  style?: StyleProp<ViewStyle>;
};

// ─── Helper: Date Badge Parser ───────────────────────────────────────────────

const parseDateBadge = (dateStr?: string): { day: string; month: string } => {
  if (!dateStr || typeof dateStr !== 'string') {
    return { day: '--', month: '--' };
  }
  const clean = dateStr.trim();
  if (!clean) return { day: '--', month: '--' };

  const parts = clean.split(/[\s,-]+/);
  if (parts.length >= 2) {
    if (/^\d{1,2}$/.test(parts[0])) {
      const day = parts[0];
      const rawMonth = parts[1];
      const month = rawMonth.length > 3 ? rawMonth.substring(0, 3) : rawMonth;
      return { day, month };
    }
    if (parts[0].length === 4 && /^\d{4}$/.test(parts[0])) {
      const dateObj = new Date(clean);
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate());
        const month = dateObj.toLocaleString('en-US', { month: 'short' });
        return { day, month };
      }
    }
  }

  const dateObj = new Date(clean);
  if (!isNaN(dateObj.getTime())) {
    const day = String(dateObj.getDate());
    const month = dateObj.toLocaleString('en-US', { month: 'short' });
    return { day, month };
  }

  return { day: '--', month: clean.substring(0, 3) };
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

// ─── Sub-component: ReminderToggle ────────────────────────────────────────────

const ReminderToggle = React.memo(function ReminderToggle() {
  const [enabled, setEnabled] = useState(false);

  const toggle = useCallback(() => setEnabled(v => !v), []);

  return (
    <View style={styles.reminderRow} accessibilityRole="none">
      <Text style={styles.reminderLabel}>Remind me</Text>
      <Switch
        value={enabled}
        onValueChange={toggle}
        trackColor={{ false: '#E0D8CC', true: C.primary }}
        thumbColor={C.white}
        ios_backgroundColor="#E0D8CC"
        accessibilityRole="switch"
        accessibilityLabel="Set booking reminder"
        accessibilityState={{ checked: enabled }}
        style={styles.reminderSwitch}
      />
    </View>
  );
});

// ─── Sub-component: BookingActions ────────────────────────────────────────────

type BookingActionsProps = {
  section: BookingSection;
  booking: BackendBookingListItem;
};

const BookingActions = React.memo<BookingActionsProps>(function BookingActions({
  section,
  booking,
}) {
  const handleChatWithSpa = useCallback(() => {
    // Navigation / business logic preserved externally
  }, []);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleFreeCallSpa = useCallback(() => {
    navigation.navigate('CallScreen', {
      bookingId: booking.id,
      spaId: (booking.raw.spa_id as string) || (booking.raw.spa as any)?.id || 'unknown_spa',
      callType: 'voice',
      spaName: booking.spaName || 'Unknown Spa',
      spaAvatar: booking.raw?.spa_snapshot?.cover_photo_url || FALLBACK_IMAGE.uri,
    });
  }, [navigation, booking]);

  const handleBookAgain = useCallback(() => {
    // Navigation / business logic preserved externally
  }, []);

  const handleViewReceipt = useCallback(() => {
    // Navigation / business logic preserved externally
  }, []);

  if (section === 'upcoming') {
    return (
      <View style={styles.actionsRow}>
        {/* <Pressable
          onPress={handleChatWithSpa}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnOutlined,
            styles.actionBtnHalf,
            pressed && styles.actionBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Chat with spa"
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextOutlined]}>
            Chat With Spa
          </Text>
        </Pressable> */}

        <Pressable
          onPress={handleFreeCallSpa}
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
  }

  // if (section === 'completed') {
  //   return (
  //     <View style={styles.actionsRow}>
  //       <Pressable
  //         onPress={handleBookAgain}
  //         style={({ pressed }) => [
  //           styles.actionBtn,
  //           styles.actionBtnPrimary,
  //           styles.actionBtnHalf,
  //           pressed && styles.actionBtnPressed,
  //         ]}
  //         accessibilityRole="button"
  //         accessibilityLabel="Book again"
  //       >
  //         <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
  //           Book Again
  //         </Text>
  //       </Pressable>

  //       <Pressable
  //         onPress={handleViewReceipt}
  //         style={({ pressed }) => [
  //           styles.actionBtn,
  //           styles.actionBtnOutlined,
  //           styles.actionBtnHalf,
  //           pressed && styles.actionBtnPressed,
  //         ]}
  //         accessibilityRole="button"
  //         accessibilityLabel="View receipt"
  //       >
  //         <Text style={[styles.actionBtnText, styles.actionBtnTextOutlined]}>
  //           View Receipt
  //         </Text>
  //       </Pressable>
  //     </View>
  //   );
  // }

  // Cancelled — full-width outlined button
  return (
    <View style={styles.actionsRow}>
      {/* <Pressable
        onPress={handleViewReceipt}
        style={({ pressed }) => [
          styles.actionBtn,
          styles.actionBtnOutlined,
          styles.actionBtnFull,
          pressed && styles.actionBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="View receipt"
      >
        <Text style={[styles.actionBtnText, styles.actionBtnTextOutlined]}>
          View Receipt
        </Text>
      </Pressable> */}
    </View>
  );
});

// ─── Main Component: BookingCard ──────────────────────────────────────────────

const BookingCard = React.memo<BookingCardProps>(function BookingCard({
  booking,
  style,
}) {
  const { width } = useWindowDimensions();

  const section: BookingSection =
    (getBookingSection(booking.status) as BookingSection | null) ?? 'upcoming';

  const bookingCode = booking.bookingReference ?? booking.bookingId ?? 'Pending';
  const badgeDate = useMemo(() => parseDateBadge(booking.date), [booking.date]);

  const locationText = useMemo(() => {
    const locality = booking.raw?.spa_snapshot?.locality_name;
    const city = booking.raw?.spa_snapshot?.city_name;
    const parts = [locality, city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location unavailable';
  }, [booking.raw?.spa_snapshot?.locality_name, booking.raw?.spa_snapshot?.city_name]);

  const handleOpenMaps = useCallback(async () => {
    const snapshot = booking.raw?.spa_snapshot as any;
    const mapUrl = snapshot?.google_maps_url;
    let targetUrl = typeof mapUrl === 'string' && mapUrl.trim() ? mapUrl.trim() : '';

    if (!targetUrl) {
      const spaName = booking.spaName ?? '';
      const locality = snapshot?.locality_name ?? '';
      const city = snapshot?.city_name ?? '';
      const query = encodeURIComponent(`${spaName} ${locality} ${city}`.trim());
      targetUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
      } else {
        Alert.alert('Unable to open map', 'No maps application is available to open this link.');
      }
    } catch {
      Alert.alert('Unable to open map', 'An error occurred while opening maps.');
    }
  }, [booking]);

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
                : FALLBACK_IMAGE
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
            {section === 'upcoming' ? (
              <ReminderToggle />
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
      {section === 'upcoming' &&
        <BookingActions section={section} booking={booking} />
      }
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

  // Reminder Toggle
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reminderLabel: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 11,
    color: C.muted,
  },
  reminderSwitch: {
    transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }],
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
