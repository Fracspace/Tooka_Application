import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { AuthHeader } from '../components/AuthHeader';
import { AuthCard } from '../components/AuthCard';
import { GradientButton } from '../components/GradientButton';
import { NameInput } from '../components/NameInput';
import { OTPInput } from '../components/OTPInput';
import { PhoneInput } from '../components/PhoneInput';
import { ResendOtp } from '../components/ResendOtp';
import { TermsText } from '../components/TermsText';
import { AUTH_COLORS, AUTH_CONFIG, AUTH_TEXT, getKeyboardBehavior } from '../constants/auth';
import { useKeyboard } from '../hooks/useKeyboard';
import { useOtpTimer } from '../hooks/useOtpTimer';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import AuthApi from '../../api/AuthApi';
import ProfileApi from '../../api/ProfileApi';
import HeroSection from '../components/HeroSection';

type AuthStep = 'phone' | 'name' | 'otp' | 'success';

interface AuthenticationScreenProps {
  isEmbedded?: boolean;
}

const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ isEmbedded = false }) => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { login, register } = useAuth();
  const { setProfile } = useProfile();

  // Screen state
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(AUTH_CONFIG.otpLength).fill(''));
  const [otpDigits, setOtpDigits] = useState('');

  // Status state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  // References
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const abortControllerRef = useRef<AbortController | null>(null);

  // OTP Resend timer
  const { timeLeft, reset, isExpired } = useOtpTimer(AUTH_CONFIG.resendSeconds);

  const spaId = isEmbedded ? undefined : route?.params?.spaId;
  const serviceId = isEmbedded ? undefined : route?.params?.serviceId;
  const serviceName = isEmbedded ? undefined : route?.params?.serviceName;
  const openBooking = isEmbedded ? undefined : route?.params?.openBooking;
  const selectedDateId = isEmbedded ? undefined : route?.params?.selectedDateId;
  const selectedSlotId = isEmbedded ? undefined : route?.params?.selectedSlotId;
  const fromScreen = isEmbedded ? undefined : route?.params?.fromScreen;

  // Clean up any pending requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const animateTransition = useCallback(() => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim]);

  // Handle step updates with transition animation
  const transitionToStep = useCallback((nextStep: AuthStep) => {
    animateTransition();
    setStep(nextStep);
  }, [animateTransition]);

  // Check if inputs are valid for current step
  const isFormValid = useMemo(() => {
    if (step === 'phone') {
      return phone.length === AUTH_CONFIG.phoneLength;
    }
    if (step === 'name') {
      const trimmedName = name.trim();
      return trimmedName.length >= AUTH_CONFIG.minNameLength && trimmedName.length <= 50;
    }
    if (step === 'otp') {
      return otpDigits.length === AUTH_CONFIG.otpLength;
    }
    return false;
  }, [step, phone, name, otpDigits]);

  // Cancel any ongoing request before launching a new one
  const getAbortSignal = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  };

  // Handle generic error responses
  const handleApiError = (err: any) => {
    let friendlyMessage = 'Something went wrong. Please try again.';
    if (err && err.message) {
      if (err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('offline')) {
        friendlyMessage = 'You are offline. Please check your internet connection.';
      } else if (err.message.toLowerCase().includes('timeout')) {
        friendlyMessage = 'Request timed out. Please try again.';
      } else if (err.message.toLowerCase().includes('canceled') || err.message.toLowerCase().includes('cancelled')) {
        return; // Ignore canceled request
      } else {
        friendlyMessage = err.message;
      }
    } else if (typeof err === 'string') {
      friendlyMessage = err;
    }

    setError(friendlyMessage);
    Toast.show({
      type: 'error',
      text1: 'Authentication Error',
      text2: friendlyMessage,
    });
  };

  // Step 1: Send OTP
  const handlePhoneSubmit = useCallback(async () => {
    if (phone.length !== AUTH_CONFIG.phoneLength || loading) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    const formattedPhone = `+91${phone}`;
    const signal = getAbortSignal();

    try {
      const response = await AuthApi.sendOtp(formattedPhone, signal);
      if (response.success) {
        setIsRegistered(response.data.isRegistered);
        setSuccessMessage('OTP sent successfully');
        reset(); // reset resend timer

        if (response.data.isRegistered) {
          transitionToStep('otp');
        } else {
          transitionToStep('name');
        }
      } else {
        setError('Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, [phone, loading, reset, transitionToStep]);

  // Step 1.5: Name submit for new users
  const handleNameSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (trimmedName.length < AUTH_CONFIG.minNameLength || trimmedName.length > 50) {
      setError('Name must be between 2 and 50 characters');
      return;
    }
    setError('');
    transitionToStep('otp');
  }, [name, transitionToStep]);

  // Step 2: Verify OTP and Register/Login
  const handleOtpSubmit = useCallback(async () => {
    if (otpDigits.length !== AUTH_CONFIG.otpLength || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    const formattedPhone = `+91${phone}`;
    const signal = getAbortSignal();

    try {
      let loggedInUser;
      if (isRegistered) {
        // Existing user flow
        loggedInUser = await login(formattedPhone, otpDigits);
      } else {
        // New user flow
        loggedInUser = await register(formattedPhone, otpDigits, name.trim());
      }

      // Fetch user profile immediately after OTP verification so avatar and profile data are available everywhere
      try {
        const userProfile = await ProfileApi.getProfile();
        if (userProfile) {
          setProfile(userProfile);
        }
      } catch (profileErr) {
        if (__DEV__) {
          console.warn('[AuthenticationScreen] Profile fetch error:', profileErr);
        }
      }

      setSuccessMessage('Successfully verified!');
      transitionToStep('success');

      // Navigate back or to spa details
      setTimeout(() => {
        if (spaId) {
          navigation.reset({
            index: 1,
            routes: [
              {
                name: 'BottomNavigation',
                params: fromScreen === 'Explore' ? { screen: 'Explore' } : { screen: 'Home' },
              },
              {
                name: 'SpaDetails',
                params: {
                  spaId,
                  serviceId,
                  serviceName,
                  openBooking: true,
                  selectedDateId,
                  selectedSlotId,
                  fromLogin: true,
                  fromScreen: fromScreen ?? 'Home',
                },
              },
            ],
          });
        } else if (!isEmbedded) {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else if (fromScreen === 'Explore') {
            navigation.navigate('BottomNavigation', { screen: 'Explore' });
          } else {
            navigation.navigate('BottomNavigation');
          }
        }
      }, 500);

    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, [phone, otpDigits, isRegistered, name, loading, spaId, serviceId, serviceName, openBooking, selectedDateId, selectedSlotId, fromScreen, isEmbedded, login, register, navigation, setProfile]);

  const handleGoBackToPhone = useCallback(() => {
    setError('');
    setSuccessMessage('');
    setOtp(Array(AUTH_CONFIG.otpLength).fill(''));
    setOtpDigits('');
    transitionToStep('phone');
  }, [transitionToStep]);

  // OTP inputs callbacks
  const handleOtpChange = useCallback((index: number, value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');

    // Case 1: Empty input (user deleted or backspaced)
    if (!sanitized) {
      setOtp((prev) => {
        const nextOtp = [...prev];
        nextOtp[index] = '';
        setOtpDigits(nextOtp.join(''));
        return nextOtp;
      });
      return;
    }

    // Case 2: Full OTP autofill or paste (>= 6 digits)
    if (sanitized.length >= AUTH_CONFIG.otpLength) {
      const digits = sanitized.slice(0, AUTH_CONFIG.otpLength).split('');
      setOtp(digits);
      setOtpDigits(digits.join(''));
      otpRefs.current[AUTH_CONFIG.otpLength - 1]?.focus();
      return;
    }

    // Case 3: Overwriting existing digit or typing over (length > 1)
    if (sanitized.length > 1) {
      const charToUse = sanitized.slice(-1);
      setOtp((prev) => {
        const nextOtp = [...prev];
        nextOtp[index] = charToUse;
        setOtpDigits(nextOtp.join(''));
        return nextOtp;
      });
      if (index < AUTH_CONFIG.otpLength - 1) {
        otpRefs.current[index + 1]?.focus();
      }
      return;
    }

    // Case 4: Single digit normal typing
    setOtp((prev) => {
      const nextOtp = [...prev];
      nextOtp[index] = sanitized;
      setOtpDigits(nextOtp.join(''));
      return nextOtp;
    });
    if (index < AUTH_CONFIG.otpLength - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleOtpKeyPress = useCallback((index: number, event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key === 'Backspace') {
      setOtp((prev) => {
        const nextOtp = [...prev];
        if (nextOtp[index] !== '') {
          nextOtp[index] = '';
          setOtpDigits(nextOtp.join(''));
          return nextOtp;
        }

        if (index > 0) {
          nextOtp[index - 1] = '';
          setOtpDigits(nextOtp.join(''));
          otpRefs.current[index - 1]?.focus();
        }
        return nextOtp;
      });
    }
  }, []);

  const handleResendOtp = useCallback(async () => {
    if (loading) return;
    setOtp(Array(AUTH_CONFIG.otpLength).fill(''));
    setOtpDigits('');
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const formattedPhone = `+91${phone}`;
    const signal = getAbortSignal();

    try {
      const response = await AuthApi.sendOtp(formattedPhone, signal);
      if (response.success) {
        setSuccessMessage('OTP resent successfully');
        reset();
      }
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, [phone, loading, reset]);

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

  const currentTitle = useMemo(() => {
    if (step === 'phone') return AUTH_TEXT.title;
    if (step === 'name') return AUTH_TEXT.nameTitle;
    if (step === 'otp') return AUTH_TEXT.otpTitle;
    return 'You’re all set';
  }, [step]);

  const currentSubtitle = useMemo(() => {
    if (step === 'phone') return AUTH_TEXT.subtitle;
    if (step === 'name') return AUTH_TEXT.nameSubtitle;
    if (step === 'otp') return `${AUTH_TEXT.otpSubtitle} +91 ${phone}`;
    return 'Authentication complete';
  }, [step, phone]);

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
};

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
