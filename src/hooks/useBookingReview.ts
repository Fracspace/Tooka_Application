import { useCallback } from 'react';

import { useReviewPrompt } from '../context/ReviewPromptContext';
import type { BackendBookingListItem } from '../types/booking';

/**
 * "Rate your visit" on a Completed booking. Shown while the backend still lists
 * the visit in GET /reviews/pending (checked in, under 30 days, not rated yet),
 * including visits whose popup the guest closed.
 */
export function useBookingReview(booking: BackendBookingListItem) {
  const { pendingReviews, openReviewForBooking } = useReviewPrompt();
  const pending = pendingReviews.get(booking.bookingId || booking.id);

  const rate = useCallback(() => {
    if (pending) {
      openReviewForBooking(pending.booking_id, {
        spaName: pending.spa_name,
        serviceName: pending.service_name,
        photoUrl: pending.spa_photo_url,
        visitAt: pending.appointment_at,
      });
    }
  }, [pending, openReviewForBooking]);

  return { canRate: Boolean(pending), rate };
}
