const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Thu, 23 Oct · 6:00 PM" from a pending review's appointment_at.
 * Booking times are IST wall-clock tagged 'Z' on purpose, so the digits are read
 * as-is; converting to the phone's time zone would shift them by 5.5 hours.
 */
export function formatVisitDate(iso?: string | null): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    return null;
  }
  const [, y, mo, d, h, min] = m.map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const hour12 = h % 12 || 12;
  return `${weekday}, ${d} ${MONTHS[mo - 1]} · ${hour12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
