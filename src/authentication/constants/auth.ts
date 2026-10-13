import { Platform } from 'react-native';

export const AUTH_COLORS = {
  primary: '#FFB02E',
  background: '#FFF7EE',
  text: '#1F1F1F',
  secondaryText: '#8f8f8f',
  border: '#E7E2DA',
  white: '#FFFFFF',
  error: '#D64545',
};

export const AUTH_CONFIG = {
  phoneLength: 10,
  otpLength: 6,
  resendSeconds: 30,
  minNameLength: 2,
};

export const AUTH_TEXT = {
  title: 'Welcome back',
  subtitle: 'Login to continue your wellness journey',
  otpTitle: 'Verify your number',
  otpSubtitle: 'Enter the 6-digit code sent to',
  nameTitle: "What's your name?",
  nameSubtitle: 'Help us personalize your experience.',
};

export const getKeyboardBehavior = () => (Platform.OS === 'ios' ? 'padding' : 'height');
