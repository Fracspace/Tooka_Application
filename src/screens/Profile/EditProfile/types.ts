import type { KeyboardTypeOptions } from 'react-native';
import type { ResidentialLocation } from '../../../types/profile';
import type { ProfileImage } from '../../../types/profileImage';

export type Gender = 'female' | 'male' | 'other';

export interface EditProfileForm {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  /** null until the user picks one - never defaulted, so nothing is invented on save. */
  gender: Gender | null;
  dateOfBirth: Date | null;
  addressLine1: string;
  addressLine2: string;
  profilePhotoUri: ProfileImage;
  residentialLocation: ResidentialLocation | null;
}

export interface FloatingInputProps {
  label: string;
  value: string;
  placeholder?: string;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  multiline?: boolean;
  onChangeText?: (value: string) => void;
}

export interface GenderOption {
  id: Gender;
  label: string;
  iconName: string;
}
