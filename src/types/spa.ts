export interface Spa {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  cover_photo_url: string | null;
  city_name: string;
  locality_name: string | null;
  // API may return these as numeric strings (e.g. "5.0") rather than numbers.
  rating_google: number | string | null;
  review_count_google: number | string | null;
  // Tooka rating: average of public feedback (decimal string), null when there is none.
  rating_platform?: number | string | null;
  review_count_platform?: number | string | null;
  ranking_score: string;
  is_verified: boolean;
  is_bookable: boolean;
  lat: string;
  lng: string;
  distance_m?: number | string | null;
  min_booking_amount?: string | null;
  minimum_booking_amount?: string | null;
  is_hidden?: boolean;
  starting_price?: string | null;
}
