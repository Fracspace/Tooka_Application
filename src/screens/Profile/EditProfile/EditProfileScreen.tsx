import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  launchImageLibrary,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import {
  GooglePlacesAutocomplete,
  type GooglePlaceData,
  type GooglePlaceDetail,
} from 'react-native-google-places-autocomplete';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import AddressCard from './components/AddressCard';
import DatePickerInput from './components/DatePickerInput';
import FloatingInput from './components/FloatingInput';
import GenderSelector from './components/GenderSelector';
import GradientButton from './components/GradientButton';
import Header from './components/Header';
import PhoneInput from './components/PhoneInput';
import ProfilePhotoCard from './components/ProfilePhotoCard';
import { DATE_FORMATTER } from './constants';
import { styles } from './styles';
import type { EditProfileForm, Gender } from './types';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useProfile } from '../../../context/ProfileContext';
import { GOOGLE_GEOCODING_API_KEY } from '../../../services/locationAddress';
import { prepareProfileImageUpload } from '../../../services/profileImageUpload';
import {
  buildUpdateProfilePayload,
  formFromProfile,
  residentialLocationToAddressLines,
} from '../../../utils/profileForm';
import { validateProfileUpdate, getProfileErrorMessage } from '../../../utils/profileValidation';
import { residentialLocationFromGooglePlace } from '../../../utils/googlePlaces';

type EditProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;

const imagePickerOptions: ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.8,
  selectionLimit: 1,
};

function EditProfileScreen(): React.ReactElement {
  const isMounted = React.useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const navigation = useNavigation<EditProfileNavigationProp>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
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
  const hasHydratedRef = React.useRef<boolean>(!!profile);

  // If profile was not ready when screen mounted, hydrate once it arrives
  useEffect(() => {
    if (!hasHydratedRef.current && profile) {
      hasHydratedRef.current = true;
      setForm(formFromProfile(profile));
    }
  }, [profile]);

  // If profile is missing and not already loading, refresh it once
  useEffect(() => {
    if (!profile && !profileLoading) {
      void refreshProfile();
    }
  }, [profile, profileLoading, refreshProfile]);

  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showPlacesSearch, setShowPlacesSearch] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [imagePicking, setImagePicking] = useState<boolean>(false);

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
      } catch (error) {
        updateField('profilePhotoUri', profile?.avatarUrl ?? null);
        Toast.show({
          type: 'error',
          text1: 'Upload failed',
          text2: 'Could not upload avatar. Please try again.',
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

  const handlePlacesFail = useCallback((error: unknown) => {
    Toast.show({
      type: 'error',
      text1: 'Address search failed',
      text2: 'Please try again.',
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || submitted) {
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

      if (navigation.canGoBack()) {
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
    saving,
    setResidentialLocation,
    submitted,
    updateProfile,
  ]);

  const dateDisplayValue = DATE_FORMATTER.format(form.dateOfBirth);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.screenRoot}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={[styles.scrollContent, isTablet && styles.tabletContent]}
          >
            <Header />
            <View style={styles.contentCard}>
              <ProfilePhotoCard
                photoUri={form.profilePhotoUri}
                onChoosePhoto={handleChoosePhoto}
              />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FloatingInput
                  label="FIRST NAME"
                  value={form.firstName}
                  onChangeText={(value) => updateField('firstName', value)}
                />
              </View>
              <View style={styles.rowItem}>
                <FloatingInput
                  label="LAST NAME"
                  value={form.lastName}
                  onChangeText={(value) => updateField('lastName', value)}
                />
              </View>
            </View>

            <View style={styles.blockSpacing}>
              <FloatingInput
                label="EMAIL ADDRESS"
                value={form.email}
                keyboardType="email-address"
                onChangeText={(value) => updateField('email', value)}
              />
            </View>

            <View style={styles.blockSpacing}>
              <PhoneInput
                countryCode={form.countryCode}
                phoneNumber={form.phoneNumber}
                editable={false}
              />
            </View>

            <View style={styles.blockSpacing}>
              <GenderSelector
                selectedGender={form.gender}
                onSelectGender={handleSelectGender}
              />
            </View>

            <View style={styles.blockSpacing}>
              <DatePickerInput
                value={form.dateOfBirth}
                displayValue={dateDisplayValue}
                onPress={handlePressDate}
              />
              {showDatePicker ? (
                <DateTimePicker
                  value={form.dateOfBirth}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={maximumDate}
                  minimumDate={minimumDate}
                  onChange={handleDateChange}
                />
              ) : null}
            </View>

            <View style={styles.blockSpacing}>
              <AddressCard
                addressLine1={form.addressLine1 || 'Add residential address'}
                addressLine2={form.addressLine2 || 'Not specified'}
                onEditAddress={handleEditAddress}
              />
            </View>

            <View style={styles.saveWrap}>
              <GradientButton
                title="Save Profile"
                onPress={handleSave}
                loading={saving || submitted}
                disabled={saving || submitted}
              />
            </View>
            </View>
          </ScrollView>

          {showPlacesSearch ? (
            <>
              <Pressable
                style={styles.placesOverlayBackdrop}
                onPress={handleClosePlaces}
                accessibilityRole="button"
                accessibilityLabel="Close address search"
              />
              <Pressable onPress={() => {setShowPlacesSearch(false)}} style={{backgroundColor:'#000000b5',position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:100}}>
              <GooglePlacesAutocomplete
                placeholder="Search residential address"
                fetchDetails
                debounce={250}
                enablePoweredByContainer={false}
                keyboardShouldPersistTaps="handled"
                listViewDisplayed="auto"
                onPress={handleSelectPlace}
                onFail={handlePlacesFail}
                onNotFound={() => {
                  Toast.show({
                    type: 'info',
                    text1: 'No address found',
                    text2: 'Try a different search.',
                  });
                }}
                query={{
                  key: GOOGLE_GEOCODING_API_KEY,
                  language: 'en',
                }}
                styles={{
                  container: styles.placesContainer,
                  textInput: styles.placesTextInput,
                  listView: styles.placesListView,
                  row: styles.placesRow,
                  description: styles.placesDescription,
                }}
              />
              </Pressable>
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default EditProfileScreen;
