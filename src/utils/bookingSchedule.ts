import axios from 'axios';

import type { BookingScheduleDate } from '../types/booking';

// Shared by the slot-booking hook. These were copy-pasted into SpaDetailsScreen
// and ExploreScreen (and had already drifted apart).

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const DAY_LABELS = ['Today', 'Tomorrow', 'Day After'];

/** Today, tomorrow and the day after, keyed by YYYY-MM-DD. */
export const buildScheduleDates = (now: Date = new Date()): BookingScheduleDate[] =>
  DAY_LABELS.map((label, offset) => {
    const dateKey = toDateKey(addDays(now, offset));
    return { id: dateKey, label, date: dateKey };
  });

/** "14:30" -> "02:30 PM". Returns the input unchanged if it is not HH:mm. */
export const formatTimeLabel = (time: string): string => {
  const [hoursRaw, minutesRaw = '00'] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${pad(twelveHour)}:${pad(minutes)} ${period}`;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-14" -> "14 Oct". */
export const formatShortDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-').map(Number);
  const monthName = MONTH_NAMES[month - 1];
  return monthName && Number.isFinite(day) ? `${day} ${monthName}` : dateKey;
};

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

/**
 * The API's error message: top-level `message`, or `error.message`, which is all
 * that older backends send.
 */
const getApiErrorMessage = (data: unknown): string | undefined => {
  const body = data as { message?: unknown; error?: { message?: unknown } } | undefined;
  return asText(body?.message) ?? asText(body?.error?.message);
};

/**
 * The slot is held or taken by someone else (409, code SLOT_ON_HOLD while another
 * user is paying for it).
 */
export const isSlotUnavailableError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  const body = error.response?.data as { code?: unknown; error?: { code?: unknown } } | undefined;
  return (
    error.response?.status === 409 ||
    body?.error?.code === 'SLOT_ON_HOLD' ||
    body?.code === 'SLOT_ON_HOLD'
  );
};

/** User-facing copy for a failed booking/availability request. */
export const getSlotBookingErrorMessage = (error: unknown): string => {
  if (axios.isCancel(error)) return '';
  if (axios.isAxiosError(error)) {
    const message = getApiErrorMessage(error.response?.data);
    if (message) return message;
    if (error.message.toLowerCase().includes('network')) {
      return 'You are offline. Please check your internet connection.';
    }
  }
  return 'Something went wrong. Please try again.';
};
