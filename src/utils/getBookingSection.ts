import type { BookingSection } from '../types/booking';
import { BOOKING_STATUS } from '../types/booking';

const UPCOMING_STATUSES = new Set<string>([
  // Shown with a "Payment processing" badge. Hiding these left users nowhere to
  // look after the payment screen told them to check My Bookings.
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.CONFIRMED,
  // BOOKING_STATUS.CHECKED_IN,
]);

const COMPLETED_STATUSES = new Set<string>([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CHECKED_IN,]);

const CANCELLED_STATUSES = new Set<string>([
  BOOKING_STATUS.CANCELLED_BY_USER,
  BOOKING_STATUS.CANCELLED_BY_SPA,
  BOOKING_STATUS.NO_SHOW,
  BOOKING_STATUS.REFUNDED,
  BOOKING_STATUS.DISPUTED,
]);

export function isPaymentPendingStatus(status: string): boolean {
  return status.trim().toLowerCase() === BOOKING_STATUS.PENDING_PAYMENT;
}

export function getBookingSection(status: string): BookingSection | null {
  const normalized = status.trim().toLowerCase();

  if (UPCOMING_STATUSES.has(normalized)) {
    return 'upcoming';
  }

  if (COMPLETED_STATUSES.has(normalized)) {
    return 'completed';
  }

  if (CANCELLED_STATUSES.has(normalized)) {
    return 'cancelled';
  }

  return null;
}
