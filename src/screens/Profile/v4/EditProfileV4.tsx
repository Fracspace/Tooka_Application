import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { BackButton, Button, Icon, PressableScale, Screen, Text, type IconName } from '../../../components/ui';
import { DEFAULT_PICKER_DATE, type useEditProfileScreen } from '../../../hooks/useEditProfileScreen';
import { GOOGLE_GEOCODING_API_KEY } from '../../../services/locationAddress';
import {
  brandAlpha,
  colors,
  fonts,
  gradients,
  motion,
  radii,
  fadeIn,
  rise,
  shadows,
  type as typeStyles,
  useReduceMotion,
} from '../../../theme';
import { GENDER_OPTIONS } from '../EditProfile/constants';
import type { Gender } from '../EditProfile/types';

type Props = ReturnType<typeof useEditProfileScreen>;

const EditProfileV4: React.FC<Props> = ({
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
}) => {
  const navigation = useNavigation();
  const initials = [form.firstName, form.lastName]
    .map((part) => part.trim()[0]?.toUpperCase() ?? '')
    .join('');
  const photoUri = typeof form.profilePhotoUri === 'string' ? form.profilePhotoUri : form.profilePhotoUri?.uri;
  const phone = form.phoneNumber ? `${form.countryCode} ${form.phoneNumber}` : '';
  const busy = saving || submitted;

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <BackButton onPress={() => navigation.goBack()} accessibilityLabel="Back to Profile" />
            <View>
              <Text variant="title">Personal details</Text>
              <Text variant="caption" color={colors.muted}>
                Helps spas get your booking right
              </Text>
            </View>
          </View>

          <Animated.View entering={rise(0)} style={styles.photoBlock}>
            <View style={styles.photo}>
              <Halo />
              <View style={styles.face}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.faceImage} />
                ) : initials ? (
                  <Text style={styles.initials}>{initials}</Text>
                ) : (
                  <Icon name="profile" size={36} color={colors.muted} />
                )}
                {avatarUploading ? (
                  <View style={styles.uploading}>
                    <ActivityIndicator color={colors.text} />
                  </View>
                ) : null}
              </View>
              <PressableScale
                onPress={handleChoosePhoto}
                scaleTo={0.94}
                hitSlop={6}
                disabled={avatarUploading}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                style={styles.cam}>
                <Icon name="camera" size={17} color={colors.ink} strokeWidth={2.2} />
              </PressableScale>
            </View>
            <Text variant="caption" color={colors.muted} style={styles.photoHint}>
              Tap the camera to add a photo
            </Text>
          </Animated.View>

          <View style={styles.form}>
            <Animated.View entering={rise(60)} style={styles.row}>
              <View style={styles.rowItem}>
                <Label>FIRST NAME</Label>
                <Field value={form.firstName} onChangeText={(value) => updateField('firstName', value)} autoComplete="given-name" />
              </View>
              <View style={styles.rowItem}>
                <Label>LAST NAME</Label>
                <Field value={form.lastName} onChangeText={(value) => updateField('lastName', value)} autoComplete="family-name" />
              </View>
            </Animated.View>

            <Animated.View entering={rise(100)}>
              <Label>EMAIL</Label>
              <Field
                icon="mail"
                value={form.email}
                onChangeText={(value) => updateField('email', value)}
                keyboardType="email-address"
                autoComplete="email"
              />
            </Animated.View>

            <Animated.View entering={rise(140)}>
              <Label>PHONE</Label>
              <View style={[styles.field, styles.fieldLocked]}>
                <Icon name="lock" size={16} color={colors.subtle} />
                <Text style={[styles.input, styles.lockedText]} numberOfLines={1}>
                  {phone}
                </Text>
                <View style={styles.verified}>
                  <Icon name="check" size={11} color={colors.sage} strokeWidth={3} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              <Text style={styles.note}>Your login number can't be changed here.</Text>
            </Animated.View>

            <Animated.View entering={rise(180)}>
              <Label>GENDER</Label>
              <GenderSegment value={form.gender} onChange={handleSelectGender} />
            </Animated.View>

            <Animated.View entering={rise(220)}>
              <Label>DATE OF BIRTH</Label>
              <Pressable
                onPress={handlePressDate}
                accessibilityRole="button"
                accessibilityLabel={`Date of birth, ${dateDisplayValue}`}
                style={[styles.field, showDatePicker && styles.fieldFocused]}>
                <Text
                  style={[styles.input, !form.dateOfBirth && { color: colors.subtle }]}
                  numberOfLines={1}>
                  {form.dateOfBirth ? dateDisplayValue : 'DD MMM YYYY'}
                </Text>
                <Icon name="calendar" size={18} color={colors.muted} />
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  // Only where the picker opens; nothing is saved unless the user picks.
                  value={form.dateOfBirth ?? DEFAULT_PICKER_DATE}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant="dark"
                  textColor={colors.text}
                  maximumDate={maximumDate}
                  minimumDate={minimumDate}
                  onChange={handleDateChange}
                />
              ) : null}
            </Animated.View>

            <Animated.View entering={rise(260)}>
              <Label>ADDRESS</Label>
              <AddressButton
                open={showPlacesSearch}
                title={form.addressLine1 || 'Add your home address'}
                subtitle={form.addressLine2 || 'Used to show spas near your home'}
                onPress={handleEditAddress}
              />
            </Animated.View>
          </View>
        </ScrollView>

        <View style={styles.foot} pointerEvents="box-none">
          <SaveButton busy={busy} saved={saved} dirty={isDirty} onPress={handleSave} />
        </View>

        {showPlacesSearch ? (
          <Pressable
            onPress={handleClosePlaces}
            accessibilityRole="button"
            accessibilityLabel="Close address search"
            style={styles.placesBackdrop}>
            <GooglePlacesAutocomplete
              placeholder="Search your home address"
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
              textInputProps={{ placeholderTextColor: colors.subtle, autoFocus: true }}
              styles={{
                container: styles.placesContainer,
                textInputContainer: styles.placesInputWrap,
                textInput: styles.placesTextInput,
                listView: styles.placesListView,
                row: styles.placesRow,
                separator: styles.placesSeparator,
                description: styles.placesDescription,
              }}
            />
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
};

/**
 * Save: grey "No changes yet" until something changes, saffron "Save changes",
 * a spinner while saving, then a sage "Saved" tick before going back.
 */
function SaveButton({ busy, saved, dirty, onPress }: { busy: boolean; saved: boolean; dirty: boolean; onPress: () => void }) {
  if (dirty && !busy && !saved) {
    return <Button label="Save changes" onPress={onPress} />;
  }
  const label = saved ? 'Saved' : busy ? 'Saving' : 'No changes yet';
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: true, busy }}
      style={[styles.save, saved ? styles.saveDone : busy ? styles.saveBusy : styles.saveIdle]}>
      {saved ? (
        <Animated.View entering={fadeIn()}>
          <Icon name="check" size={20} color={colors.ink} />
        </Animated.View>
      ) : busy ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : null}
      <Text style={[styles.saveText, { color: saved || busy ? colors.ink : colors.subtle }]}>{label}</Text>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

type FieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  icon?: IconName;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: 'given-name' | 'family-name' | 'email';
};

/** A text field that lights up with a saffron ring while focused. */
function Field({ value, onChangeText, icon, keyboardType, autoComplete }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      {icon ? <Icon name={icon} size={17} color={colors.subtle} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.subtle}
        selectionColor={colors.brand}
        style={styles.input}
      />
    </View>
  );
}

/** Female / Male / Other with a saffron pill that springs to the choice. */
function GenderSegment({ value, onChange }: { value: Gender | null; onChange: (gender: Gender) => void }) {
  const [width, setWidth] = useState(0);
  const index = GENDER_OPTIONS.findIndex((option) => option.id === value);
  const x = useSharedValue(Math.max(index, 0));
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (index < 0) {
      return;
    }
    x.value = reduceMotion ? index : withTiming(index, { duration: 440, easing: motion.spring });
  }, [index, reduceMotion, x]);

  const pillWidth = (width - 8) / GENDER_OPTIONS.length;
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * pillWidth }] }));

  return (
    <View
      style={styles.seg}
      accessibilityRole="radiogroup"
      accessibilityLabel="Gender"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {index >= 0 && width > 0 ? <Animated.View style={[styles.pill, { width: pillWidth }, pillStyle]} /> : null}
      {GENDER_OPTIONS.map((option) => {
        const on = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={styles.segButton}>
            <Text style={[styles.segText, { color: on ? colors.onBrand : colors.muted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AddressButton({ open, title, subtitle, onPress }: { open: boolean; title: string; subtitle: string; onPress: () => void }) {
  const turn = useSharedValue(open ? 1 : 0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    turn.value = reduceMotion ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 320, easing: motion.spring });
  }, [open, reduceMotion, turn]);

  const plusStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 45}deg` }] }));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={title}
      style={styles.addr}>
      <Animated.View style={[styles.plus, plusStyle]}>
        <Icon name="plus" size={16} color={colors.brand} />
      </Animated.View>
      <View style={styles.flex}>
        <Text variant="itemTitle" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color={colors.muted} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </PressableScale>
  );
}

/** The dashed saffron ring that turns slowly around the photo. */
function Halo() {
  const reduceMotion = useReduceMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    angle.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1);
    return () => cancelAnimation(angle);
  }, [reduceMotion, angle]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  return <Animated.View pointerEvents="none" style={[styles.halo, style]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 52, paddingHorizontal: 16 },

  photoBlock: { marginTop: 26, alignItems: 'center' },
  photo: { width: 104, height: 104 },
  halo: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 60,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: brandAlpha(0.5),
  },
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: 52,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(160deg, #3A3129 0%, #241E19 100%)',
    boxShadow: shadows.ringHi,
  },
  faceImage: { width: '100%', height: '100%' },
  initials: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  uploading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  cam: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 0 4px ${colors.bg}`,
  },
  photoHint: { marginTop: 12 },

  form: { paddingTop: 22, paddingHorizontal: 16, gap: 18 },
  row: { flexDirection: 'row', gap: 10 },
  rowItem: { flex: 1, minWidth: 0 },
  label: {
    marginBottom: 8,
    marginLeft: 4,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.32,
    color: colors.subtle,
  },
  field: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.s1,
    boxShadow: shadows.ringHi,
  },
  fieldFocused: {
    backgroundColor: '#211C17',
    boxShadow: `inset 0 0 0 1.5px ${colors.brand}, 0 0 0 4px ${brandAlpha(0.12)}`,
  },
  fieldLocked: { backgroundColor: 'transparent', boxShadow: shadows.ring },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  lockedText: { color: colors.muted },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(156,199,168,0.12)',
  },
  verifiedText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13, color: colors.sage },
  note: { marginTop: 6, marginLeft: 4, fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.subtle },

  seg: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.md,
    backgroundColor: colors.s1,
    boxShadow: shadows.ringHi,
  },
  pill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 12,
    backgroundColor: colors.brand,
    boxShadow: shadows.selected,
  },
  segButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 17 },

  addr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.md,
    boxShadow: shadows.ringHi,
  },
  plus: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 28,
    experimental_backgroundImage: gradients.dock,
  },

  save: {
    height: 56,
    borderRadius: radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveIdle: { backgroundColor: colors.s2 },
  saveBusy: { backgroundColor: colors.brand },
  saveDone: { backgroundColor: colors.sage },
  saveText: typeStyles.button,

  placesBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  placesContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 110,
    zIndex: 101,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.s1,
    boxShadow: shadows.ringHi,
    flex: 0,
  },
  placesInputWrap: { backgroundColor: colors.s1, paddingHorizontal: 6 },
  placesTextInput: {
    height: 54,
    marginBottom: 0,
    backgroundColor: colors.s1,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  placesListView: { maxHeight: 320, backgroundColor: colors.s1 },
  placesRow: { backgroundColor: colors.s1, paddingVertical: 14 },
  placesSeparator: { height: 1, backgroundColor: colors.edge },
  placesDescription: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});

export default EditProfileV4;
