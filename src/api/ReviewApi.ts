import axios from 'axios';

import authAxiosClient from './authAxiosClient';
import type {
  MyReview,
  PendingReview,
  SpaReviewSort,
  SpaReviewsPage,
  SubmitReviewBody,
  PublicReview,
  SpaReviewStats,
} from '../types/review';

interface Envelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: { page?: number; limit?: number; total?: number; hasMore?: boolean };
}

export interface ReviewApiError {
  status: number | null;
  code: string | null;
  message: string;
}

/** Normalises axios errors into the backend's { error: { code, message } } shape. */
export const toReviewApiError = (error: unknown): ReviewApiError => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { message?: string; error?: { code?: string; message?: string } }
      | undefined;
    return {
      status: error.response?.status ?? null,
      code: body?.error?.code ?? null,
      message:
        body?.error?.message ??
        body?.message ??
        'Something went wrong. Please try again.',
    };
  }

  return {
    status: null,
    code: null,
    message: 'Something went wrong. Please try again.',
  };
};

export const ReviewApi = {
  getPending: async (signal?: AbortSignal): Promise<PendingReview[]> => {
    const response = await authAxiosClient.get<Envelope<PendingReview[]>>(
      '/reviews/pending',
      { signal },
    );
    return Array.isArray(response.data?.data) ? response.data.data : [];
  },

  submit: async (body: SubmitReviewBody): Promise<MyReview> => {
    const response = await authAxiosClient.post<Envelope<MyReview>>(
      '/reviews',
      body,
    );
    return response.data.data as MyReview;
  },

  /** Resolves null when the booking has no feedback yet (404 REVIEW_FOR_BOOKING_NOT_FOUND). */
  getForBooking: async (
    bookingId: string,
    signal?: AbortSignal,
  ): Promise<MyReview | null> => {
    try {
      const response = await authAxiosClient.get<Envelope<MyReview>>(
        `/reviews/booking/${bookingId}`,
        { signal },
      );
      return response.data?.data ?? null;
    } catch (error) {
      if (toReviewApiError(error).code === 'REVIEW_FOR_BOOKING_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  },

  getSpaReviews: async ({
    spaId,
    page = 1,
    limit = 10,
    sort = 'recent',
    rating,
    signal,
  }: {
    spaId: string;
    page?: number;
    limit?: number;
    sort?: SpaReviewSort;
    rating?: number;
    signal?: AbortSignal;
  }): Promise<SpaReviewsPage> => {
    const response = await authAxiosClient.get<
      Envelope<{ stats?: SpaReviewStats; reviews?: PublicReview[] }>
    >(`/spas/${spaId}/reviews`, {
      params: { page, limit, sort, rating },
      signal,
    });

    const reviews = response.data?.data?.reviews ?? [];
    return {
      stats: response.data?.data?.stats ?? null,
      reviews,
      page,
      hasMore: response.data?.meta?.hasMore ?? reviews.length >= limit,
    };
  },
};

export default ReviewApi;
