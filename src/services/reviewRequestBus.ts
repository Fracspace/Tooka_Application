import { DeviceEventEmitter } from 'react-native';

// Bridges review_request push taps (which can fire before React is ready, e.g. a
// killed-app launch) to ReviewPromptProvider.

export const REVIEW_REQUEST_EVENT = 'REVIEW_REQUEST';
export const REVIEW_PENDING_REFRESH_EVENT = 'REVIEW_PENDING_REFRESH';

let queuedBookingId: string | null = null;

export function requestReviewForBooking(bookingId: string) {
  queuedBookingId = bookingId;
  DeviceEventEmitter.emit(REVIEW_REQUEST_EVENT, bookingId);
}

export function consumeQueuedReviewRequest(): string | null {
  const bookingId = queuedBookingId;
  queuedBookingId = null;
  return bookingId;
}

export function refreshPendingReviews() {
  DeviceEventEmitter.emit(REVIEW_PENDING_REFRESH_EVENT);
}
