import type { ProfileImage } from './profileImage';

export type ProfileGender = 'female' | 'male' | 'other' | string;
export interface ProfileCurrentLocation {
  latitude: number;
  longitude: number;
}

export interface ResidentialLocation {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  placeId?: string | null;
}

export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  username: string | null;
  fullName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  gender: ProfileGender | null;
  dateOfBirth: string | null;
  preferredLanguage: string | null;
  preferredCurrency: string | null;
  city: string | null;
  citySlug: string | null;
  cityId: string | null;
  isPhoneVerified: boolean | null;
  isEmailVerified: boolean | null;
  createdAt: string | null;
  role: string | null;
  userType: string | null;
  isActive: boolean | null;
  currentLocation: ProfileCurrentLocation | null;
  residentialLocation: ResidentialLocation | null;
  pushToken: string | null;
  pushTokenPlatform: 'ios' | 'android' | string | null;
  preferredCategories: string[] | null;
}

export interface ProfileApiResponse {
  success?: boolean;
  data?: Partial<UserProfile> | null;
  profile?: Partial<UserProfile> | null;
  user?: Partial<UserProfile> | null;
}

export interface AvatarUploadResponse {
  success: boolean;
  data: {
    id: string;
    avatarUrl: string;
  };
}

export interface DeleteAccountResponse {
  success: boolean;
  data: {
    deleted: boolean;
    id: string;
  };
}

export interface UpdateProfilePayload {
  username?: string;
  fullName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  lat?: number;
  lng?: number;
  lati?: number;
  lang?: number;
  pushToken?: string;
  pushTokenPlatform?: 'ios' | 'android';
  preferredCategories?: string[];
}

export interface ProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  isLoading: boolean;
  refreshing: boolean;
  saving: boolean;
  avatarUploading: boolean;
  error: string | null;
  currentLocation: ProfileCurrentLocation | null;
  refreshProfile: (options?: { force?: boolean }) => Promise<UserProfile | null>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<UserProfile | null>;
  uploadAvatar: (asset: { uri: string; type?: string; fileName?: string }) => Promise<string | null>;
  clearProfile: () => void;
  setProfile: (profile: UserProfile | null) => void;
  setResidentialLocation: (location: ResidentialLocation | null) => void;
  setLocalProfile: (profile: UserProfile | null) => void;
}
