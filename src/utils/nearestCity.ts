import { POPULAR_CITIES } from '../data/cities';
import { calculateHaversineDistance } from './distance';

/** How far from a listed city's centre a spot still counts as that city. */
export const NEAREST_CITY_MAX_METERS = 50_000;

/**
 * The listed city closest to a spot, or null when none is within 50 km.
 * Google names areas like Secunderabad as their own city, so /spas/discover
 * got city=Secunderabad and missed the rest of Hyderabad's spas.
 */
export function nearestCity(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (latitude == null || longitude == null) {
    return null;
  }
  let best: { name: string; meters: number } | null = null;
  for (const city of POPULAR_CITIES) {
    const meters = calculateHaversineDistance(latitude, longitude, city.lat, city.lng);
    if (meters <= NEAREST_CITY_MAX_METERS && (!best || meters < best.meters)) {
      best = { name: city.name, meters };
    }
  }
  return best?.name ?? null;
}
