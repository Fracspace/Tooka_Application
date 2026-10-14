import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AppStateStatus,
} from 'react-native';
import {
  CommonActions,
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import PaymentApi from '../../api/PaymentApi';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { PAYMENT_USER_MESSAGES } from '../../payment/constants';
import {
  getPaymentPollDelay,
  hasPaymentPollingTimedOut,
  PAYMENT_POLL_TIMEOUT_MS,
} from '../../payment/paymentPolling';
import { paymentLogger } from '../../payment/paymentLogger';
import { isNotYetPaidStatus } from '../../payment/PaymentMapper';
import {
  BackendPaymentStatus,
  PaymentFlowState,
  SdkPaymentResult,
  type PaymentResultType,
} from '../../payment/PaymentTypes';
import usePayment from '../../hooks/usePayment';
import PaymentProcessingScreen from './PaymentProcessingScreen';
import PaymentStatusBadge from './components/PaymentStatusBadge';
import PaymentSummary from './components/PaymentSummary';
import RetryPaymentButton from './components/RetryPaymentButton';
import { buildBookingDateAndTime } from '../../utils/bookingDateTime';
import { Analytics, AnalyticsEvents, AnalyticsParams } from '../../services/firebase/analytics';

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'PaymentScreen'>;
type PaymentScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'PaymentScreen'
>;

type FinalizeParams = {
  flowState:
    | PaymentFlowState.Success
    | PaymentFlowState.Failed
    | PaymentFlowState.Cancelled
    | PaymentFlowState.Refunded
    | PaymentFlowState.Timeout
    | PaymentFlowState.Error;
  resultType: PaymentResultType;
  message?: string;
  paymentCompletedAt?: string;
};

const COLORS = {
  background: '#FFF8F0',
  text: '#242424',
  muted: '#9A9A9A',
  danger: '#D94A45',
};

const isPendingBackendStatus = (status: BackendPaymentStatus): boolean =>
  status === BackendPaymentStatus.Initiated ||
  status === BackendPaymentStatus.Pending ||
  status === BackendPaymentStatus.Processing;

/** What the Cashfree SDK told us. A hint only - the backend status is the truth. */
type SdkOutcome = 'success' | 'failed' | 'cancelled' | 'unknown';

const VERIFICATION_UNAVAILABLE_MESSAGE =
  "We couldn't confirm your payment yet. If money was deducted, your booking will update shortly - please check My Bookings.";

function PaymentScreen(): React.ReactElement {
  const navigation = useNavigation<PaymentScreenNavigationProp>();
  const route = useRoute<PaymentScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width - 40, 430);
  const spin = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const navigationLockRef = useRef(false);
  const launchAttemptedRef = useRef(false);
  const verifyingRef = useRef(false);
  const pollingActiveRef = useRef(false);
  const appActiveRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollStartedAtRef = useRef(Date.now());
  const pollAttemptRef = useRef(0);
  const [message, setMessage] = useState(
    'Complete your payment in the secure Cashfree window.',
  );
  const bookingDateAndTime = buildBookingDateAndTime({
    bookingDateAndTime: route.params.bookingDateAndTime,
    appointmentDate: route.params.appointmentDate,
    appointmentTime: route.params.appointmentTime,
  });

  const {
    context,
    hydrateSession,
    launchSdk,
    resetPaymentFlow,
    markVerifying,
    markTerminalState,
  } = usePayment({
    onSdkResult: sdkResult => {
      handleSdkResult(sdkResult.sdkResult, sdkResult.message);
    },
  });

  const isBusy =
    context.flowState === PaymentFlowState.SdkOpening ||
    context.flowState === PaymentFlowState.SdkOpen ||
    context.flowState === PaymentFlowState.Verifying;

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const stopVerification = useCallback(() => {
    clearPollTimer();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pollingActiveRef.current = false;
    verifyingRef.current = false;
  }, [clearPollTimer]);

  const navigateToResult = useCallback(
    ({
      resultType,
      message: finalMessage,
      paymentCompletedAt,
    }: FinalizeParams) => {
      paymentLogger.debug(`Navigate ${resultType}`);
      // Reset rather than replace: replace left SpaDetails (with the slot still
      // selected) underneath, so Back from "Booking Confirmed" invited a second booking.
      const resultParams: RootStackParamList['BookingResult'] = {
        type: resultType,
        bookingId: route.params.bookingId,
        bookingReference: route.params.bookingRef,
        paymentId: route.params.paymentId,
        paymentSessionId: route.params.paymentSessionId,
        cashfreeOrderId: route.params.cashfreeOrderId,
        spaName: route.params.spaName,
        spaImage: route.params.spaImage,
        location: route.params.location,
        serviceName: route.params.serviceName,
        serviceDurationMinutes: route.params.serviceDurationMinutes,
        appointmentDate: route.params.appointmentDate,
        appointmentTime: route.params.appointmentTime,
        bookingDateAndTime,
        amount: route.params.amount,
        currency: route.params.currency,
        failureReason: finalMessage,
        paymentCompletedAt,
      };
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'BottomNavigation' },
            { name: 'BookingResult', params: resultParams },
          ],
        }),
      );
    },
    [bookingDateAndTime, navigation, route.params],
  );

  const finalizeAndNavigate = useCallback(
    (params: FinalizeParams) => {
      if (navigationLockRef.current || !mountedRef.current) {
        return;
      }

      navigationLockRef.current = true;
      stopVerification();
      markTerminalState(params.flowState, {
        failureReason: params.message,
        userMessage: params.message,
      });
      navigateToResult(params);
    },
    [markTerminalState, navigateToResult, stopVerification],
  );

  const markPollingTimedOut = useCallback(() => {
    paymentLogger.debug('Poll Timeout');
    finalizeAndNavigate({
      flowState: PaymentFlowState.Timeout,
      resultType: 'timeout',
      message: PAYMENT_USER_MESSAGES.stillProcessing,
    });
  }, [finalizeAndNavigate]);

  const scheduleNextPoll = useCallback(
    (verifyPayment: () => void) => {
      if (
        navigationLockRef.current ||
        !mountedRef.current ||
        !appActiveRef.current
      ) {
        pollingActiveRef.current = true;
        return;
      }

      if (hasPaymentPollingTimedOut(pollStartedAtRef.current)) {
        markPollingTimedOut();
        return;
      }

      const delay = getPaymentPollDelay(pollAttemptRef.current);
      const elapsed = Date.now() - pollStartedAtRef.current;
      const remaining = PAYMENT_POLL_TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        markPollingTimedOut();
        return;
      }

      pollAttemptRef.current += 1;
      pollingActiveRef.current = true;
      clearPollTimer();
      paymentLogger.debug(`Poll Attempt ${pollAttemptRef.current}`);
      pollTimerRef.current = setTimeout(
        remaining <= delay ? markPollingTimedOut : verifyPayment,
        Math.min(delay, remaining),
      );
    },
    [clearPollTimer, markPollingTimedOut],
  );

  const verifyPayment = useCallback(
    async (options?: { resetPolling?: boolean; sdkOutcome?: SdkOutcome }) => {
      const sdkOutcome = options?.sdkOutcome ?? 'unknown';
      if (
        verifyingRef.current ||
        navigationLockRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      if (options?.resetPolling) {
        clearPollTimer();
        pollStartedAtRef.current = Date.now();
        pollAttemptRef.current = 0;
      }

      verifyingRef.current = true;
      pollingActiveRef.current = false;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      markVerifying();
      setMessage('Verifying your payment...');
      paymentLogger.debug('Verification Started', {
        paymentId: route.params.paymentId,
      });

      try {
        const response = await PaymentApi.verifyPaymentStatus({
          paymentId: route.params.paymentId,
          signal: controller.signal,
        });

        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          navigationLockRef.current
        ) {
          return;
        }

        paymentLogger.debug('Verification Success', {
          status: response.status,
        });

        if (response.status === BackendPaymentStatus.Captured) {
          await Analytics.logEvent(
            AnalyticsEvents.PAYMENT_SUCCESS,
            {
              [AnalyticsParams.BOOKING_ID]: response.booking_id ?? '',
              [AnalyticsParams.AMOUNT]: Number(response.order_amount ?? 0),
            },
          );
          finalizeAndNavigate({
            flowState: PaymentFlowState.Success,
            resultType: 'success',
            paymentCompletedAt: response.paid_at ?? undefined,
          });
          return;
        }

        if (response.status === BackendPaymentStatus.Failed) {
          if (sdkOutcome === 'cancelled') {
            finalizeAndNavigate({
              flowState: PaymentFlowState.Cancelled,
              resultType: 'cancelled',
              message: PAYMENT_USER_MESSAGES.sdkCancelled,
            });
            return;
          }
          finalizeAndNavigate({
            flowState: PaymentFlowState.Failed,
            resultType: 'failure',
            message: response.failure_reason ?? 'Payment failed.',
          });
          return;
        }

        if (response.status === BackendPaymentStatus.Refunded) {
          finalizeAndNavigate({
            flowState: PaymentFlowState.Refunded,
            resultType: 'refunded',
            message: 'Payment was refunded.',
          });
          return;
        }

        // The SDK says the user backed out (or the attempt failed) and the backend
        // confirms nothing was paid: that is a real cancel/failure. The cancel used to
        // be decided from the SDK's error text alone, so a UPI payment completing
        // after the user pressed back was shown as cancelled and offered Retry.
        if (isNotYetPaidStatus(response.status) && sdkOutcome === 'cancelled') {
          finalizeAndNavigate({
            flowState: PaymentFlowState.Cancelled,
            resultType: 'cancelled',
            message: PAYMENT_USER_MESSAGES.sdkCancelled,
          });
          return;
        }
        if (isNotYetPaidStatus(response.status) && sdkOutcome === 'failed') {
          finalizeAndNavigate({
            flowState: PaymentFlowState.Failed,
            resultType: 'failure',
            message: response.failure_reason ?? 'Payment failed.',
          });
          return;
        }

        if (isPendingBackendStatus(response.status)) {
          setMessage('Payment is still processing...');
          scheduleNextPoll(() => {
            verifyingRef.current = false;
            verifyPayment({ sdkOutcome });
          });
          return;
        }

        // Unknown status: never claim success or failure, never offer Retry.
        finalizeAndNavigate({
          flowState: PaymentFlowState.Timeout,
          resultType: 'timeout',
          message: PAYMENT_USER_MESSAGES.stillProcessing,
        });
      } catch (error) {
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          navigationLockRef.current
        ) {
          return;
        }

        // We could not READ the status - that says nothing about the payment itself.
        // This used to show "Payment Failed" with a Retry button for any 5xx/401/404,
        // and Retry started a new order for a booking that may already be paid.
        paymentLogger.error('Verification Failed', error);
        finalizeAndNavigate({
          flowState: PaymentFlowState.Timeout,
          resultType: 'timeout',
          message: VERIFICATION_UNAVAILABLE_MESSAGE,
        });
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        verifyingRef.current = false;
      }
    },
    [
      clearPollTimer,
      finalizeAndNavigate,
      markVerifying,
      route.params.paymentId,
      scheduleNextPoll,
    ],
  );

  const handleSdkResult = useCallback(
    (sdkResult: SdkPaymentResult, sdkMessage?: string) => {
      if (navigationLockRef.current) {
        return;
      }

      paymentLogger.debug('SDK Callback', { sdkResult, message: sdkMessage });

      // Every SDK outcome is confirmed with the backend before a result is shown.
      const sdkOutcome: SdkOutcome =
        sdkResult === SdkPaymentResult.Success
          ? 'success'
          : sdkResult === SdkPaymentResult.Failed
          ? 'failed'
          : sdkResult === SdkPaymentResult.Cancelled
          ? 'cancelled'
          : 'unknown';

      verifyPayment({ resetPolling: true, sdkOutcome });
    },
    [verifyPayment],
  );

  const spinStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: spin.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [spin],
  );

  useEffect(() => {
    mountedRef.current = true;
    hydrateSession(
      {
        paymentId: route.params.paymentId,
        bookingId: route.params.bookingId,
        bookingRef: route.params.bookingRef,
        paymentSessionId: route.params.paymentSessionId,
        cashfreeOrderId: route.params.cashfreeOrderId,
        amount: route.params.amount,
        currency: route.params.currency,
      },
      {
        spaName: route.params.spaName,
        spaImage: route.params.spaImage,
        location: route.params.location,
        serviceName: route.params.serviceName,
        serviceDurationMinutes: route.params.serviceDurationMinutes,
        appointmentDate: route.params.appointmentDate,
        appointmentTime: route.params.appointmentTime,
        bookingDateAndTime,
      },
    );

    return () => {
      mountedRef.current = false;
      stopVerification();
    };
  }, [bookingDateAndTime, hydrateSession, route.params, stopVerification]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const isActive = nextState === 'active';
        appActiveRef.current = isActive;

        if (!isActive) {
          clearPollTimer();
          if (verifyingRef.current) {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
            verifyingRef.current = false;
            pollingActiveRef.current = true;
          }
          return;
        }

        if (
          mountedRef.current &&
          pollingActiveRef.current &&
          !verifyingRef.current &&
          !navigationLockRef.current
        ) {
          clearPollTimer();
          pollingActiveRef.current = false;
          verifyPayment();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [clearPollTimer, verifyPayment]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [spin]);

  useEffect(() => {
    if (
      launchAttemptedRef.current ||
      context.flowState !== PaymentFlowState.Ready ||
      !context.paymentSessionId ||
      !context.cashfreeOrderId
    ) {
      return;
    }

    launchAttemptedRef.current = true;
    setMessage('Opening secure payment gateway...');
    paymentLogger.debug('SDK Opening');
    const launched = launchSdk();

    if (!launched && mountedRef.current) {
      finalizeAndNavigate({
        flowState: PaymentFlowState.Error,
        resultType: 'failure',
        message: PAYMENT_USER_MESSAGES.sdkLaunchFailed,
      });
    } else {
      paymentLogger.debug('SDK Opened');
    }
  }, [
    context.cashfreeOrderId,
    context.flowState,
    context.paymentSessionId,
    finalizeAndNavigate,
    launchSdk,
  ]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = (): boolean => {
        Alert.alert(
          'Payment in progress',
          'Please wait for the payment gateway to finish.',
        );
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => {
        subscription.remove();
      };
    }, []),
  );

  const handleBackToHome = useCallback(() => {
    stopVerification();
    resetPaymentFlow();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'BottomNavigation' }],
      }),
    );
  }, [navigation, resetPaymentFlow, stopVerification]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: Math.max(insets.bottom + 24, 32),
          },
        ]}
      >
        <View style={[styles.inner, { maxWidth }]}>
          <Text style={styles.heading} accessibilityRole="header">
            Complete Payment
          </Text>
          <Text style={styles.subheading}>
            Secure payment powered by Cashfree
          </Text>

          <View style={styles.badgeRow}>
            <PaymentStatusBadge flowState={context.flowState} />
          </View>

          <PaymentSummary
            amount={route.params.amount}
            currency={route.params.currency}
            bookingRef={route.params.bookingRef}
            spaName={route.params.spaName}
            spaImage={route.params.spaImage}
            location={route.params.location}
            serviceName={route.params.serviceName}
            serviceDurationMinutes={route.params.serviceDurationMinutes}
            appointmentDate={route.params.appointmentDate}
            appointmentTime={route.params.appointmentTime}
            bookingDateAndTime={bookingDateAndTime}
          />

          <PaymentProcessingScreen spinStyle={spinStyle} message={message} />

          {context.userMessage ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {context.userMessage}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <RetryPaymentButton
              label="Back To Home"
              onPress={handleBackToHome}
              disabled={isBusy}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  inner: {
    width: '100%',
  },
  heading: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 14,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  errorText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
});

export default PaymentScreen;
