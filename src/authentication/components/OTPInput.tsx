import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { AUTH_COLORS, AUTH_CONFIG } from '../constants/auth';

interface OTPInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onKeyPress: (event: any) => void;
  onFocus: () => void;
  inputRef?: React.Ref<TextInput>;
  autoFocus?: boolean;
  disabled?: boolean;
  maxLength?: number;
}

export const OTPInput: React.FC<OTPInputProps> = React.memo((props) => {
  const inputRef = useRef<TextInput>(null);
  const resolvedRef = (props.inputRef as any) ?? inputRef;

  return (
    <TextInput
      ref={resolvedRef}
      value={props.value}
      onChangeText={props.onChangeText}
      onKeyPress={props.onKeyPress}
      onFocus={props.onFocus}
      keyboardType="number-pad"
      maxLength={props.maxLength ?? (AUTH_CONFIG.otpLength * 2)}
      selectTextOnFocus
      autoFocus={props.autoFocus}
      style={styles.input}
      textContentType="oneTimeCode"
      autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
      importantForAutofill={Platform.OS === 'android' ? 'yes' : undefined}
      selectionColor={AUTH_COLORS.primary}
      accessibilityLabel="OTP digit"
      editable={!props.disabled}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    width: 44,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
    textAlign: 'center',
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: AUTH_COLORS.text,
    backgroundColor: AUTH_COLORS.white,
  },
});
