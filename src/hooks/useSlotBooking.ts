import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BookingApi from '../api/BookingApi';
import { useAuth } from '../context/AuthContext';
import { usePaymentContext } from '../context/PaymentContext';
import { useProfile } from '../context/ProfileContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { TimeSlot } from '../screens/Booking/types';
import type { BookingSlot } from '../types/booking';
import { getGuestName } from '../utils/bookingGuest';
import { buildBookingDateAndTime } from '../utils/bookingDateTime';
import {
  buildScheduleDates,
  formatShortDate,
  formatTimeLabel,
  getSlotBookingErrorMessage,
} from '../utils/bookingSchedule';

/** What the payment and result screens show about the booking. */
export interface SlotBookingDetails {
  spaName?: string;
  spaImage?: string;
  location?: string;
  serviceName: string;
  serviceDurationMinutes: number | null;
}

interface UseSlotBookingOptions {
  /** The spa being booked. In Explore this changes as the user swipes. */
  spaId: string | undefined;
  /** Load availability only while true (Explore: while its sheet is open). */
  enabled: boolean;
  /** Date/slot to restore, e.g. after returning from Login. */
  initialDateId?: string;
  initialSlotId?: string;
  details: SlotBookingDetails;
}

/**
 * Date/slot selection, the booking summary, and "create booking + start payment"
 * for one spa. Shared by SpaDetailsScreen and ExploreScreen, which each had their
 * own copy of this logic - and Explore's had missed the auto-selection of the next
 * open slot and the booking summary step.
 */
