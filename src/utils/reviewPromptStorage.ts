import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Bookings whose "How was your visit?" popup the guest closed without rating.
 * The backend has no dismiss endpoint, so this lives on the device. Those
 * bookings never pop up again; the guest can still rate them from Bookings.
 */
const DISMISSED_KEY = 'REVIEW_PROMPT_DISMISSED';
// Pending visits expire after 30 days, so old ids are useless; keep the list short.
const MAX_IDS = 100;

let cache: Set<string> | null = null;

export async function getDismissedReviewIds(): Promise<Set<string>> {
  if (cache) {
    return cache;
  }
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    cache = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

export async function markReviewDismissed(bookingId: string): Promise<void> {
  const ids = await getDismissedReviewIds();
  if (ids.has(bookingId)) {
    return;
  }
  ids.add(bookingId);
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-MAX_IDS)));
  } catch (error) {
    if (__DEV__) {
      console.warn('[reviewPromptStorage] save failed:', error);
    }
  }
}
