import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { usePaymentContext } from '../context/PaymentContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { mapPaymentError } from '../payment/PaymentMapper';
import { bookingOption } from '../screens/Booking/bookingData';
import type { BackendBookingListItem, BookingSection } from '../types/booking';
import { buildBookingDateAndTime } from '../utils/bookingDateTime';
import { getBookingSection, isPaymentPendingStatus } from '../utils/getBookingSection';

export const BOOKING_FALLBACK_IMAGE = {
  uri: 'https://d2f15ematxpwp4.cloudfront.net/appImages/bookingPlaceholder.png',
};

export const parseDateBadge = (dateStr?: string): { day: string; month: string } => {
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

const getSpaId = (booking: BackendBookingListItem): string | undefined =>
  (booking.raw.spa_id as string | undefined) ||
  ((booking.raw.spa as { id?: string } | undefined)?.id ?? undefined);

/** A payment is mid-flight (e.g. confirming in a UPI app): wait, do not pay again. */
const isPaymentInFlight = (booking: BackendBookingListItem): boolean =>
  (booking.paymentStatus ?? '').toString().trim().toLowerCase() === 'processing';

/** One booking card's data and actions, shared by the old and v4 cards. */
export function useBookingCard(booking: BackendBookingListItem) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { initiatePayment, setBookingSummary } = usePaymentContext();
  const [starting, setStarting] = useState(false);

  const section: BookingSection =
    (getBookingSection(booking.status) as BookingSection | null) ?? 'upcoming';
  const isPaymentPending = isPaymentPendingStatus(booking.status);
  const paymentInFlight = isPaymentInFlight(booking);
  const spaId = getSpaId(booking);
  const coverPhoto = booking.raw?.spa_snapshot?.cover_photo_url;

  const bookingCode = booking.bookingReference ?? booking.bookingId ?? 'Pending';
  const badgeDate = useMemo(() => parseDateBadge(booking.date), [booking.date]);

  const locationText = useMemo(() => {
    const locality = booking.raw?.spa_snapshot?.locality_name;
    const city = booking.raw?.spa_snapshot?.city_name;
    const parts = [locality, city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location unavailable';
  }, [booking.raw?.spa_snapshot?.locality_name, booking.raw?.spa_snapshot?.city_name]);

  const handleFreeCallSpa = useCallback(() => {
    if (!spaId) return;
    navigation.navigate('CallScreen', {
      bookingId: booking.id,
      spaId,
      callType: 'voice',
      spaName: booking.spaName || 'Unknown Spa',
      spaAvatar: booking.raw?.spa_snapshot?.cover_photo_url || BOOKING_FALLBACK_IMAGE.uri,
    });
  }, [navigation, booking, spaId]);

  const handleCompletePayment = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const snapshot = booking.raw?.spa_snapshot;
      const summary = {
        spaName: booking.spaName,
        spaImage: snapshot?.cover_photo_url ?? undefined,
        location: [snapshot?.locality_name, snapshot?.city_name].filter(Boolean).join(', ') || undefined,
        serviceName: booking.serviceName ?? bookingOption.title,
        serviceDurationMinutes: null,
        appointmentDate: booking.date,
        appointmentTime: booking.time,
        bookingDateAndTime: buildBookingDateAndTime({
          appointmentDate: booking.date,
          appointmentTime: booking.time,
        }),
      };
      setBookingSummary(summary);
      const payment = await initiatePayment(
        booking.id,
        booking.bookingReference ?? undefined,
        summary,
      );
      navigation.navigate('PaymentScreen', {
        paymentId: payment.paymentId,
        bookingId: payment.bookingId,
        bookingRef: payment.bookingRef,
        paymentSessionId: payment.paymentSessionId,
        cashfreeOrderId: payment.cashfreeOrderId,
        amount: payment.amount,
        currency: payment.currency,
        spaName: payment.spaName,
        spaImage: payment.spaImage,
        location: payment.location,
        serviceName: payment.serviceName,
        serviceDurationMinutes: payment.serviceDurationMinutes,
        appointmentDate: payment.appointmentDate,
        appointmentTime: payment.appointmentTime,
        bookingDateAndTime: payment.bookingDateAndTime,
      });
    } catch (error) {
      Alert.alert("Couldn't start the payment", mapPaymentError(error).userMessage);
    } finally {
      setStarting(false);
    }
  }, [booking, initiatePayment, navigation, setBookingSummary, starting]);

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

  return {
    badgeDate,
    bookingCode,
    coverPhoto,
    handleCompletePayment,
    handleFreeCallSpa,
    handleOpenMaps,
    isPaymentPending,
    locationText,
    paymentInFlight,
    section,
    spaId,
    starting,
  };
}
