import type {
  ProfileApiResponse,
  ProfileCurrentLocation,
  ResidentialLocation,
  UpdateProfilePayload,
  UserProfile,
} from '../types/profile';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' ? (value as UnknownRecord) : {};

const stringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return value == null ? null : String(value);
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const booleanOrNull = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const numberOrNull = (value: unknown): number | null => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : null;
};

const pickString = (source: UnknownRecord, keys: string[]): string | null => {
  for (const key of keys) {
    const value = stringOrNull(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickNumber = (source: UnknownRecord, keys: string[]): number | null => {
  for (const key of keys) {
    const value = numberOrNull(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const normalizeResidentialLocation = (source: UnknownRecord): ResidentialLocation | null => {
  const nested = asRecord(source.residentialLocation);
  const formattedAddress =
    pickString(nested, ['formattedAddress', 'address']) ??
    pickString(source, ['formattedAddress', 'residentialAddress', 'address']);
  const latitude =
    pickNumber(nested, ['latitude']) ?? pickNumber(source, ['lat', 'latitude']);
  const longitude =
    pickNumber(nested, ['longitude']) ?? pickNumber(source, ['lng', 'longitude']);

  if (!formattedAddress || latitude === null || longitude === null) {
    return null;
  }

  return {
    formattedAddress,
    latitude,
    longitude,
    city: pickString(nested, ['city']) ?? pickString(source, ['city']),
    state: pickString(nested, ['state']) ?? pickString(source, ['state']),
    country: pickString(nested, ['country']) ?? pickString(source, ['country']),
    postalCode: pickString(nested, ['postalCode']) ?? pickString(source, ['postalCode', 'pincode']),
    placeId: pickString(nested, ['placeId']) ?? pickString(source, ['placeId']),
  };
};

const normalizeCurrentLocation = (source: UnknownRecord): ProfileCurrentLocation | null => {
  const nested = asRecord(source.currentLocation);
  const latitude = pickNumber(nested, ['latitude']) ?? pickNumber(source, ['lati']);
  const longitude = pickNumber(nested, ['longitude']) ?? pickNumber(source, ['lang']);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

export const normalizeProfileResponse = (response: ProfileApiResponse): UserProfile => {
  const raw = asRecord(response.data ?? response.profile ?? response.user ?? response);

  return {
    id: pickString(raw, ['id', '_id', 'userId']) ?? '',
    phone: pickString(raw, ['phone', 'phoneNumber']),
    email: pickString(raw, ['email']),
    username: pickString(raw, ['username', 'userName']),
    fullName: pickString(raw, ['fullName', 'name']),
    displayName: pickString(raw, ['displayName']),
    avatarUrl: pickString(raw, ['avatarUrl', 'avatarUrl', 'profilePhoto']),
    gender: pickString(raw, ['gender']),
    dateOfBirth: pickString(raw, ['dateOfBirth', 'dob']),
    preferredLanguage: pickString(raw, ['preferredLanguage']),
    preferredCurrency: pickString(raw, ['preferredCurrency']),
    city: pickString(raw, ['cityName', 'city']),
    citySlug: pickString(raw, ['citySlug']),
    cityId: pickString(raw, ['cityId']),
    isPhoneVerified: booleanOrNull(raw.isPhoneVerified),
    isEmailVerified: booleanOrNull(raw.isEmailVerified),
    createdAt: pickString(raw, ['createdAt']),
    role: pickString(raw, ['role']),
    userType: pickString(raw, ['userType']),
    isActive: booleanOrNull(raw.isActive),
    currentLocation: normalizeCurrentLocation(raw),
    residentialLocation: normalizeResidentialLocation(raw),
    pushToken: pickString(raw, ['pushToken', 'fcmToken']),
    pushTokenPlatform: pickString(raw, ['pushTokenPlatform', 'platform']),
    preferredCategories: Array.isArray(raw.preferredCategories) ? raw.preferredCategories : null,
  };
};

export const mergeProfile = (
  previous: UserProfile | null,
  next: Partial<UserProfile>,
): UserProfile => ({
  id: next.id ?? previous?.id ?? '',
  phone: next.phone ?? previous?.phone ?? null,
  email: next.email ?? previous?.email ?? null,
  username: next.username ?? previous?.username ?? null,
  fullName: next.fullName ?? previous?.fullName ?? null,
  displayName: next.displayName ?? previous?.displayName ?? null,
  avatarUrl: next.avatarUrl ?? previous?.avatarUrl ?? null,
  gender: next.gender ?? previous?.gender ?? null,
  dateOfBirth: next.dateOfBirth ?? previous?.dateOfBirth ?? null,
  preferredLanguage: next.preferredLanguage ?? previous?.preferredLanguage ?? null,
  preferredCurrency: next.preferredCurrency ?? previous?.preferredCurrency ?? null,
  city: next.city ?? previous?.city ?? null,
  citySlug: next.citySlug ?? previous?.citySlug ?? null,
  cityId: next.cityId ?? previous?.cityId ?? null,
  isPhoneVerified: next.isPhoneVerified ?? previous?.isPhoneVerified ?? null,
  isEmailVerified: next.isEmailVerified ?? previous?.isEmailVerified ?? null,
  createdAt: next.createdAt ?? previous?.createdAt ?? null,
  role: next.role ?? previous?.role ?? null,
  userType: next.userType ?? previous?.userType ?? null,
  isActive: next.isActive ?? previous?.isActive ?? null,
  currentLocation: next.currentLocation ?? previous?.currentLocation ?? null,
  residentialLocation: next.residentialLocation ?? previous?.residentialLocation ?? null,
  pushToken: next.pushToken ?? previous?.pushToken ?? null,
  pushTokenPlatform: next.pushTokenPlatform ?? previous?.pushTokenPlatform ?? null,
  preferredCategories: next.preferredCategories ?? previous?.preferredCategories ?? null,
});

export const removeEmptyProfilePayloadValues = (
  payload: UpdateProfilePayload,
): UpdateProfilePayload => {
  const entries = Object.entries(payload).filter(([, value]) => {
    return value !== undefined && value !== null;
  });

  return Object.fromEntries(entries) as UpdateProfilePayload;
};
