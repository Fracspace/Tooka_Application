import React, { useEffect } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInRight,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Button, Icon, Screen, Text, useTabBarSpace, type IconName } from '../../components/ui';
import { AUTH_CONFIG, AUTH_TEXT } from '../constants/auth';
import type { useAuthenticationScreen } from '../../hooks/useAuthenticationScreen';
import { colors, fonts, motion, useReduceMotion } from '../../theme';

type Props = ReturnType<typeof useAuthenticationScreen> & { isEmbedded?: boolean };

const LOGO = require('../../assets/images/tooka-logo.png');

/** Light outline used for focus and filled states, so saffron stays on the button. */
const FOCUS_RING = 'rgba(251,243,232,0.55)';

const stepIn = () => FadeInRight.duration(motion.enter).easing(motion.out).reduceMotion(ReduceMotion.System);

const AuthenticationV4: React.FC<Props> = ({
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
  const bottomSpace = isEmbedded ? tabSpace : Math.max(insets.bottom, 16) + 8;

  const prettyPhone = `${phone.slice(0, 5)} ${phone.slice(5)}`;
  const resendIn = `0:${String(Math.max(0, timeLeft)).padStart(2, '0')}`;

  const submit = step === 'phone' ? handlePhoneSubmit : step === 'name' ? handleNameSubmit : handleOtpSubmit;
  const buttonLabel = step === 'phone' ? 'Get code' : step === 'name' ? 'Continue' : 'Verify & log in';

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomSpace }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <Pressable style={[styles.stage, { paddingTop: insets.top + 16 }]} onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.sun} pointerEvents="none" />
            <Image source={LOGO} style={styles.logo} accessibilityLabel="Tooka" />
            <View style={styles.cards} pointerEvents="none">
              <FloatCard icon="clock" title="Deep tissue" sub="Tonight · 8:30 PM" style={styles.cardA} tilt={-6} delay={0} />
              <FloatCard icon="check" title="Booked in 4 taps" sub="Hot stone · 60 min" style={styles.cardB} tilt={4} delay={900} done />
              <FloatCard icon="calendar" title="Couples" sub="Sat · 11:00 AM" style={styles.cardC} tilt={-2} delay={1800} />
            </View>
          </Pressable>

          <View style={styles.panel}>
            {step === 'phone' ? (
              <Animated.View key="phone" entering={stepIn()}>
                <Text style={styles.h1}>
                  Unwind tonight.{'\n'}
                  <Text style={[styles.h1, styles.h1Muted]}>Start with your number.</Text>
                </Text>
                <View style={styles.field}>
                  <Text style={styles.cc}>+91</Text>
                  <View style={styles.ccRule} />
                  <TextInput
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={AUTH_CONFIG.phoneLength}
                    placeholder="98765 43210"
                    placeholderTextColor={colors.s3}
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={isFormValid ? handlePhoneSubmit : undefined}
                    accessibilityLabel="Mobile number"
                  />
                  {phone.length === AUTH_CONFIG.phoneLength ? <Icon name="check" size={20} color={colors.sage} /> : null}
                </View>
                <Text style={styles.sub}>We'll text you a 6-digit code. No passwords.</Text>
              </Animated.View>
            ) : null}

            {step === 'name' ? (
              <Animated.View key="name" entering={stepIn()}>
                <Text style={styles.h1}>{AUTH_TEXT.nameTitle}</Text>
                <Text style={styles.sub}>{AUTH_TEXT.nameSubtitle}</Text>
                <View style={styles.field}>
                  <TextInput
                    style={styles.nameInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="words"
                    textContentType="name"
                    autoComplete="name"
                    maxLength={50}
                    editable={!loading}
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={isFormValid ? handleNameSubmit : undefined}
                    accessibilityLabel="Your name"
                  />
                </View>
                <ChangeNumber phone={prettyPhone} onPress={handleGoBackToPhone} />
              </Animated.View>
            ) : null}

            {step === 'otp' ? (
              <Animated.View key="otp" entering={stepIn()}>
                <Text style={styles.h1}>
                  Check your <Text style={[styles.h1, styles.h1Muted]}>messages.</Text>
                </Text>
                <ChangeNumber phone={prettyPhone} onPress={handleGoBackToPhone} />
                <View style={styles.boxes}>
                  {otp.map((digit, i) => {
                    const isCursor = !loading && i === otpDigits.length;
                    return (
                      <View
                        key={i}
                        style={[styles.box, digit ? styles.boxFilled : null, isCursor ? styles.boxCursor : null]}>
                        <Text style={styles.boxText}>{digit}</Text>
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
                    accessibilityLabel={`6-digit code, ${otpDigits.length} of 6 entered`}
                  />
                </View>
                <View style={styles.resendRow}>
                  <Text style={styles.small}>Didn't get it?</Text>
                  {isExpired ? (
                    <Pressable onPress={handleResendOtp} disabled={loading} hitSlop={10} accessibilityRole="button">
                      <Text style={[styles.small, styles.link]}>Resend code</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.small}>Resend in {resendIn}</Text>
                  )}
                </View>
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

            {error && step !== 'success' ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.spacer} />

            {step !== 'success' ? (
              <>
                <Button
                  label={buttonLabel}
                  onPress={submit}
                  loading={loading}
                  disabled={!isFormValid || loading}
                  sheen={false}
                />
                {step !== 'name' ? (
                  <View style={styles.legal}>
                    <Text style={styles.legalText}>By continuing you agree to Tooka's </Text>
                    <Pressable onPress={() => navigation.navigate('PrivacyPolicy')} hitSlop={8} accessibilityRole="link">
                      <Text style={[styles.legalText, styles.legalLink]}>Privacy Policy</Text>
                    </Pressable>
                    <Text style={styles.legalText}> and </Text>
                    <Pressable onPress={() => navigation.navigate('TermsAndConditions')} hitSlop={8} accessibilityRole="link">
                      <Text style={[styles.legalText, styles.legalLink]}>Terms of Service</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

function ChangeNumber({ phone, onPress }: { phone: string; onPress: () => void }) {
  return (
    <View style={styles.changeRow}>
      <Text style={styles.sub}>Code sent to +91 {phone} · </Text>
      <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change number">
        <Text style={[styles.sub, styles.link]}>Edit</Text>
      </Pressable>
    </View>
  );
}

function FloatCard({
  icon,
  title,
  sub,
  style,
  tilt,
  delay,
  done = false,
}: {
  icon: IconName;
  title: string;
  sub: string;
  style: object;
  tilt: number;
  delay: number;
  done?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    y.value = withDelay(
      delay,
      withRepeat(withTiming(-10, { duration: 3500, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(y);
  }, [delay, reduceMotion, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${tilt}deg` }] }));
  return (
    <Animated.View style={[styles.card, done && styles.cardDone, style, anim]}>
      <View style={[styles.cardIcon, done && styles.cardIconDone]}>
        <Icon name={icon} size={18} color={done ? colors.sage : colors.muted} />
      </View>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  stage: { height: 330, alignItems: 'center', overflow: 'hidden' },
  sun: {
    position: 'absolute',
    top: 120,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(255,176,46,0.06)',
  },
  logo: { width: 64, height: 64, borderRadius: 18 },
  cards: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 210 },
  card: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: 'rgba(255,240,224,0.16)',
  },
  cardDone: { backgroundColor: colors.s2 },
  cardA: { left: 28, top: 0 },
  cardB: { right: 24, top: 72 },
  cardC: { left: 40, top: 144 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconDone: { backgroundColor: 'rgba(156,199,168,0.16)' },
  cardTitle: { fontFamily: fonts.display, fontSize: 13, lineHeight: 18, color: colors.text },
  cardSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.muted },
  panel: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  h1: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8, color: colors.text },
  h1Muted: { color: colors.muted },
  sub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  link: { color: colors.text, fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  changeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: 'rgba(255,240,224,0.16)',
  },
  cc: { fontFamily: fonts.display, fontSize: 15, color: colors.muted },
  ccRule: { width: 1, height: 24, marginHorizontal: 14, backgroundColor: 'rgba(255,240,224,0.16)' },
  phoneInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 0.7,
    color: colors.text,
  },
  nameInput: { flex: 1, height: '100%', padding: 0, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 24 },
  box: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: 'rgba(255,240,224,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { backgroundColor: colors.s2, borderColor: 'rgba(251,243,232,0.3)' },
  boxCursor: { borderColor: FOCUS_RING, borderWidth: 1.5 },
  boxText: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
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
  error: { marginTop: 12, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.danger },
  spacer: { flex: 1, minHeight: 24 },
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 },
  legalText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.subtle },
  legalLink: { color: colors.muted, textDecorationLine: 'underline' },
});

export default AuthenticationV4;
