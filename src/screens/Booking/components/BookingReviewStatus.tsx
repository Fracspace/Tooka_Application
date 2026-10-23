import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ReviewApi from '../../../api/ReviewApi';
import StarRating from '../../../components/StarRating';
import { useReviewPrompt } from '../../../context/ReviewPromptContext';
import type { BackendBookingListItem } from '../../../types/booking';
import type { MyReview } from '../../../types/review';
import { toStarCount } from '../../../utils/spaRating';

const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ReviewState =
  | { kind: 'loading' }
  | { kind: 'rated'; review: MyReview }
  | { kind: 'unrated' }
  | { kind: 'hidden' };

/** "Rate this visit" or "You rated ★★★★" on a completed booking. */
const BookingReviewStatus = React.memo(function BookingReviewStatus({
  booking,
}: {
  booking: BackendBookingListItem;
}) {
  const { openReviewForBooking, reviewsVersion } = useReviewPrompt();
  const [state, setState] = useState<ReviewState>({ kind: 'loading' });
  const bookingId = booking.bookingId || booking.id;

  useEffect(() => {
    const controller = new AbortController();

    ReviewApi.getForBooking(bookingId, controller.signal)
      .then(review => {
        if (review) {
          setState({ kind: 'rated', review });
          return;
        }

        const appointment = new Date(booking.appointmentAt ?? '').getTime();
        const withinWindow =
          Number.isFinite(appointment) && Date.now() - appointment < REVIEW_WINDOW_MS;
        setState({ kind: withinWindow ? 'unrated' : 'hidden' });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ kind: 'hidden' });
        }
      });

    return () => controller.abort();
  }, [bookingId, booking.appointmentAt, reviewsVersion]);

  if (state.kind === 'rated') {
    return (
      <Pressable
        style={styles.row}
        onPress={() => openReviewForBooking(bookingId)}
        accessibilityRole="button"
        accessibilityLabel="View your rating">
        <Text style={styles.ratedLabel}>You rated this</Text>
        <StarRating value={toStarCount(state.review.rating)} size={14} />
      </Pressable>
    );
  }

  if (state.kind === 'unrated') {
    return (
      <Pressable
        style={[styles.row, styles.rateButton]}
        onPress={() =>
          openReviewForBooking(bookingId, {
            spaName: booking.spaName,
            serviceName: booking.serviceName,
          })
        }
        accessibilityRole="button">
        <Ionicons name="star-outline" size={15} color="#FFAE2B" />
        <Text style={styles.rateText}>Rate this visit</Text>
      </Pressable>
    );
  }

  return null;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EAE0',
  },
  rateButton: {
    borderWidth: 1,
    borderColor: '#FFAE2B',
    borderRadius: 999,
    borderTopColor: '#FFAE2B',
  },
  ratedLabel: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#4D4D4D',
  },
  rateText: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 14,
    color: '#FFAE2B',
  },
});

export default BookingReviewStatus;