export function useSlotBooking({
  spaId,
  enabled,
  initialDateId,
  initialSlotId,
  details,
}: UseSlotBookingOptions) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { initiatePayment, setBookingSummary } = usePaymentContext();

  const scheduleDates = useMemo(() => buildScheduleDates(), []);
  const isScheduleDate = useCallback(
    (dateId?: string) => Boolean(dateId && scheduleDates.some((d) => d.id === dateId)),
    [scheduleDates],
  );

  const [selectedDateId, setSelectedDateId] = useState(
    isScheduleDate(initialDateId) ? (initialDateId as string) : scheduleDates[0]?.id ?? '',
  );
  const [selectedSlotId, setSelectedSlotId] = useState(initialSlotId ?? '');
  // A slot to restore once its date's availability arrives.
  const pendingSlotIdRef = useRef<string>(initialSlotId ?? '');
  const selectedSlotIdRef = useRef<string>(selectedSlotId);
  // On first load, move to the next date when the current one has no open slots.
  const autoAdvanceDateRef = useRef(!initialDateId && !initialSlotId);

  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requestIdRef = useRef(0);
  const availabilityControllerRef = useRef<AbortController | null>(null);
  // Double-tap guard: `submitting` is state, so a fast second tap ran before it
  // updated and created a second booking.
  const confirmLockRef = useRef(false);
  // A booking created when starting its payment then failed. Retrying the same slot
  // reuses it instead of leaving it pending and creating another one.
  const unpaidBookingRef = useRef<{
    slotId: string;
    bookingId: string;
    bookingReference?: string;
  } | null>(null);

  useEffect(() => {
    selectedSlotIdRef.current = selectedSlotId;
  }, [selectedSlotId]);

  useEffect(() => {
    if (isScheduleDate(initialDateId)) {
      setSelectedDateId(initialDateId as string);
    }
  }, [initialDateId, isScheduleDate]);

  useEffect(() => {
    if (initialSlotId) {
      pendingSlotIdRef.current = initialSlotId;
      setSelectedSlotId(initialSlotId);
    }
  }, [initialSlotId]);

  // A different spa (Explore carousel): start over from today with auto-selection,
  // instead of carrying the previous spa's date, slot and slots across.
  const previousSpaIdRef = useRef(spaId);
  useEffect(() => {
    if (previousSpaIdRef.current === spaId) return;
    previousSpaIdRef.current = spaId;

    availabilityControllerRef.current?.abort();
    autoAdvanceDateRef.current = true;
    pendingSlotIdRef.current = '';
    selectedSlotIdRef.current = '';
    unpaidBookingRef.current = null;
    setSelectedSlotId('');
    setSlots([]);
    setAvailabilityError(null);
    setSummaryVisible(false);
    setSelectedDateId(scheduleDates[0]?.id ?? '');
  }, [spaId, scheduleDates]);

  const selectedDate = useMemo(
    () => scheduleDates.find((d) => d.id === selectedDateId) ?? scheduleDates[0],
    [scheduleDates, selectedDateId],
  );

  const timeSlots = useMemo<TimeSlot[]>(
    () =>
      slots.map((slot) => ({
        id: slot.slotId,
        label: formatTimeLabel(slot.startTime),
        status: slot.status,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    [slots],
  );

  const selectedSlot = useMemo(
    () => slots.find((s) => s.slotId === selectedSlotId && s.status === 'available'),
    [selectedSlotId, slots],
  );

  const loadAvailability = useCallback(
    async (date: string | undefined) => {
      if (!spaId || !date) return;

      availabilityControllerRef.current?.abort();
      const controller = new AbortController();
      availabilityControllerRef.current = controller;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setLoadingSlots(true);
      setAvailabilityError(null);
      if (!pendingSlotIdRef.current && !selectedSlotIdRef.current) {
        setSelectedSlotId('');
      }

      let advancingToNextDate = false;

      try {
        const nextSlots = await BookingApi.getAvailability({
          spaId,
          date,
          signal: controller.signal,
        });

        if (requestIdRef.current === requestId) {
          setSlots(nextSlots);
          const availableSlots = nextSlots.filter((s) => s.status === 'available');
          const targetSlotId = pendingSlotIdRef.current || selectedSlotIdRef.current;
          // Keep the requested slot if still open, otherwise the next available one.
          const slotToSelect =
            availableSlots.find((s) => s.slotId === targetSlotId) ?? availableSlots[0];

          if (slotToSelect) {
            autoAdvanceDateRef.current = false;
            setSelectedSlotId(slotToSelect.slotId);
          } else {
            setSelectedSlotId('');
            const dateIndex = scheduleDates.findIndex((d) => d.date === date);
            const nextDate = dateIndex >= 0 ? scheduleDates[dateIndex + 1] : undefined;
            if (autoAdvanceDateRef.current && nextDate) {
              advancingToNextDate = true;
              setSelectedDateId(nextDate.id);
            } else {
              autoAdvanceDateRef.current = false;
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        if (requestIdRef.current === requestId) {
          autoAdvanceDateRef.current = false;
          setSlots([]);
          setAvailabilityError(getSlotBookingErrorMessage(err));
        }
      } finally {
        // When moving to the next date, keep the loader up until its slots arrive.
        if (requestIdRef.current === requestId && !advancingToNextDate) {
          setLoadingSlots(false);
          availabilityControllerRef.current = null;
        }
      }
    },
    [spaId, scheduleDates],
  );

  useEffect(() => {
    if (!enabled) return;
    loadAvailability(selectedDate?.date);
    return () => {
      availabilityControllerRef.current?.abort();
    };
  }, [enabled, loadAvailability, selectedDate?.date]);

  /** Re-fetch the current date's slots (pull-to-refresh). */
  const reloadAvailability = useCallback(() => {
    loadAvailability(selectedDate?.date);
  }, [loadAvailability, selectedDate?.date]);

  const selectDate = useCallback((dateId: string) => {
    autoAdvanceDateRef.current = false;
    setSelectedDateId(dateId);
    setSelectedSlotId('');
    pendingSlotIdRef.current = '';
  }, []);

  const selectSlot = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
    pendingSlotIdRef.current = slotId;
  }, []);

  /** Show the booking summary for the selected slot. */
  const openSummary = useCallback(() => {
    if (!selectedSlot) {
      Alert.alert('Select Time Slot', 'Please select an available time slot to continue.');
      return;
    }
    setSummaryVisible(true);
  }, [selectedSlot]);

  const closeSummary = useCallback(() => {
    setSummaryVisible(false);
  }, []);

  /** Confirmed from the summary: create the booking and start the payment. */
  const confirmBooking = useCallback(async () => {
    if (!selectedSlot || !spaId) {
      setSummaryVisible(false);
      return;
    }

    const guestName = getGuestName(profile, user);
    if (!guestName) {
      // The spa needs a real name; bookings without one used to be sent as "Guest".
      setSummaryVisible(false);
      Alert.alert(
        'Add your name',
        'The spa needs your name for the booking. Add it to your profile, then book again.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Add name', onPress: () => navigation.navigate('EditProfile') },
        ],
      );
      return;
    }
    const guestPhone = profile?.phone ?? user?.phoneNumber ?? user?.phone ?? '';

    if (confirmLockRef.current) {
      return;
    }
    confirmLockRef.current = true;
    setSubmitting(true);

    let bookingId = '';
    let bookingReference: string | undefined;
    const appointmentTime = formatTimeLabel(selectedSlot.startTime);
    const bookingSummary = {
      ...details,
      appointmentDate: selectedSlot.date,
      appointmentTime,
      bookingDateAndTime: buildBookingDateAndTime({
        appointmentDate: selectedSlot.date,
        appointmentTime,
      }),
    };

    const reusableBooking =
      unpaidBookingRef.current?.slotId === selectedSlot.slotId ? unpaidBookingRef.current : null;

    if (reusableBooking) {
      bookingId = reusableBooking.bookingId;
      bookingReference = reusableBooking.bookingReference;
    } else {
      try {
        const response = await BookingApi.createDirectBooking({
          spa_id: spaId,
          slot_id: selectedSlot.slotId,
          appointment_at: `${selectedSlot.date}T${selectedSlot.startTime}Z`,
          guest_name: guestName,
          guest_phone: guestPhone,
          guest_count: 1,
        });

        bookingId = response.id;
        if (!bookingId) {
          throw new Error('Booking response did not include a booking ID.');
        }
        bookingReference = response.booking_ref ?? undefined;
        unpaidBookingRef.current = { slotId: selectedSlot.slotId, bookingId, bookingReference };
      } catch (err) {
        Alert.alert('Booking failed', getSlotBookingErrorMessage(err));
        setSubmitting(false);
        confirmLockRef.current = false;
        return;
      }
    }

    try {
      setBookingSummary(bookingSummary);
      const paymentContext = await initiatePayment(bookingId, bookingReference, bookingSummary);

      setSummaryVisible(false);
      navigation.navigate('PaymentScreen', {
        paymentId: paymentContext.paymentId,
        bookingId: paymentContext.bookingId,
        bookingRef: paymentContext.bookingRef,
        paymentSessionId: paymentContext.paymentSessionId,
        cashfreeOrderId: paymentContext.cashfreeOrderId,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        spaName: paymentContext.spaName,
        spaImage: paymentContext.spaImage,
        location: paymentContext.location,
        serviceName: paymentContext.serviceName,
        serviceDurationMinutes: paymentContext.serviceDurationMinutes,
        appointmentDate: paymentContext.appointmentDate,
        appointmentTime: paymentContext.appointmentTime,
        bookingDateAndTime: paymentContext.bookingDateAndTime,
      });
      // The booking now belongs to this payment flow (BookingResult retries it).
      unpaidBookingRef.current = null;
    } catch (err) {
      Alert.alert('Payment initiation failed', getSlotBookingErrorMessage(err));
    } finally {
      setSubmitting(false);
      confirmLockRef.current = false;
    }
  }, [selectedSlot, spaId, profile, user, details, navigation, setBookingSummary, initiatePayment]);

  const summaryDateLabel = selectedSlot
    ? [scheduleDates.find((d) => d.date === selectedSlot.date)?.label, formatShortDate(selectedSlot.date)]
        .filter(Boolean)
        .join(', ')
    : '';
  const summaryTimeLabel = selectedSlot ? formatTimeLabel(selectedSlot.startTime) : '';

  return {
    scheduleDates,
    selectedDateId,
    selectedSlotId,
    selectedSlot,
    timeSlots,
    loadingSlots,
    availabilityError,
    reloadAvailability,
    selectDate,
    selectSlot,
    summaryVisible,
    summaryDateLabel,
    summaryTimeLabel,
    openSummary,
    closeSummary,
    submitting,
    confirmBooking,
  };
}
