import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { launchImageLibrary, type ImageLibraryOptions } from 'react-native-image-picker';
import type { GooglePlaceData, GooglePlaceDetail } from 'react-native-google-places-autocomplete';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { DATE_FORMATTER } from '../screens/Profile/EditProfile/constants';
import type { EditProfileForm, Gender } from '../screens/Profile/EditProfile/types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useProfile } from '../context/ProfileContext';
import { prepareProfileImageUpload } from '../services/profileImageUpload';
import {
  buildUpdateProfilePayload,
  formFromProfile,
  residentialLocationToAddressLines,
} from '../utils/profileForm';
import { validateProfileUpdate, getProfileErrorMessage } from '../utils/profileValidation';
import { residentialLocationFromGooglePlace } from '../utils/googlePlaces';

type EditProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;

/** Where the date picker starts when the user has no date of birth yet. */
export const DEFAULT_PICKER_DATE = new Date(2000, 0, 1);

// Downscaled on the device: full-resolution photos were uploaded as-is and often
// hit the 15s request timeout.
const imagePickerOptions: ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.8,
  maxWidth: 1024,
  maxHeight: 1024,
  selectionLimit: 1,
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** The fields the Save button watches. The photo is left out: it uploads on its own. */
const formSnapshot = (form: EditProfileForm): string =>
  JSON.stringify([
    form.firstName,
    form.lastName,
    form.email,
    form.gender,
    form.dateOfBirth?.getTime() ?? null,
    form.residentialLocation,
  ]);

type Options = {
  /** How long to show "Saved" before going back. 0 goes back at once. */
  savedHoldMs?: number;
};

/**
 * Form state and actions for Edit profile, shared by the old and v4 layouts.
 */
