import { useCallback, useEffect, useRef, useState } from 'react';
import { Clipboard } from 'react-native';
import {
  CommonActions,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import PaymentApi from '../api/PaymentApi';
import { usePaymentContext } from '../context/PaymentContext';
import { useReleaseHoldOnLeave } from './useReleaseHoldOnLeave';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { mapPaymentError } from '../payment/PaymentMapper';
import { BackendPaymentStatus } from '../payment/PaymentTypes';
import {
  buildBookingDateAndTime,
  formatPaymentCompletedAt,
} from '../utils/bookingDateTime';

type BookingResultRouteProp = RouteProp<RootStackParamList, 'BookingResult'>;
type BookingResultNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BookingResult'
>;
export type ResultType = NonNullable<RootStackParamList['BookingResult']['type']>;

const parseResultType = (value: string | undefined): ResultType => {
  if (
    value === 'failure' ||
    value === 'cancelled' ||
    value === 'refunded' ||
    value === 'timeout' ||
    value === 'processing' ||
    value === 'success'
  ) {
    return value;
  }

  // Never assume success for a missing or unrecognised result.
  return 'processing';
};

/**
 * Data and actions for the booking result screen (Booked / failed / processing),
 * shared by the old and v4 layouts so both behave the same.
 */
export function useBookingResultScreen() {
  const navigation = useNavigation<BookingResultNavigationProp>();
  const route = useRoute<BookingResultRouteProp>();
  const { initiatePayment, resetPaymentFlow } = usePaymentContext();
  const mountedRef = useRef(true);
  const retryLockRef = useRef(false);
  const resultType = route.params?.type ?? 'processing';
  const [message, setMessage] = useState<string | undefined>(
    route.params?.failureReason,
  );
  const [retrying, setRetrying] = useState(false);

  const type = parseResultType(resultType);
  const keepSlotHold = useReleaseHoldOnLeave({
    resultType: type,
    bookingId: route.params?.bookingId,
    paymentId: route.params?.paymentId,
  });
  const isProcessing = type === 'processing' || type === 'timeout';
  const bookingCode = route.params?.bookingReference ?? route.params?.bookingId;
  const dateTime = buildBookingDateAndTime({
    bookingDateAndTime: route.params?.bookingDateAndTime,
    appointmentDate: route.params?.appointmentDate,
    appointmentTime: route.params?.appointmentTime,
  });
  const paymentCompletedAt = formatPaymentCompletedAt(
    route.params?.paymentCompletedAt,
  );
  const showPaymentDetails = type === 'success' && Boolean(paymentCompletedAt);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const showToast = useCallback((toastMessage: string) => {
    Toast.show({
      type: 'success',
      text1: toastMessage,
      position: 'bottom',
    });
  }, []);

  const handleCopy = useCallback(() => {
    if (!bookingCode) {
      return;
    }

    Clipboard.setString(bookingCode);
    showToast('Booking ID Copied');
  }, [bookingCode, showToast]);

  const resetToHome = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'BottomNavigation' }],
      }),
    );
  }, [navigation]);

  const resetToBookings = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'BottomNavigation',
            params: {
              screen: 'Bookings',
            },
          },
        ],
      }),
    );
  }, [navigation]);

  const handleRetryPayment = useCallback(async () => {
    if (retryLockRef.current || !route.params?.bookingId) {
      return;
    }

    retryLockRef.current = true;
    setRetrying(true);

    try {
      // Check the previous attempt before opening a new order. A payment can still
      // succeed after the app showed it as cancelled or failed (UPI apps confirm
      // late), and retrying then would charge the customer twice.
      const previousPaymentId = route.params.paymentId;
      if (previousPaymentId) {
        let previousStatus: BackendPaymentStatus;
        try {
          const previous = await PaymentApi.verifyPaymentStatus({
            paymentId: previousPaymentId,
          });
          previousStatus = previous.status;
          if (previousStatus === BackendPaymentStatus.Captured) {
            setMessage(undefined);
            navigation.setParams({
              type: 'success',
              failureReason: undefined,
              paymentCompletedAt: previous.paid_at ?? undefined,
            });
            return;
          }
        } catch {
          setMessage(
            "We couldn't check your previous payment. Please try again in a moment.",
          );
          return;
        }

        if (
          previousStatus === BackendPaymentStatus.Processing ||
          previousStatus === BackendPaymentStatus.Unknown
        ) {
          const stillProcessing =
            'Your previous payment is still being processed. Please check My Bookings before paying again.';
          setMessage(stillProcessing);
          navigation.setParams({ type: 'processing', failureReason: stillProcessing });
          return;
        }
      }

      resetPaymentFlow();
      const paymentContext = await initiatePayment(
        route.params.bookingId,
        route.params.bookingReference,
        {
          spaName: route.params.spaName,
          spaImage: route.params.spaImage,
          location: route.params.location,
          serviceName: route.params.serviceName,
          serviceDurationMinutes: route.params.serviceDurationMinutes,
          appointmentDate: route.params.appointmentDate,
          appointmentTime: route.params.appointmentTime,
          bookingDateAndTime: route.params.bookingDateAndTime,
        },
      );

      keepSlotHold();
      navigation.replace('PaymentScreen', {
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
    } catch (error) {
      const mapped = mapPaymentError(error);
      setMessage(mapped.userMessage);
    } finally {
      retryLockRef.current = false;
      if (mountedRef.current) {
        setRetrying(false);
      }
    }
  }, [initiatePayment, keepSlotHold, navigation, resetPaymentFlow, route.params]);

  const handlePrimary = useCallback(() => {
    if (type === 'success') {
      resetToBookings();
      return;
    }

    if (isProcessing) {
      resetToBookings();
      return;
    }

    if (!isProcessing) {
      handleRetryPayment();
    }
  }, [
    handleRetryPayment,
    isProcessing,
    resetToBookings,
    type,
  ]);

  const handleSecondary = useCallback(() => {
    resetToHome();
  }, [resetToHome]);

  return {
    params: route.params,
    type,
    isProcessing,
    message,
    retrying,
    bookingCode,
    dateTime,
    paymentCompletedAt,
    showPaymentDetails,
    handleCopy,
    handlePrimary,
    handleSecondary,
  };
}
