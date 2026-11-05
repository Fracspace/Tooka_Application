import React from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { AuthHeader } from '../components/AuthHeader';
import { AuthCard } from '../components/AuthCard';
import { GradientButton } from '../components/GradientButton';
import { NameInput } from '../components/NameInput';
import { OTPInput } from '../components/OTPInput';
import { PhoneInput } from '../components/PhoneInput';
import { ResendOtp } from '../components/ResendOtp';
import { TermsText } from '../components/TermsText';
import { AUTH_COLORS, getKeyboardBehavior } from '../constants/auth';
import HeroSection from '../components/HeroSection';
import AuthenticationV4 from '../v4/AuthenticationV4';
import { isV4 } from '../../config/uiFlags';
import { useAuthenticationScreen } from '../../hooks/useAuthenticationScreen';

interface AuthenticationScreenProps {
  isEmbedded?: boolean;
}

const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ isEmbedded = false }) => {
  const screen = useAuthenticationScreen({ isEmbedded });
  if (isV4('login')) {
    return <AuthenticationV4 {...screen} isEmbedded={isEmbedded} />;
  }
  return <AuthenticationLegacy screen={screen} />;
};

function AuthenticationLegacy({ screen }: { screen: ReturnType<typeof useAuthenticationScreen> }): React.ReactElement {
  const {
    step,
    phone,
    setPhone,
    name,
    setName,
    otp,
    loading,
    error,
    successMessage,
    isFormValid,
    otpRefs,
    fadeAnim,
    timeLeft,
    isExpired,
    handlePhoneSubmit,
    handleNameSubmit,
    handleOtpSubmit,
    handleGoBackToPhone,
    handleOtpChange,
    handleOtpKeyPress,
    handleResendOtp,
    currentTitle,
    currentSubtitle,
  } = screen;


  const renderBody = () => {
    if (step === 'success') {
      return (
        <Animated.View style={[styles.successCard, { opacity: fadeAnim }]}>
          <Text style={styles.successTitle}>Authentication complete</Text>
          <Text style={styles.successSubtitle}>You’re all set to explore Tooka wellness experiences.</Text>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>
        {step === 'phone' && (
          <PhoneInput value={phone} onChangeText={setPhone} error={error} disabled={loading} />
        )}

        {step === 'name' && (
          <View>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleGoBackToPhone}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to phone input"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={18} color={AUTH_COLORS.primary} />
              <Text style={styles.backButtonText}>Change number</Text>
            </TouchableOpacity>
            <NameInput value={name} onChangeText={setName} error={error} disabled={loading} />
          </View>
        )}

        {step === 'otp' && (
          <View style={styles.otpContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleGoBackToPhone}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to phone input"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={18} color={AUTH_COLORS.primary} />
              <Text style={styles.backButtonText}>Change number</Text>
            </TouchableOpacity>

            <View style={styles.otpLabelRow}>
              <Text style={styles.otpLabel}>Enter 6-digit OTP</Text>
            </View>
            <View style={styles.otpBoxes}>
              {otp.map((digit, index) => (
                <OTPInput
                  key={index}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(index, value)}
                  onKeyPress={(event) => handleOtpKeyPress(index, event)}
                  onFocus={() => otpRefs.current[index]?.focus()}
                  inputRef={(ref) => {
                    otpRefs.current[index] = ref;
                  }}
                  autoFocus={index === 0}
                  disabled={loading}
                />
              ))}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <ResendOtp timeLeft={timeLeft} isExpired={isExpired} onResend={handleResendOtp} />
          </View>
        )}

        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <GradientButton
          label={step === 'phone' ? 'Continue' : step === 'name' ? 'Continue' : 'Verify & Log In'}
          onPress={step === 'phone' ? handlePhoneSubmit : step === 'name' ? handleNameSubmit : handleOtpSubmit}
          loading={loading}
          disabled={!isFormValid || loading}
        />

        {(step === 'phone' || step === 'otp') && <TermsText />}
      </Animated.View>
    );
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={getKeyboardBehavior()} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.flex}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <HeroSection />
              <AuthHeader title={currentTitle} subtitle={currentSubtitle} />
              <AuthCard>
                {renderBody()}
              </AuthCard>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 0,
    paddingBottom: 28,
  },
  formCard: {
    marginTop: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
    paddingRight: 10,
  },
  backButtonText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    color: AUTH_COLORS.primary,
    marginLeft: 6,
  },
  successCard: {
    marginTop: 12,
    paddingVertical: 24,
    alignItems: 'center',
  },
  otpContainer: {
    width: '100%',
    marginTop: 4,
  },
  otpLabelRow: {
    marginBottom: 10,
  },
  otpLabel: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 14,
    color: AUTH_COLORS.text,
  },
  otpBoxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  errorText: {
    marginTop: 8,
    color: AUTH_COLORS.error,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    textAlign: 'center',
  },
  successText: {
    marginTop: 10,
    color: AUTH_COLORS.primary,
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  successTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 22,
    color: AUTH_COLORS.text,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: AUTH_COLORS.secondaryText,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
});

export default AuthenticationScreen;
