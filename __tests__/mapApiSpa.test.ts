jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
// The provider in the same module needs device location; the mapper does not.
jest.mock('../src/context/LocationContext', () => ({ useLocation: jest.fn() }));

import { mapApiSpaToMappedSpa } from '../src/context/NearbySpaContext';
import { formatRatingLabel, formatReviewsLabel, getSpaBadge } from '../src/utils/number';
import type { Spa } from '../src/types/spa';

// Shaped like the real GET /spas/discover?lat&lng items.
const apiSpa = (overrides: Partial<Spa>): Spa => ({
  id: 'a8704571',
  name: 'Beauty Life Salon & Spa',
  slug: 'beauty-life-salon-spa-6679',
  tagline: 'Luxury Care for Your Beauty & Wellness',
  cover_photo_url: 'https://cdn.example/cover.png',
  city_name: 'Bengaluru',
  locality_name: null,
  rating_google: null,
  review_count_google: 0,
  ranking_score: '40.8829',
  is_verified: true,
  is_bookable: true,
  lat: null as unknown as string,
  lng: null as unknown as string,
  distance_m: 7424.11,
  starting_price: '149.00',
  category: 'spa',
  is_premium: false,
  is_featured: false,
  is_closed_today: false,
  has_steam_room: true,
  has_sauna: true,
  ...overrides,
});

describe('mapApiSpaToMappedSpa', () => {
  it('keeps real values and does not invent the missing ones', () => {
    const mapped = mapApiSpaToMappedSpa(apiSpa({}), 17.41, 78.42);

    expect(mapped.starting_price).toBe('149.00');
    expect(mapped.rating).toBeNull(); // was 4.5
    expect(mapped.latitude).toBeNull(); // was 0, i.e. a marker at (0, 0)
    expect(mapped.longitude).toBeNull();
    expect(mapped.typeA).toBe('Spa'); // from category, was always 'Massage'
    expect(mapped.typeB).toBe('Sauna'); // first matching amenity, was always 'Spa'
    expect(mapped.isOpen).toBeNull(); // not closed today, but "open now" is unknown
  });

  it('maps a rated spa with a pin and a known closure', () => {
    const mapped = mapApiSpaToMappedSpa(
      apiSpa({
        rating_google: '4.6',
        lat: '17.47002540',
        lng: '78.35688540',
        category: 'Massage Centre',
        is_closed_today: true,
        has_sauna: false,
        has_steam_room: false,
      }),
      17.41,
      78.42,
    );

    expect(mapped.rating).toBe(4.6);
    expect(mapped.latitude).toBeCloseTo(17.4700254);
    expect(mapped.typeA).toBe('Massage Centre');
    expect(mapped.typeB).toBe('');
    expect(mapped.isOpen).toBe(false);
  });
});

describe('display helpers', () => {
  it('labels ratings, reviews and badges honestly', () => {
    expect(formatRatingLabel(null)).toBe('New');
    expect(formatRatingLabel(4.25)).toBe('4.3');
    expect(formatReviewsLabel(0)).toBe('');
    expect(formatReviewsLabel('1')).toBe('1 review');
    expect(formatReviewsLabel(1280)).toBe('1,280 reviews');
    expect(getSpaBadge({ is_premium: false, is_featured: false })).toBe('');
    expect(getSpaBadge({ is_premium: true })).toBe('Premium');
    expect(getSpaBadge({ is_featured: true })).toBe('Featured');
  });
});
