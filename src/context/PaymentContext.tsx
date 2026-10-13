import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import PaymentService from '../services/PaymentService';
import { PAYMENT_USER_MESSAGES } from '../payment/constants';
import { mapPaymentError } from '../payment/PaymentMapper';
import {
  createInitialPaymentFlowContext,
  mergePaymentSession,
  setPaymentFlowState,
} from '../payment/PaymentState';
import {
  PaymentFlowState,
  type BookingSummaryData,
  type PaymentFlowContext,
  type PaymentSessionData,
} from '../payment/PaymentTypes';

interface PaymentContextValue {
  context: PaymentFlowContext;
  isInitiating: boolean;
  setBookingSummary: (summary: BookingSummaryData) => void;
  initiatePayment: (
    bookingId: string,
    bookingRef?: string,
    summary?: BookingSummaryData,
  ) => Promise<PaymentFlowContext>;
  hydrateSession: (
    session: PaymentSessionData,
    summary?: BookingSummaryData,
  ) => void;
  markSdkLaunched: () => void;
  markWaitingForSdk: () => void;
  markVerifying: () => void;
  markTerminalState: (
    flowState:
      | PaymentFlowState.Success
      | PaymentFlowState.Failed
      | PaymentFlowState.Cancelled
      | PaymentFlowState.Refunded
      | PaymentFlowState.Timeout
      | PaymentFlowState.Error,
    patch?: Partial<PaymentFlowContext>,
  ) => void;
  markSdkLaunchFailed: (message?: string) => void;
  resetPaymentFlow: () => void;
}

const PaymentContext = createContext<PaymentContextValue | undefined>(
  undefined,
);

const isAbortError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message === 'Aborted');

export const PaymentProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [context, setContext] = useState<PaymentFlowContext>(
    createInitialPaymentFlowContext,
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const initiateLockRef = useRef(false);

  const cancelInFlight = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const resetPaymentFlow = useCallback(() => {
    cancelInFlight();
    initiateLockRef.current = false;
    setContext(createInitialPaymentFlowContext());
  }, [cancelInFlight]);

  const setBookingSummary = useCallback((summary: BookingSummaryData) => {
    setContext(current => ({
      ...current,
      ...summary,
    }));
  }, []);

  const hydrateSession = useCallback(
    (session: PaymentSessionData, summary?: BookingSummaryData) => {
      setContext(current => mergePaymentSession(current, session, summary));
    },
    [],
  );

  const initiatePayment = useCallback(
    async (
      bookingId: string,
      bookingRef?: string,
      summary?: BookingSummaryData,
    ): Promise<PaymentFlowContext> => {
      if (initiateLockRef.current) {
        throw new Error(PAYMENT_USER_MESSAGES.duplicateAttempt);
      }

      initiateLockRef.current = true;
      cancelInFlight();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setContext(current => ({
        ...current,
        bookingId,
        bookingRef,
        userMessage: undefined,
        failureReason: undefined,
      }));

      try {
        const response = await PaymentService.initiateBookingPayment(
          bookingId,
          controller.signal,
        );
        const session = PaymentService.buildSessionFromInitiateResponse(
          bookingId,
          bookingRef,
          response,
          summary,
        );
        const nextContext = mergePaymentSession(
          createInitialPaymentFlowContext(),
          session,
        );

        setContext(nextContext);
        return nextContext;
      } catch (error) {
        // Rethrow instead of returning the (stale) context: callers navigated to
        // PaymentScreen with empty payment ids when an initiation was aborted.
        if (isAbortError(error)) {
          throw error;
        }

        const mapped = mapPaymentError(error);
        setContext(current =>
          setPaymentFlowState(current, PaymentFlowState.Error, {
            bookingId,
            bookingRef,
            userMessage: mapped.userMessage,
          }),
        );
        throw error;
      } finally {
        initiateLockRef.current = false;
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [cancelInFlight],
  );

  const markSdkLaunched = useCallback(() => {
    setContext(current =>
      setPaymentFlowState(current, PaymentFlowState.SdkOpening, {
        sdkLaunched: true,
        userMessage: undefined,
        failureReason: undefined,
      }),
    );
  }, []);

  const markWaitingForSdk = useCallback(() => {
    setContext(current =>
      setPaymentFlowState(current, PaymentFlowState.SdkOpen, {
        sdkLaunched: true,
      }),
    );
  }, []);

  const markVerifying = useCallback(() => {
    setContext(current =>
      setPaymentFlowState(current, PaymentFlowState.Verifying, {
        userMessage: undefined,
      }),
    );
  }, []);

  const markTerminalState = useCallback(
    (
      flowState:
        | PaymentFlowState.Success
        | PaymentFlowState.Failed
        | PaymentFlowState.Cancelled
        | PaymentFlowState.Refunded
        | PaymentFlowState.Timeout
        | PaymentFlowState.Error,
      patch?: Partial<PaymentFlowContext>,
    ) => {
      setContext(current => setPaymentFlowState(current, flowState, patch));
    },
    [],
  );

  const markSdkLaunchFailed = useCallback((message?: string) => {
    setContext(current =>
      setPaymentFlowState(current, PaymentFlowState.Error, {
        sdkLaunched: false,
        userMessage: message ?? PAYMENT_USER_MESSAGES.sdkLaunchFailed,
      }),
    );
  }, []);

  const value = useMemo<PaymentContextValue>(
    () => ({
      context,
      isInitiating: initiateLockRef.current,
      setBookingSummary,
      initiatePayment,
      hydrateSession,
      markSdkLaunched,
      markWaitingForSdk,
      markVerifying,
      markTerminalState,
      markSdkLaunchFailed,
      resetPaymentFlow,
    }),
    [
      context,
      hydrateSession,
      initiatePayment,
      markSdkLaunchFailed,
      markSdkLaunched,
      markWaitingForSdk,
      markVerifying,
      markTerminalState,
      resetPaymentFlow,
      setBookingSummary,
    ],
  );

  return (
    <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>
  );
};

export const usePaymentContext = (): PaymentContextValue => {
  const value = useContext(PaymentContext);

  if (!value) {
    throw new Error('usePaymentContext must be used within PaymentProvider');
  }

  return value;
};
