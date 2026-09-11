import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { COLORS } from '../constants';
import { styles } from '../styles';

type Props = {
  countryCode: string;
  phoneNumber: string;
  onChangePhoneNumber?: (value: string) => void;
  onPressCountryCode?: () => void;
  editable?: boolean;
};

function PhoneInput({
  countryCode,
  phoneNumber,
  onChangePhoneNumber,
  onPressCountryCode,
  editable = false,
}: Props): React.ReactElement {
  return (
    <View style={[styles.inputShell, !editable && styles.inputShellDisabled]}>
      <Text style={styles.inputLabel}>PHONE NUMBER</Text>
      <View style={styles.inputRow}>
        <Pressable
          onPress={editable ? onPressCountryCode : undefined}
          disabled={!editable}
          style={styles.phoneCode}
          accessibilityRole="button"
          accessibilityLabel="Select country code"
        >
          <Text style={[styles.phoneCodeText, !editable && { color: '#888888' }]}>{countryCode}</Text>
          {/* <Ionicons name="chevron-down" size={20} color={COLORS.placeholder} /> */}
        </Pressable>
        <View style={styles.phoneDivider} />
        <TextInput
          value={phoneNumber}
          keyboardType="phone-pad"
          maxLength={10}
          onChangeText={onChangePhoneNumber}
          editable={editable}
          style={[styles.inputText, !editable && { color: '#888888' }]}
          selectionColor={COLORS.primary}
        />
      </View>
    </View>
  );
}

export default React.memo(PhoneInput);
