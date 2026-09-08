import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';

import SpaDetailsContent from './SpaDetailsContent';
import { useSpaDetails } from '../../hooks/useSpaDetails';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { usePaymentContext } from '../../context/PaymentContext';
import BookingApi from '../../api/BookingApi';
import EnquiryModal from '../../components/EnquiryModal';
import EnquirySuccessModal from '../../components/EnquirySuccessModal';
import { useEnquiry } from '../../hooks/useEnquiry';
import type { EnquiryFormValues } from '../../types/Enquiry';
import type { BookingScheduleDate, BookingSlot } from '../../types/booking';
import type { BookingDate, TimeSlot } from '../Booking/types';
import { bookingOption } from '../Booking/bookingData';
import { buildBookingDateAndTime } from '../../utils/bookingDateTime';
import { Analytics, AnalyticsEvents, AnalyticsParams } from '../../services/firebase/analytics';
import { Crashlytics, CrashlyticsKeys } from '../../services/firebase/crashlytics';

type SpaDetailsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SpaDetails'
>;
type SpaDetailsRouteProp = RouteProp<RootStackParamList, 'SpaDetails'>;

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatTabLabel = (date: Date, index: number): string => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return 'Day After';
};

const buildScheduleDates = (): BookingScheduleDate[] => {
  const today = new Date();
  return [0, 1, 2].map((offset) => {
    const date = addDays(today, offset);
    const dateKey = toDateKey(date);
    return {
      id: dateKey,
      label: formatTabLabel(date, offset),
      date: dateKey,
    };
  });
};

