import type { BackendBookingListItem } from '../types/booking';

const toAmount = (value: unknown): number => {
  const amount = typeof value === 'string' ? Number(value) : value;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
};

/**
 * Booking amounts paid: amount_paid summed over upcoming and completed
 * bookings. Cancelled ones are left out because they may be refunded. Profile
 * and Payment history both use this so their totals agree.
 */
export function bookingAmountsPaid(
  upcoming: BackendBookingListItem[],
  completed: BackendBookingListItem[],
): { total: number; count: number } {
  const bookings = [...upcoming, ...completed];
  return {
    total: bookings.reduce((sum, booking) => sum + toAmount(booking.raw?.amount_paid), 0),
    count: bookings.length,
  };
}
