type RatedSpa = {
  rating_google?: number | string | null;
  review_count_google?: number | string | null;
  rating_platform?: number | string | null;
  review_count_platform?: number | string | null;
} | null | undefined;

export interface SpaRating {
  rating: number | null;
  count: number;
  source: 'tooka' | 'google';
}

const toNumber = (value: unknown): number | null => {
  const num = Number(value);
  return value != null && Number.isFinite(num) ? num : null;
};

/** Tooka rating once the spa has public Tooka reviews, otherwise the Google rating. */
export function getSpaRating(spa: RatedSpa): SpaRating {
  const platformCount = toNumber(spa?.review_count_platform) ?? 0;
  const platformRating = toNumber(spa?.rating_platform);

  if (platformCount > 0 && platformRating != null) {
    return { rating: platformRating, count: platformCount, source: 'tooka' };
  }

  return {
    rating: toNumber(spa?.rating_google),
    count: toNumber(spa?.review_count_google) ?? 0,
    source: 'google',
  };
}

/** Review ratings arrive as decimal strings ("4.0"). */
export const toStarCount = (value: string | number | null | undefined): number => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.min(5, Math.round(num))) : 0;
};
