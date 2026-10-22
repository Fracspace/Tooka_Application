import { useMemo } from 'react';

import type { BackendBookingListItem } from '../types/booking';
import {
  extractPaymentDate,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  getBookingPaymentStatus,
} from '../screens/Payment/utils/paymentFormatters';

export const FALLBACK_IMAGE = {
  uri: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=400&q=60',
};

/** What a payment card shows, shared by the old and v4 layouts. */
export function usePaymentCard(booking: BackendBookingListItem) {
  // Spa Name
  const spaName =
    booking.spaName ||
    booking.raw?.spa_snapshot?.name ||
    'Unknown Spa';

  // Location
  const locality = booking.raw?.spa_snapshot?.locality_name;
  const city = booking.raw?.spa_snapshot?.city_name;
  const location =
    locality && city
      ? `${locality}, ${city}`
      : locality ||
        city ||
        booking.location ||
        booking.raw?.spa_snapshot?.address ||
        '';

  // Spa Image
  const rawCover = booking.raw?.spa_snapshot?.cover_photo_url;
  const spaImageUri = booking.spaImage || rawCover;
  const spaImageSource = spaImageUri ? { uri: spaImageUri } : FALLBACK_IMAGE;

  // Amount
  const bookingPrice =
    typeof booking.price === 'number' || typeof booking.price === 'string'
      ? booking.price
      : null;
  const rawTotal =
    typeof booking.raw?.amount_total === 'string' ||
    typeof booking.raw?.amount_total === 'number'
      ? booking.raw.amount_total
      : null;
  const rawBase =
    typeof (booking.raw as Record<string, unknown>)?.base_price === 'string' ||
    typeof (booking.raw as Record<string, unknown>)?.base_price === 'number'
      ? ((booking.raw as Record<string, unknown>).base_price as string | number)
      : null;
  const rawPaid =
    typeof booking.raw?.amount_paid === 'string' ||
    typeof booking.raw?.amount_paid === 'number'
      ? booking.raw.amount_paid
      : null;
  const rawPaymentAmount = booking.raw?.payment?.payment_amount ?? null;
  // What was actually paid first; this used to prefer the booking total.
  const rawAmount = rawPaymentAmount ?? rawPaid ?? rawTotal ?? rawBase ?? bookingPrice;
  const amountStr = formatCurrency(rawAmount);

  // The real status (Completed / Pending / Failed / Cancelled / Refunded). Anything
  // not captured used to be labelled "Cancelled", including payments in progress.
  const statusToDisplay = getBookingPaymentStatus(booking);

  // Transaction Date/Time
  const appointmentAtStr = booking.appointmentAt ?? undefined;
  const paymentDateIso = extractPaymentDate(booking.raw);
  const paymentDateTimeStr = formatDateTime(paymentDateIso) || '--';

  // Booked Slot Timing
  const slotDate = booking.date;
  const slotTime = booking.time;
  const slotTimingStr =
    slotDate && slotTime
      ? `${slotDate} | ${slotTime}`
      : formatDateTime(appointmentAtStr) || 'Slot Details Unavailable';

  // Payment Method
  const paymentMethodInfo = useMemo(
    () => formatPaymentMethod(booking.raw?.payment),
    [booking.raw?.payment],
  );

  return {
    spaName,
    location,
    spaImageSource,
    amountStr,
    statusToDisplay,
    paymentDateTimeStr,
    slotTimingStr,
    paymentMethodInfo,
  };
}
