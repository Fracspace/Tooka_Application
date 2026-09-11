import type { ResidentialLocation, UpdateProfilePayload } from '../types/profile';

export interface ProfileValidationResult {
  valid: boolean;
  message?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9]{10}$/;

export const validateProfileUpdate = (
  payload: UpdateProfilePayload,
  residentialLocation: ResidentialLocation | null,
): ProfileValidationResult => {
  const fullName = payload.fullName?.trim() ?? '';
  const nameParts = fullName.split(/\s+/).filter(Boolean);

  if (!nameParts[0]) {
    return { valid: false, message: 'First name is required.' };
  }

  if (!nameParts[1]) {
    return { valid: false, message: 'Last name is required.' };
  }

  if (nameParts[0].length > 50 || nameParts.slice(1).join(' ').length > 50) {
    return { valid: false, message: 'Name must be 50 characters or less.' };
  }

  if (payload.email && !EMAIL_PATTERN.test(payload.email)) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  if (payload.phone && !PHONE_PATTERN.test(payload.phone.replace(/\D/g, ''))) {
    return { valid: false, message: 'Enter a valid phone number.' };
  }

  if (payload.dateOfBirth) {
    const dob = new Date(payload.dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      return { valid: false, message: 'Date of birth cannot be in the future.' };
    }
  }

  if (!payload.gender?.trim()) {
    return { valid: false, message: 'Select your gender.' };
  }

  if (
    residentialLocation &&
    (!Number.isFinite(residentialLocation.latitude) || !Number.isFinite(residentialLocation.longitude))
  ) {
    return { valid: false, message: 'Select a valid residential address.' };
  }

  return { valid: true };
};

export const getProfileErrorMessage = (error: unknown): string => {
  const candidate = error as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
    code?: string;
  };

  const status = candidate.response?.status;
  const apiMessage = candidate.response?.data?.message;

  if (apiMessage) {
    return apiMessage;
  }

  if (status === 401) {
    return 'Session expired. Please login again.';
  }
  if (status === 403) {
    return 'You do not have permission to update this profile.';
  }
  if (status === 404) {
    return 'Profile was not found.';
  }
  if (status === 409) {
    return 'This email is already in use.';
  }
  if (status === 422) {
    return 'Please check the profile details and try again.';
  }
  if (status && status >= 500) {
    return 'Server error. Please try again later.';
  }
  if (candidate.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }
  if (candidate.message?.toLowerCase().includes('network')) {
    return 'Network unavailable. Check your connection.';
  }

  return 'Something went wrong. Please try again.';
};
