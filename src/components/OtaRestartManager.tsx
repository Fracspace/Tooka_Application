import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { restart } from 'react-native-stallion';

import { useCallContext } from '../context/CallContext';
import { usePaymentContext } from '../context/PaymentContext';
import { PaymentFlowState } from '../payment/PaymentTypes';
import { CallState } from '../types/call';

/** Payment states in which the app may be backgrounded on purpose (UPI app switch). */
const PAYMENT_IN_PROGRESS: ReadonlySet<PaymentFlowState> = new Set([
  PaymentFlowState.Ready,
  PaymentFlowState.SdkOpening,
  PaymentFlowState.SdkOpen,
  PaymentFlowState.Verifying,
]);

/**
 * Applies a downloaded Stallion OTA bundle the next time the app goes to the
 * background, instead of restarting the moment the download finishes, which
 * reloaded the app under the user mid-screen.
 *
 * It also waits while a call is live (call audio keeps running in the background)
 * or a payment is in progress (paying via a UPI app backgrounds Tooka; restarting
 * then would lose the payment screen). The restart happens on a later background.
 *
 * Must be rendered inside CallProvider and PaymentProvider.
 */
export function OtaRestartManager({ restartRequired }: { restartRequired: boolean }): null {
  const { callState } = useCallContext();
  const { context: paymentContext } = usePaymentContext();

  const isBusyRef = useRef(false);
  isBusyRef.current =
    callState !== CallState.IDLE || PAYMENT_IN_PROGRESS.has(paymentContext.flowState);

  useEffect(() => {
    if (__DEV__ || !restartRequired) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && !isBusyRef.current) {
        restart();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [restartRequired]);

  return null;
}

export default OtaRestartManager;
