import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { COLORS, DATE_FORMATTER } from '../constants';
import { styles } from '../styles';

type Props = {
  value: Date | null;
  onPress: () => void;
  displayValue?: string;
};

function DatePickerInput({ value, onPress, displayValue }: Props): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dateButton, pressed && { opacity: 0.72 }]}
      accessibilityRole="button"
      accessibilityLabel="Select date of birth"
    >
      <Text style={styles.inputLabel}>DATE OF BIRTH</Text>
      <View style={styles.dateContentRow}>
        <Text style={styles.dateValue}>
          {displayValue ?? (value ? DATE_FORMATTER.format(value) : 'Select date of birth')}
        </Text>
        <Ionicons name="calendar-outline" size={25} color={COLORS.heading} />
      </View>
    </Pressable>
  );
}

export default React.memo(DatePickerInput);
