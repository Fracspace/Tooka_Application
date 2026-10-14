import axios from 'axios';

import BookingApi from '../api/BookingApi';
import PaymentApi from '../api/PaymentApi';
import { isNotYetPaidStatus } from '../payment/PaymentMapper';
import { BackendPaymentStatus } from '../payment/PaymentTypes';

const RETRY_DELAY_MS = 1500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Worth one more try: no response at all, or the server failed. A 4xx (already
// released or expired, not ours) will not change on a retry.
const isRetryable = (error: unknown): boolean =>
  axios.isAxiosError(error) && (!error.response || error.response.status >= 500);

/**
 * Give up the slot a pending booking is holding, so other users can book it now
 * instead of after the backend's hold (up to 15 minutes) runs out. Best effort:
 * when this fails the hold still expires by itself. Resolves to whether it was
 * released.
 *
 * With a paymentId the payment is checked first, and the hold is kept unless the
 * backend confirms nothing was paid: a UPI payment can still complete after the
 * app showed it as cancelled, and that customer must keep their slot.
 */
export async function releaseSlotHold(bookingId: string, paymentId?: string): Promise<boolean> {
  if (!bookingId) return false;

  if (paymentId) {
    try {
      const { status } = await PaymentApi.verifyPaymentStatus({ paymentId });
      if (!isNotYetPaidStatus(status) && status !== BackendPaymentStatus.Failed) {
        return false;
      }
    } catch {
      return false;
    }
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      await BookingApi.releaseBooking(bookingId);
      return true;
    } catch (error) {
      if (attempt >= 2 || !isRetryable(error)) {
        return false;
      }
      await wait(RETRY_DELAY_MS);
    }
  }
}
