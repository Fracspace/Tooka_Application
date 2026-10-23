import type { PublicReview } from './review';

export interface SpaMediaItem {
  id: string;
  image_type?: string | null;
  url?: string | null;
  url_thumbnail?: string | null;
  url_medium?: string | null;
  title?: string | null;
  alt_text?: string | null;
  display_order?: number;
  width_px?: number | null;
  height_px?: number | null;
  is_cover?: boolean;
}

export interface SpaDetails {
  id: string;
  name: string;
  local_name: string | null;
  slug: string;
  tagline: string | null;
  description: string | null;
  editorial_summary: string | null;
  cover_photo_url: string | null;
  media?: SpaMediaItem[] | null;
  city_id: string;
  locality_id: string;
  city_name: string;
  locality_name: string | null;
  state_name: string | null;
  pincode: string | null;
  country: string | null;
  address_line1: string | null;
  address_line2: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  google_maps_url: string;
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
  status: string;
  is_claimed?: boolean;
  is_featured?: boolean;
  is_premium?: boolean;
  is_open_now?: boolean;
  booking_fee?: string | number | null;
  minimum_booking_amount?: string | number | null;
  opening_hours?: SpaTiming[] | null;
  profile?: SpaProfile | null;
  services?: SpaService[];
  gallery?: SpaGalleryItem[];
  reviews?: SpaReview[];
  recent_reviews?: PublicReview[];
  amenities?: SpaAmenity[];
  timings?: SpaTiming[];
  location?: string | null;
  offers?: SpaOffer[];
}

export interface SpaProfile {
  id: string;
  spa_id: string;
  about_long: string | null;
  total_treatment_rooms: number | null;
  has_steam_room: boolean;
  has_sauna: boolean;
  has_jacuzzi: boolean;
  has_swimming_pool: boolean;
  has_cafe: boolean;
  has_locker: boolean;
  has_shower: boolean;
  has_changing_room: boolean;
  has_parking: boolean;
  has_valet: boolean;
  has_wifi: boolean;
  has_ac: boolean;
  has_music_room: boolean;
  has_outdoor_area: boolean;
  has_private_suite: boolean;
  has_couple_room: boolean;
  wheelchair_accessible: boolean;
  elevator_access: boolean;
  ground_floor: boolean;
  accepts_male_guests: boolean;
  accepts_female_guests: boolean;
  accepts_couples: boolean;
  accepts_children: boolean;
  appointment_only: boolean;
  walk_ins_accepted: boolean;
  outcall_available: boolean;
  accepts_cash: boolean;
  accepts_card: boolean;
  accepts_upi: boolean;
  accepts_net_banking: boolean;
  accepts_emi: boolean;
  languages_spoken: string[] | null;
  cancellation_policy_text: string | null;
}

export interface SpaService {
  id: string;
  spa_id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  category: string | null;
  duration_minutes: number | null;
  buffer_minutes: number | null;
  prep_minutes: number | null;
  base_price: string | null;
  currency: string | null;
  cover_image_url: string | null;
}

export interface SpaGalleryItem {
  id: string;
  image_url: string | null;
}

export interface SpaReview {
  id: string;
  reviewer_name: string | null;
  rating: number | string | null;
  comment: string | null;
  created_at: string | null;
}

export interface SpaAmenity {
  id: string;
  name: string;
  available: boolean;
}

export interface SpaTiming {
  day: string;
  open: string | null;
  close: string | null;
}

export interface SpaOffer {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  cta: string;
}
