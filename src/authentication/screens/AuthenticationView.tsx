import React, { useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  ReduceMotion,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { BackButton, Button, Icon, Screen, Text, useTabBarSpace } from '../../components/ui';
import { AUTH_CONFIG } from '../constants/auth';
import { LoginMosaic } from '../components/LoginMosaic';
import type { useAuthenticationScreen } from '../../hooks/useAuthenticationScreen';
import { colors, fonts, motion, useReduceMotion } from '../../theme';

type Props = ReturnType<typeof useAuthenticationScreen> & { isEmbedded?: boolean };

const WORDMARK = require('../../assets/images/tooka-logo-wordmark.png');
const WORDMARK_HEIGHT = 44;
const WORDMARK_WIDTH = Math.round((628 / 216) * WORDMARK_HEIGHT);

const FOCUS_RING = 'rgba(255,176,46,0.7)';
const FIELD_BG = 'rgba(18,16,14,0.6)';

const stepIn = () => FadeInRight.duration(460).easing(motion.out).reduceMotion(ReduceMotion.System);
const cardIn = () => FadeInDown.duration(700).easing(motion.out).reduceMotion(ReduceMotion.System);

const AuthenticationView: React.FC<Props> = ({
  isEmbedded = false,
  step,
  phone,
  setPhone,
  name,
  setName,
  otp,
  otpDigits,
  setOtpCode,
  loading,
  error,
  isRegistered,
  isFormValid,
  timeLeft,
  isExpired,
  handlePhoneSubmit,
  handleNameSubmit,
  handleOtpSubmit,
  handleGoBackToPhone,
  handleResendOtp,
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const bottomSpace = isEmbedded ? tabSpace : Math.max(insets.bottom, 12);

  const prettyPhone = `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
  const isNewUser = isRegistered === false;
  const showBack = step === 'name' || step === 'otp';

  const openTerms = () => navigation.navigate('TermsAndConditions');
  const openPrivacy = () => navigation.navigate('PrivacyPolicy');

  return (
    <Screen>
      <LoginMosaic />

      <View style={[styles.top, { top: insets.top + 8 }]}>
        {showBack ? <BackButton onPress={handleGoBackToPhone} accessibilityLabel="Change number" /> : null}
        <Image
          source={WORDMARK}
          style={[styles.wordmark, showBack && styles.wordmarkAfterBack]}
          accessibilityLabel="Tooka, near you"
        />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.flex} onPress={Keyboard.dismiss} accessible={false} />

        <Animated.View entering={cardIn()} style={styles.cardWrap}>
          <View style={styles.panel}>
          {step === 'phone' ? (
            <Animated.View key="phone" entering={stepIn()}>
              <Text style={styles.h1}>Time to unwind again</Text>
              <Text style={styles.sub}>Enter your phone number to sign in or register.</Text>
              <Field>
                <View style={styles.cc}>
                  <Text style={styles.ccText}>IN +91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={AUTH_CONFIG.phoneLength}
                  placeholder="Mobile number"
                  placeholderTextColor={colors.subtle}
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={isFormValid ? handlePhoneSubmit : undefined}
                  accessibilityLabel="Mobile number"
                />
                {phone.length === AUTH_CONFIG.phoneLength ? <Tick /> : null}
              </Field>
              <ErrorText error={error} />
              <SubmitButton
                label="Send OTP"
                arrow
                onPress={handlePhoneSubmit}
                loading={loading}
                disabled={!isFormValid || loading}
              />
              <Legal onTerms={openTerms} onPrivacy={openPrivacy} />
            </Animated.View>
          ) : null}

          {step === 'name' ? (
            <Animated.View key="name" entering={stepIn()}>
              <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
              <Text style={styles.h1}>Join the sanctuary</Text>
              <Text style={styles.sub}>
                Tell us your name. We've texted a code to <Text style={styles.subStrong}>{prettyPhone}</Text>
                {' · '}
                <Text style={styles.subLink} onPress={handleGoBackToPhone} accessibilityRole="button">
                  Edit
                </Text>
              </Text>
              <Field>
                <View style={styles.lead}>
                  <Icon name="profile" size={18} color={colors.brand} />
                </View>
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                  maxLength={50}
                  editable={!loading}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={isFormValid ? handleNameSubmit : undefined}
                  accessibilityLabel="Full name"
                />
                {name.trim().length >= AUTH_CONFIG.minNameLength ? <Tick /> : null}
              </Field>
              <ErrorText error={error} />
              <SubmitButton
                label="Continue"
                arrow
                onPress={handleNameSubmit}
                loading={loading}
                disabled={!isFormValid || loading}
              />
              <Legal onTerms={openTerms} onPrivacy={openPrivacy} />
            </Animated.View>
          ) : null}

          {step === 'otp' ? (
            <Animated.View key="otp" entering={stepIn()}>
              {isNewUser ? <Text style={styles.eyebrow}>STEP 2 OF 2</Text> : null}
              <Text style={styles.h1}>Verify your number</Text>
              <Text style={styles.sub}>
                Enter the 6-digit code we sent to <Text style={styles.subStrong}>{prettyPhone}</Text>
                {' · '}
                <Text style={styles.subLink} onPress={handleGoBackToPhone} accessibilityRole="button">
                  Edit
                </Text>
              </Text>
              <OtpBoxes
                otp={otp}
                otpDigits={otpDigits}
                setOtpCode={setOtpCode}
                loading={loading}
                hasError={Boolean(error)}
              />
              <ErrorText error={error} />
              <View style={styles.resendRow}>
                {isExpired ? (
                  <>
                    <Text style={styles.small}>Didn't get it?</Text>
                    <Pressable onPress={handleResendOtp} disabled={loading} hitSlop={10} accessibilityRole="button">
                      <Text style={[styles.small, styles.link]}>Resend code</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.timer}>
                    <TimerRing left={timeLeft} />
                    <Text style={styles.small}>
                      Resend code in 0:{String(Math.max(0, timeLeft)).padStart(2, '0')}
                    </Text>
                  </View>
                )}
              </View>
              <SubmitButton
                label={loading ? 'Verifying' : 'Verify & continue'}
                onPress={handleOtpSubmit}
                loading={loading}
                disabled={!isFormValid || loading}
              />
            </Animated.View>
          ) : null}

          {step === 'success' ? (
            <Animated.View key="success" entering={stepIn()} style={styles.success}>
              <View style={styles.successIcon}>
                <Icon name="check" size={28} color={colors.sage} />
              </View>
              <Text style={styles.h1}>You're in</Text>
              <Text style={styles.sub}>You’re all set to explore Tooka wellness experiences.</Text>
            </Animated.View>
          ) : null}
          </View>
        </Animated.View>

        <Tagline style={{ marginBottom: bottomSpace }} />
      </KeyboardAvoidingView>
    </Screen>
  );
};

/** The input row: dark well that lights up in saffron while focused. */
function Field({ children }: { children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[styles.field, focused && styles.fieldFocused]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}>
      {children}
    </View>
  );
}

function Tick() {
  return (
    <Animated.View entering={ZoomIn.springify().reduceMotion(ReduceMotion.System)} style={styles.tick}>
      <Icon name="check" size={22} color={colors.sage} />
    </Animated.View>
  );
}

function ErrorText({ error }: { error: string }) {
  if (!error) {
    return null;
  }
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {error}
    </Text>
  );
}

function SubmitButton({
  label,
  arrow = false,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  arrow?: boolean;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      sheen={false}
      variant={disabled && !loading ? 'secondary' : 'primary'}
      icon={arrow ? <Icon name="arrowRight" size={18} color={disabled ? colors.subtle : colors.ink} /> : undefined}
      style={styles.button}
    />
  );
}

function Legal({ onTerms, onPrivacy }: { onTerms: () => void; onPrivacy: () => void }) {
  return (
    <Text style={styles.note}>
      By continuing you agree to our{' '}
      <Text style={styles.noteLink} onPress={onTerms} accessibilityRole="link">
        Terms
      </Text>{' '}
      and{' '}
      <Text style={styles.noteLink} onPress={onPrivacy} accessibilityRole="link">
        Privacy Policy
      </Text>
      . Standard message rates may apply.
    </Text>
  );
}

function OtpBoxes({
  otp,
  otpDigits,
  setOtpCode,
  loading,
  hasError,
}: {
  otp: string[];
  otpDigits: string;
  setOtpCode: (code: string) => void;
  loading: boolean;
  hasError: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!hasError || reduceMotion) {
      return;
    }
    const d = 70;
    shake.value = withSequence(
      withTiming(-8, { duration: d }),
      withTiming(8, { duration: d }),
      withTiming(-6, { duration: d }),
      withTiming(6, { duration: d }),
      withTiming(0, { duration: d }),
    );
  }, [hasError, reduceMotion, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <Animated.View style={[styles.boxes, shakeStyle]}>
      {otp.map((digit, i) => {
        const isCursor = !loading && !hasError && i === otpDigits.length;
        return (
          <View
            key={i}
            style={[
              styles.box,
              digit ? styles.boxFilled : null,
              isCursor ? styles.boxCursor : null,
              hasError ? styles.boxError : null,
            ]}>
            {isCursor ? <Caret /> : <Text style={[styles.boxText, hasError && styles.boxTextError]}>{digit}</Text>}
          </View>
        );
      })}
      <TextInput
        style={styles.hiddenInput}
        value={otpDigits}
        onChangeText={setOtpCode}
        keyboardType="number-pad"
        maxLength={AUTH_CONFIG.otpLength}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        editable={!loading}
        caretHidden
        accessibilityLabel={`6-digit verification code, ${otpDigits.length} of 6 entered`}
      />
    </Animated.View>
  );
}

function Caret() {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    // On for half a second, off for half a second.
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.caret, style]} />;
}

const RING_R = 8;
const RING_LENGTH = 2 * Math.PI * RING_R;

/** Saffron ring that empties as the resend countdown runs out. */
function TimerRing({ left }: { left: number }) {
  const share = Math.max(0, Math.min(1, left / AUTH_CONFIG.resendSeconds));
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20" style={styles.ring}>
      <Circle cx={10} cy={10} r={RING_R} fill="none" stroke={colors.edgeHi} strokeWidth={2.5} />
      <Circle
        cx={10}
        cy={10}
        r={RING_R}
        fill="none"
        stroke={colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - share)}
      />
    </Svg>
  );
}

function Tagline({ style }: { style?: object }) {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const dot = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.5,
    transform: [{ scale: 0.8 + pulse.value * 0.35 }],
  }));
  return (
    <View style={[styles.tagline, style]} accessible accessibilityLabel="A sanctuary for body and mind">
      <Animated.View style={[styles.tagDot, dot]} />
      <Text style={styles.tagText}>A SANCTUARY FOR BODY &amp; MIND</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  wordmark: { width: WORDMARK_WIDTH, height: WORDMARK_HEIGHT, resizeMode: 'contain' },
  wordmarkAfterBack: { marginLeft: 12 },
  cardWrap: { alignSelf: 'center', width: '100%', maxWidth: 520, paddingHorizontal: 20 },
  panel: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(29,25,21,0.92)',
    borderWidth: 1,
    borderColor: colors.edgeHi,
    boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
  },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: colors.text },
  eyebrow: {
    marginBottom: 12,
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 2.2,
    color: colors.brand,
  },
  sub: { marginTop: 8, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  subStrong: { fontFamily: fonts.bodySemiBold, color: colors.text },
  subLink: { fontFamily: fonts.bodySemiBold, color: colors.text, textDecorationLine: 'underline' },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  link: { color: colors.text, fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: colors.edgeHi,
  },
  fieldFocused: { borderColor: FOCUS_RING, borderWidth: 1.5 },
  cc: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: colors.edgeHi,
  },
  ccText: { fontFamily: fonts.display, fontSize: 15, color: colors.brand },
  lead: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
    borderRightWidth: 1,
    borderRightColor: colors.edgeHi,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontFamily: fonts.displayMedium,
    fontSize: 17,
    letterSpacing: 0.35,
    color: colors.text,
  },
  nameInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontFamily: fonts.displayMedium,
    fontSize: 17,
    color: colors.text,
  },
  tick: { marginRight: 14 },
  button: { marginTop: 16 },
  note: { marginTop: 14, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.subtle },
  noteLink: { color: colors.muted, textDecorationLine: 'underline' },
  error: { marginTop: 10, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.danger },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 22 },
  box: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: colors.edgeHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { backgroundColor: colors.s2, borderColor: 'rgba(251,243,232,0.3)', transform: [{ translateY: -2 }] },
  boxCursor: { borderColor: FOCUS_RING, borderWidth: 1.5 },
  boxError: { backgroundColor: 'rgba(240,138,126,0.1)', borderColor: colors.danger, borderWidth: 1.5 },
  boxText: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  boxTextError: { color: colors.danger },
  caret: { width: 2, height: 22, backgroundColor: colors.brand },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, marginTop: 6 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ring: { transform: [{ rotate: '-90deg' }] },
  success: { alignItems: 'flex-start', gap: 8 },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(156,199,168,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tagline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 20,
    paddingBottom: 8,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  tagText: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 2.4, color: colors.subtle },
});

export default AuthenticationView;
