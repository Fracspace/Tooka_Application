import type { EditProfileForm } from '../screens/Profile/EditProfile/types';
import type { ResidentialLocation, UpdateProfilePayload, UserProfile } from '../types/profile';
import { removeEmptyProfilePayloadValues } from './profileMappers';
import { Platform } from 'react-native';
import { getOnboarding } from './onboardingStorage';
import { getFcmToken } from './fcmStorage';

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatDateForApi = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// null for a missing or invalid date. This used to return 18 Dec 2000, which the
// next profile save then stored as the user's real date of birth.
export const parseApiDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseGender = (value?: string | null): EditProfileForm['gender'] => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'female' || normalized === 'male' || normalized === 'other'
    ? normalized
    : null;
};

export const splitDisplayName = (profile: UserProfile | null): { firstName: string; lastName: string } => {
  const source = profile?.fullName ?? profile?.displayName ?? profile?.username ?? '';
  const parts = source.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
};

export const formFromProfile = (profile: UserProfile | null): EditProfileForm => {
  const name = splitDisplayName(profile);
  // console.log("formFromProfile: profile:", profile, "name:", name);

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    displayName: profile?.displayName ?? profile?.fullName ?? profile?.username ?? '',
    email: profile?.email ?? '',
    countryCode: '+91',
    phoneNumber: (profile?.phone ?? '').replace(/^\+91/, '').replace(/\D/g, '').slice(-10),
    // Was 'male' for anyone who had not set a gender.
    gender: parseGender(profile?.gender),
    dateOfBirth: parseApiDate(profile?.dateOfBirth),
    addressLine1: profile?.residentialLocation?.formattedAddress ?? profile?.city ?? '',
    addressLine2: [
      profile?.residentialLocation?.city,
      profile?.residentialLocation?.state,
      profile?.residentialLocation?.postalCode,
      profile?.residentialLocation?.country,
    ].filter(Boolean).join(', '),
    profilePhotoUri: profile?.avatarUrl ?? null,
    residentialLocation: profile?.residentialLocation ?? null,
  };
};

export const buildUpdateProfilePayload = async (
  form: EditProfileForm,
  currentLocation: { latitude: number; longitude: number } | null,
): Promise<UpdateProfilePayload> => {
  const displayName = form.displayName.trim() || `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
  const fcmToken = await getFcmToken();
  const onboarding = await getOnboarding();
  const preferences = onboarding?.answers?.preferences ?? [];

  const payload: UpdateProfilePayload = {
    username: displayName,
    fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    displayName,
    email: form.email.trim(),
    // No phone: it is the login identity and read-only here. Sending the form's
    // 10-digit copy rewrote the stored "+91..." number in another format (or blank).
    // undefined (not '') so removeEmptyProfilePayloadValues leaves them out entirely.
    gender: form.gender ?? undefined,
    dateOfBirth: form.dateOfBirth ? formatDateForApi(form.dateOfBirth) : undefined,
    lat: form.residentialLocation?.latitude,
    lng: form.residentialLocation?.longitude,
    lati: currentLocation?.latitude,
    lang: currentLocation?.longitude,
    // Only send these when this device has them. Empty values overwrote the server:
    // after a logout on this device the onboarding answers are cleared, so the next
    // user's save wiped their categories, and a missing FCM token wiped the push token.
    pushToken: fcmToken || undefined,
    pushTokenPlatform: fcmToken ? (Platform.OS === 'ios' ? 'ios' : 'android') : undefined,
    preferredCategories: preferences.length > 0 ? preferences : undefined,
  };

  return removeEmptyProfilePayloadValues(payload);
};

export const residentialLocationToAddressLines = (
  location: ResidentialLocation | null,
): { addressLine1: string; addressLine2: string } => ({
  addressLine1: location?.formattedAddress ?? '',
  addressLine2: [location?.city, location?.state, location?.postalCode, location?.country]
    .filter(Boolean)
    .join(', '),
});
