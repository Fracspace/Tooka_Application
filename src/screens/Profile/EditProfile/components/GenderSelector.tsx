import React from 'react';
import { Text, View } from 'react-native';

import GenderButton from './GenderButton';
import { GENDER_OPTIONS } from '../constants';
import { styles } from '../styles';
import type { Gender } from '../types';

type Props = {
  selectedGender: Gender | null;
  onSelectGender: (gender: Gender) => void;
};

function GenderSelector({ selectedGender, onSelectGender }: Props): React.ReactElement {
  return (
    <View style={styles.genderCard}>
      <Text style={styles.inputLabel}>GENDER</Text>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((option) => (
          <GenderButton
            key={option.id}
            option={option}
            selected={option.id === selectedGender}
            onPress={onSelectGender}
          />
        ))}
      </View>
    </View>
  );
}

export default React.memo(GenderSelector);
