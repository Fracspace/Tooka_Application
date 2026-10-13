import type { SpaService } from '../types/spaDetails';

/**
 * Safe numeric helpers for values that may arrive from the API as
 * numbers, numeric strings (e.g. "5.0"), null, undefined, or garbage.
 */

/**
 * Coerce an unknown value into a finite number.
 * Falls back to `fallback` for null / undefined / non-numeric / NaN / Infinity.
 */
export const toSafeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

export const DEFAULT_PRICE = '₹1,499';

/**
 * Format a price-like value (e.g. "999.00") for display as "₹999".
 * Returns null for missing / non-numeric / non-positive values so the
 * caller can hide the price instead of showing a made-up one.
 */
export const formatPrice = (value: unknown): string | null => {
  const price = toSafeNumber(value, NaN);
  if (!(price > 0)) {
    return null;
  }
  return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

/**
 * Format a rating-like value for display, guaranteed to be a string.
 * Safe against undefined / null / numeric strings / invalid values.
 */
export const formatRating = (
  value: unknown,
  fallback = 0,
  fractionDigits = 1,
): string => toSafeNumber(value, fallback).toFixed(fractionDigits);

/**
 * Calculate the lowest service price from an array of services.
 * Safe against undefined / null / non-numeric / missing prices.
 */
export const getLowestServicePrice = (
  services?: SpaService[] | null,
  fallback = DEFAULT_PRICE,
): string => {
  if (!Array.isArray(services) || services.length === 0) {
    return fallback;
  }

  const prices = services
    .map((service) => (service && service.base_price != null ? Number(service.base_price) : NaN))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) {
    return fallback;
  }

  const minPrice = Math.min(...prices);
  return `₹${minPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
