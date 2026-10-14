import { useCallback, useEffect, useRef } from 'react';

import { releaseSlotHold } from '../services/slotHold';

// Results where the backend has confirmed nothing was paid. Never Processing,
// Timeout or Success: that money may still arrive, and the slot is the customer's.
const RELEASABLE_RESULTS = new Set(['cancelled', 'failure']);

/**
 * BookingResult: when the user leaves a "Payment Cancelled" or "Payment Failed"
 * result without retrying, release the slot the booking is holding so another
 * user can book it now. Call keepHold() before retrying with the same booking.
 */
export function useReleaseHoldOnLeave({
  resultType,
  bookingId,
  paymentId,
}: {
  resultType: string;
  bookingId?: string;
  paymentId?: string;
}) {
  // Read when the screen closes: a Retry pre-check can turn the result into
  // success or processing first.
  const latestRef = useRef({ resultType, bookingId, paymentId });
  latestRef.current = { resultType, bookingId, paymentId };
  const keepHoldRef = useRef(false);

  useEffect(
    () => () => {
      const latest = latestRef.current;
      if (keepHoldRef.current || !latest.bookingId || !RELEASABLE_RESULTS.has(latest.resultType)) {
        return;
      }
      releaseSlotHold(latest.bookingId, latest.paymentId);
    },
    [],
  );

  return useCallback(() => {
    keepHoldRef.current = true;
  }, []);
}
