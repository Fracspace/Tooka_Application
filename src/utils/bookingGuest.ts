import type { AuthUser } from '../types/auth';
import type { UserProfile } from '../types/profile';

/**
 * The name the spa sees on a booking, or null when the user has none on file.
 * Bookings used to be sent as "Guest" in that case.
 */
export const getGuestName = (
  profile: Pick<UserProfile, 'fullName' | 'displayName'> | null | undefined,
  user: Pick<AuthUser, 'fullName' | 'userName'> | null | undefined,
): string | null => {
  const candidates = [profile?.fullName, profile?.displayName, user?.fullName, user?.userName];
  for (const name of candidates) {
    const trimmed = name?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
};