export function useEditProfileScreen({ savedHoldMs = 0 }: Options = {}) {
  const isMounted = React.useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const navigation = useNavigation<EditProfileNavigationProp>();
  const {
    profile,
    currentLocation,
    saving,
    avatarUploading,
    updateProfile,
    uploadAvatar,
    setResidentialLocation,
    refreshProfile,
    loading: profileLoading,
  } = useProfile();

  const [form, setForm] = useState<EditProfileForm>(() => formFromProfile(profile));
  const [baseline, setBaseline] = useState<string>(() => formSnapshot(formFromProfile(profile)));
  const hasHydratedRef = React.useRef<boolean>(!!profile);

  // If profile was not ready when screen mounted, hydrate once it arrives
  useEffect(() => {
    if (!hasHydratedRef.current && profile) {
      hasHydratedRef.current = true;
      const hydrated = formFromProfile(profile);
      setForm(hydrated);
      setBaseline(formSnapshot(hydrated));
    }
  }, [profile]);

  // If profile is missing and not already loading, refresh it once. The ref makes
  // "once" true: a failed refresh flips profileLoading back to false with profile
  // still null, which re-ran this effect and retried forever.
  const hasRequestedProfileRef = React.useRef<boolean>(false);
  useEffect(() => {
    if (!profile && !profileLoading && !hasRequestedProfileRef.current) {
      hasRequestedProfileRef.current = true;
      void refreshProfile();
    }
  }, [profile, profileLoading, refreshProfile]);

  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showPlacesSearch, setShowPlacesSearch] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [imagePicking, setImagePicking] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const isDirty = useMemo(() => formSnapshot(form) !== baseline, [form, baseline]);

  const minimumDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 100);
    return date;
  }, []);

  const maximumDate = useMemo(() => new Date(), []);

  const updateField = useCallback(
    <K extends keyof EditProfileForm>(key: K, value: EditProfileForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleChoosePhoto = useCallback(() => {
    if (imagePicking || avatarUploading) {
      return;
    }

    setImagePicking(true);
    launchImageLibrary(imagePickerOptions, async (response) => {
      setImagePicking(false);
      if (response.didCancel || response.errorCode) {
        if (response.errorCode) {
          Toast.show({
            type: 'error',
            text1: 'Photo selection failed',
            text2: response.errorMessage ?? 'Please try again.',
          });
        }
        return;
      }

      const [asset] = response.assets ?? [];
      if (asset?.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
        Toast.show({
          type: 'error',
          text1: 'Photo is too large',
          text2: 'Please choose a photo under 5 MB.',
        });
        return;
      }
      const prepared = asset ? prepareProfileImageUpload(asset) : null;
      if (!prepared || typeof prepared === 'string') {
        Toast.show({
          type: 'error',
          text1: 'Photo selection failed',
          text2: 'Selected image was invalid.',
        });
        return;
      }

      updateField('profilePhotoUri', prepared);

      try {
        const newUrl = await uploadAvatar(prepared);
        if (newUrl) {
          updateField('profilePhotoUri', newUrl);
          Toast.show({
            type: 'success',
            text1: 'Avatar updated successfully',
          });
        }
      } catch (uploadError) {
        updateField('profilePhotoUri', profile?.avatarUrl ?? null);
        Toast.show({
          type: 'error',
          text1: 'Upload failed',
          // The server's reason (e.g. file too large) instead of a generic line.
          text2: getProfileErrorMessage(uploadError),
        });
      }
    });
  }, [imagePicking, avatarUploading, updateField, uploadAvatar, profile?.avatarUrl]);

  const handleSelectGender = useCallback(
    (gender: Gender) => {
      updateField('gender', gender);
    },
    [updateField],
  );

  const handlePressDate = useCallback(() => {
    // if (showDatePicker) {
    //   return;
    // }

    setShowDatePicker(!showDatePicker);
  }, [showDatePicker]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }

      if (event.type === 'dismissed' || !selectedDate) {
        return;
      }

      updateField('dateOfBirth', selectedDate);
    },
    [updateField],
  );

  const handleEditAddress = useCallback(() => {
    setShowPlacesSearch((value) => !value);
  }, []);

  const handleClosePlaces = useCallback(() => {
    setShowPlacesSearch(false);
  }, []);

  const handleSelectPlace = useCallback(
    (_data: GooglePlaceData, details: GooglePlaceDetail | null = null) => {
      const residentialLocation = residentialLocationFromGooglePlace(details);

      if (!residentialLocation) {
        Toast.show({
          type: 'error',
          text1: 'Invalid address',
          text2: 'Please choose an address from the suggestions.',
        });
        return;
      }

      const lines = residentialLocationToAddressLines(residentialLocation);
      setForm((prev) => ({
        ...prev,
        residentialLocation,
        addressLine1: lines.addressLine1,
        addressLine2: lines.addressLine2,
      }));
      setShowPlacesSearch(false);
    },
    [],
  );

  const handlePlacesFail = useCallback(() => {
    Toast.show({
      type: 'error',
      text1: 'Address search failed',
      text2: 'Please try again.',
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || submitted || saved) {
      return;
    }

    setSubmitted(true);
    const payload = await buildUpdateProfilePayload(form, currentLocation);
    const validation = validateProfileUpdate(payload, form.residentialLocation);

    // console.log('handleSave: payload:', payload, 'validation:', validation);

    if (!validation.valid) {
      Toast.show({
        type: 'info',
        text1: 'Check profile details',
        text2: validation.message,
      });
      setSubmitted(false);
      return;
    }

    try {
      if (form.residentialLocation) {
        setResidentialLocation(form.residentialLocation);
      }

      await updateProfile(payload);
      if (form.residentialLocation) {
        setResidentialLocation(form.residentialLocation);
      }
      Toast.show({
        type: 'success',
        text1: 'Profile Updated Successfully',
      });

      if (savedHoldMs > 0) {
        setSaved(true);
        setTimeout(() => {
          if (isMounted.current && navigation.canGoBack()) {
            navigation.goBack();
          }
        }, savedHoldMs);
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Profile update failed',
        text2: getProfileErrorMessage(error),
      });
    } finally {
      if (isMounted.current) {
        setSubmitted(false);
      }
    }
  }, [
    currentLocation,
    form,
    navigation,
    saved,
    savedHoldMs,
    saving,
    setResidentialLocation,
    submitted,
    updateProfile,
  ]);

  const dateDisplayValue = form.dateOfBirth
    ? DATE_FORMATTER.format(form.dateOfBirth)
    : 'Select date of birth';

  return {
    form,
    updateField,
    saving,
    submitted,
    saved,
    isDirty,
    avatarUploading,
    showDatePicker,
    showPlacesSearch,
    minimumDate,
    maximumDate,
    dateDisplayValue,
    handleChoosePhoto,
    handleSelectGender,
    handlePressDate,
    handleDateChange,
    handleEditAddress,
    handleClosePlaces,
    handleSelectPlace,
    handlePlacesFail,
    handleSave,
  };
}