const formatTimeLabel = (time: string): string => {
  const [hoursRaw, minutesRaw = '00'] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${pad(twelveHour)}:${pad(minutes)} ${period}`;
};

const getErrorMessage = (error: unknown): string => {
  if (axios.isCancel(error)) return '';
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (error.message.toLowerCase().includes('network')) {
      return 'You are offline. Please check your internet connection.';
    }
  }
  return 'Something went wrong. Please try again.';
};

function SpaDetailsScreen(): React.ReactElement {
  const navigation = useNavigation<SpaDetailsNavigationProp>();
  const route = useRoute<SpaDetailsRouteProp>();
  const {
    spaId,
    serviceId,
    serviceName,
    openEnquiry,
    openBooking,
    selectedDateId: paramDateId,
    selectedSlotId: paramSlotId,
    fromLogin,
    fromScreen,
  } = route.params;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { spa, refreshing, error, refetch, onRefresh } = useSpaDetails(spaId);
  const { isAuthenticated, user } = useAuth();
  const { profile } = useProfile();
  const { initiatePayment, setBookingSummary } = usePaymentContext();
  const [enquiryVisible, setEnquiryVisible] = useState(false);

  // Availability & Booking State
  const scheduleDates = useMemo(() => buildScheduleDates(), []);
  const [selectedDateId, setSelectedDateId] = useState(
    paramDateId && scheduleDates.some((d) => d.id === paramDateId)
      ? paramDateId
      : scheduleDates[0]?.id ?? '',
  );
  const [selectedSlotId, setSelectedSlotId] = useState(paramSlotId ?? '');
  const pendingSlotIdRef = useRef<string>(paramSlotId ?? '');
  const selectedSlotIdRef = useRef<string>(selectedSlotId);

  useEffect(() => {
    selectedSlotIdRef.current = selectedSlotId;
  }, [selectedSlotId]);

  useEffect(() => {
    if (paramDateId && scheduleDates.some((d) => d.id === paramDateId)) {
      setSelectedDateId(paramDateId);
    }
  }, [paramDateId, scheduleDates]);

  useEffect(() => {
    if (paramSlotId) {
      pendingSlotIdRef.current = paramSlotId;
      setSelectedSlotId(paramSlotId);
    }
  }, [paramSlotId]);

  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestIdRef = useRef(0);
  const availabilityControllerRef = useRef<AbortController | null>(null);

  const [selectedService, setSelectedService] = useState<{
    id?: string;
    name?: string;
  }>({
    id: serviceId,
    name: serviceName,
  });

  const selectedDate = useMemo(
    () => scheduleDates.find((d) => d.id === selectedDateId) ?? scheduleDates[0],
    [scheduleDates, selectedDateId],
  );

  const bookingDates = useMemo<BookingDate[]>(
    () =>
      scheduleDates.map((date) => ({
        id: date.id,
        label: date.label,
        date: date.date,
      })),
    [scheduleDates],
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

  useEffect(() => {
    if (!spa) return;
    Analytics.logEvent(AnalyticsEvents.SPA_VIEWED, {
      [AnalyticsParams.SPA_ID]: spa.id,
      [AnalyticsParams.SPA_NAME]: spa.name,
    });
  }, [spa]);

  useEffect(() => {
    setSelectedService({ id: serviceId, name: serviceName });
  }, [serviceId, serviceName]);

  useEffect(() => {
    if (openEnquiry) {
      navigation.setParams({ openEnquiry: false });
    }
  }, [navigation, openEnquiry]);

  // Load Availability
  const loadAvailability = useCallback(
    async (date: string) => {
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

      try {
        const nextSlots = await BookingApi.getAvailability({
          spaId,
          date,
          signal: controller.signal,
        });

        if (requestIdRef.current === requestId) {
          setSlots(nextSlots);
          const targetSlotId = pendingSlotIdRef.current || selectedSlotIdRef.current;
          if (
            targetSlotId &&
            nextSlots.some((s) => s.slotId === targetSlotId && s.status === 'available')
          ) {
            setSelectedSlotId(targetSlotId);
          } else if (!nextSlots.some((s) => s.slotId === selectedSlotIdRef.current)) {
            setSelectedSlotId('');
          }
        }
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        if (requestIdRef.current === requestId) {
          setSlots([]);
          setAvailabilityError(getErrorMessage(err));
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoadingSlots(false);
          availabilityControllerRef.current = null;
        }
      }
    },
    [spaId],
  );

  useEffect(() => {
    loadAvailability(selectedDate?.date);
    return () => {
      availabilityControllerRef.current?.abort();
    };
  }, [loadAvailability, selectedDate?.date]);

  const handleSelectDate = useCallback((dateId: string) => {
    setSelectedDateId(dateId);
    setSelectedSlotId('');
    pendingSlotIdRef.current = '';
  }, []);

  const handleSelectSlot = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
    pendingSlotIdRef.current = slotId;
  }, []);

  // Primary Booking Proceed & Cashfree Payment Handler
  const handleProceedBooking = useCallback(async () => {
    if (spa && spa.is_bookable === false) {
      return;
    }

    const activeServiceId = selectedService.id ?? serviceId;
    const targetService = spa?.services?.find((s) => s.id === activeServiceId);

    if (!isAuthenticated) {
      navigation.navigate('Login', {
        spaId,
        serviceId: activeServiceId,
        serviceName: targetService?.name ?? serviceName,
        openBooking: true,
        selectedDateId,
        selectedSlotId: selectedSlotIdRef.current || selectedSlotId || undefined,
        fromScreen: fromScreen ?? 'Home',
      });
      return;
    }

    if (!selectedSlot) {
      Alert.alert('Select Time Slot', 'Please select an available time slot to continue.');
      return;
    }

    const guestName =
      profile?.fullName ??
      profile?.displayName ??
      user?.fullName ??
      user?.userName ??
      'Guest';
    const guestPhone = profile?.phone ?? user?.phoneNumber ?? user?.phone ?? '';

    setSubmitting(true);
    let bookingId = '';
    let bookingReference: string | undefined;
    const appointmentAt = `${selectedSlot.date}T${selectedSlot.startTime}Z`;

    const bookingSummary = {
      spaName: spa?.name,
      spaImage: targetService?.cover_image_url ?? spa?.cover_photo_url ?? undefined,
      location: spa?.locality_name ?? spa?.city_name ?? undefined,
      serviceName: targetService?.name ?? serviceName ?? spa?.name,
      serviceDurationMinutes: targetService?.duration_minutes ?? 60,
      appointmentDate: selectedSlot.date,
      appointmentTime: formatTimeLabel(selectedSlot.startTime),
      bookingDateAndTime: buildBookingDateAndTime({
        appointmentDate: selectedSlot.date,
        appointmentTime: formatTimeLabel(selectedSlot.startTime),
      }),
    };

    try {
      const response = await BookingApi.createDirectBooking({
        spa_id: spaId,
        slot_id: selectedSlot.slotId,
        appointment_at: appointmentAt,
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_count: 1,
      });

      bookingId = response.id;
      if (!bookingId) {
        throw new Error('Booking response did not include a booking ID.');
      }
      bookingReference = response.booking_ref ?? undefined;
    } catch (err) {
      Alert.alert('Booking failed', getErrorMessage(err));
      setSubmitting(false);
      return;
    }

    try {
      setBookingSummary(bookingSummary);
      const paymentContext = await initiatePayment(
        bookingId,
        bookingReference,
        bookingSummary,
      );

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
    } catch (err) {
      Alert.alert('Payment initiation failed', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [
    isAuthenticated,
    selectedService.id,
    serviceId,
    spa,
    serviceName,
    selectedSlot,
    profile,
    user,
    setBookingSummary,
    initiatePayment,
    navigation,
    spaId,
  ]);

  const handleBack = useCallback(() => {
    if (fromLogin) {
      if (fromScreen === 'Explore') {
        navigation.navigate('BottomNavigation', { screen: 'Explore' });
      } else {
        navigation.navigate('BottomNavigation', { screen: 'Home' });
      }
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (fromScreen === 'Explore') {
      navigation.navigate('BottomNavigation', { screen: 'Explore' });
    } else {
      navigation.navigate('BottomNavigation', { screen: 'Home' });
    }
  }, [fromLogin, fromScreen, navigation]);

  useEffect(() => {
    if (!fromLogin) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fromScreen === 'Explore') {
        navigation.navigate('BottomNavigation', { screen: 'Explore' });
      } else {
        navigation.navigate('BottomNavigation', { screen: 'Home' });
      }
      return true;
    });
    return () => backHandler.remove();
  }, [fromLogin, fromScreen, navigation]);

  if (spa) {
    Crashlytics.setCustomKey(CrashlyticsKeys.SPA_ID, spa.id);
    Crashlytics.setCustomKey(CrashlyticsKeys.SPA_NAME, spa.name);
  }

  const enquiryDefaults = useMemo(
    () => ({
      name: user?.userName ?? '',
      email: user?.email ?? '',
      message: '',
    }),
    [user?.userName, user?.email],
  );

  const enquiryContext = useMemo(
    () => ({
      spaId,
      spaName: spa?.name ?? 'Spa',
      spaImage: spa?.cover_photo_url ?? '',
      location: spa?.locality_name ?? spa?.city_name ?? 'Hyderabad',
      serviceId: selectedService.id,
      serviceName: selectedService.name,
    }),
    [spa?.city_name, spa?.cover_photo_url, spa?.locality_name, spa?.name, selectedService.id, selectedService.name, spaId],
  );

  const {
    loading: enquiryLoading,
    success,
    submitEnquiry,
    reset,
    closeSuccess,
  } = useEnquiry({
    spa: enquiryContext,
    onSuccess: () => setEnquiryVisible(false),
  });

  const handleSubmitEnquiry = useCallback(
    async (values: EnquiryFormValues) => {
      await submitEnquiry(values);
    },
    [submitEnquiry],
  );

  const handleCloseEnquiry = useCallback(() => {
    if (enquiryLoading) return;
    setEnquiryVisible(false);
    reset();
  }, [enquiryLoading, reset]);

  const handleSuccessDone = useCallback(() => {
    closeSuccess();
    reset();
  }, [closeSuccess, reset]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isTablet && styles.containerTablet,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFAA26"
          />
        }
      >
        <SpaDetailsContent
          spa={spa}
          loading={enquiryLoading}
          error={error}
          onRetry={refetch}
          spaId={spaId}
          serviceId={serviceId}
          serviceName={serviceName}
          openEnquiry={openEnquiry}
          onBookSpa={(currentSpaId, currentServiceId, currentServiceName) => {
            const targetServiceId = currentServiceId ?? serviceId;
            const targetServiceName = currentServiceName ?? serviceName;
            setSelectedService({ id: targetServiceId, name: targetServiceName });

            if (!isAuthenticated) {
              navigation.navigate('Login', {
                spaId: currentSpaId,
                serviceId: targetServiceId,
                serviceName: targetServiceName,
                openBooking: true,
                selectedDateId,
                selectedSlotId,
                fromScreen: fromScreen ?? 'Home',
              });
            }
          }}
          onBack={handleBack}
          dates={bookingDates}
          selectedDateId={selectedDateId}
          onSelectDate={handleSelectDate}
          slots={timeSlots}
          selectedSlotId={selectedSlotId}
          onSelectSlot={handleSelectSlot}
          loadingSlots={loadingSlots}
          availabilityError={availabilityError}
          bookingOption={bookingOption}
          onProceedBooking={handleProceedBooking}
          proceedLoading={submitting}
          proceedDisabled={!selectedSlot}
        />
      </ScrollView>
      <EnquiryModal
        visible={enquiryVisible}
        onClose={handleCloseEnquiry}
        onSubmit={handleSubmitEnquiry}
        defaultValues={enquiryDefaults}
        loading={enquiryLoading}
      />
      <EnquirySuccessModal visible={success} onDone={handleSuccessDone} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7EE',
  },
  container: {
    paddingBottom: 24,
  },
  containerTablet: {
    alignSelf: 'center',
    maxWidth: 720,
    width: '100%',
  },
});

export default SpaDetailsScreen;
