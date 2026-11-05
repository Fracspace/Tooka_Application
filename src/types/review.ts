// Spa feedback (reviews). Decimal rating fields arrive from the API as strings ("4.0").

export interface PendingReview {
  booking_id: string;
  booking_ref: string;
  appointment_at: string;
  status: 'checked_in' | 'completed';
  spa_id: string;
  spa_name: string;
  spa_photo_url: string | null;
  service_name: string;
}

export type ReviewCategoryKey =
  | 'rating_cleanliness'
  | 'rating_staff'
  | 'rating_ambience'
  | 'rating_value';

export interface SubmitReviewBody {
  booking_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  rating_cleanliness?: number | null;
  rating_staff?: number | null;
  rating_ambience?: number | null;
  rating_value?: number | null;
  comment?: string | null;
  is_anonymous?: boolean;
}

/** POST /reviews and GET /reviews/booking/:id */
export interface MyReview {
  id: string;
  booking_id: string;
  spa_id: string;
  rating: string;
  rating_cleanliness: string | null;
  rating_staff: string | null;
  rating_ambience: string | null;
  rating_value: string | null;
  comment: string | null;
  is_anonymous: boolean;
  response_text: string | null;
  responded_at: string | null;
  created_at: string;
}

/** Spa page reviews (recent_reviews and GET /spas/:id/reviews). */
export interface PublicReview {
  id: string;
  rating: string;
  comment: string | null;
  reviewer_name: string;
  reviewer_avatar: string | null;
  response_text: string | null;
  responded_at: string | null;
  created_at: string;
  rating_cleanliness: string | null;
  rating_staff: string | null;
  rating_ambience: string | null;
  rating_value: string | null;
  is_anonymous: boolean;
  helpful_count: number;
  service_name?: string;
  is_featured?: boolean;
}

export interface SpaReviewStats {
  total: number;
  avg_rating: number;
  avg_cleanliness: number;
  avg_staff: number;
  avg_ambience: number;
  avg_value: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

export type SpaReviewSort = 'recent' | 'helpful' | 'highest' | 'lowest';

export interface SpaReviewsPage {
  stats: SpaReviewStats | null;
  reviews: PublicReview[];
  page: number;
  hasMore: boolean;
}

export interface ReviewRequestPushData {
  type: 'review_request';
  booking_id: string;
  spa_id: string;
}

export const REVIEW_CATEGORIES: Array<{ key: ReviewCategoryKey; label: string }> = [
  { key: 'rating_cleanliness', label: 'Cleanliness' },
  { key: 'rating_staff', label: 'Staff' },
  { key: 'rating_ambience', label: 'Ambience' },
  { key: 'rating_value', label: 'Value for money' },
];
