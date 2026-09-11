import type { EditProfileForm } from '../screens/Profile/EditProfile/types';
import type { ResidentialLocation, UpdateProfilePayload, UserProfile } from '../types/profile';
import { removeEmptyProfilePayloadValues } from './profileMappers';
import { Platform } from 'react-native';
import { getOnboarding } from './onboardingStorage';
import { getFcmToken } from './fcmStorage';

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatDateForApi = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseApiDate = (value?: string | null): Date => {
  if (!value) {
    return new Date(2000, 11, 18);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(2000, 11, 18) : parsed;
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
    gender:
      profile?.gender?.toLowerCase() === 'female'
        ? 'female'
        : profile?.gender?.toLowerCase() === 'other'
        ? 'other'
        : 'male',
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
  console.log("FCM TOken :", fcmToken);

  const payload: UpdateProfilePayload = {
    username: displayName,
    fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    displayName,
    email: form.email.trim(),
    phone: form.phoneNumber.replace(/\D/g, ''),
    gender: form.gender.toLowerCase(),
    dateOfBirth: formatDateForApi(form.dateOfBirth),
    lat: form.residentialLocation?.latitude,
    lng: form.residentialLocation?.longitude,
    lati: currentLocation?.latitude,
    lang: currentLocation?.longitude,
    pushToken: fcmToken ?? '',
    pushTokenPlatform: Platform.OS === 'ios' ? 'ios' : 'android',
    preferredCategories: onboarding?.answers?.preferences ?? [],
  };
  console.log('buildUpdateProfilePayload: form:', form, 'currentLocation:', currentLocation, 'payload:', payload);

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
