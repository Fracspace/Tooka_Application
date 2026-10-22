import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import AddressCard from './components/AddressCard';
import DatePickerInput from './components/DatePickerInput';
import FloatingInput from './components/FloatingInput';
import GenderSelector from './components/GenderSelector';
import GradientButton from './components/GradientButton';
import Header from './components/Header';
import PhoneInput from './components/PhoneInput';
import ProfilePhotoCard from './components/ProfilePhotoCard';
import { styles } from './styles';
import EditProfileV4 from '../v4/EditProfileV4';
import { isV4 } from '../../../config/uiFlags';
import { DEFAULT_PICKER_DATE, useEditProfileScreen } from '../../../hooks/useEditProfileScreen';
import { GOOGLE_GEOCODING_API_KEY } from '../../../services/locationAddress';

/** How long v4 shows "Saved" on the button before going back. */
const SAVED_HOLD_MS = 900;

function EditProfileScreen(): React.ReactElement {
  const v4 = isV4('editProfile');
  const screen = useEditProfileScreen({ savedHoldMs: v4 ? SAVED_HOLD_MS : 0 });
  if (v4) {
    return <EditProfileV4 {...screen} />;
  }
  return <EditProfileLegacy screen={screen} />;
}

function EditProfileLegacy({ screen }: { screen: ReturnType<typeof useEditProfileScreen> }): React.ReactElement {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const {
    form,
    updateField,
    saving,
    submitted,
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
  } = screen;

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
                uploading={avatarUploading}
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
                  // Only where the picker opens; nothing is saved unless the user picks.
                  value={form.dateOfBirth ?? DEFAULT_PICKER_DATE}
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
              <Pressable onPress={handleClosePlaces} style={{backgroundColor:'#000000b5',position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:100}}>
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
