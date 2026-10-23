import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface StarRatingProps {
  value: number;
  size?: number;
  gap?: number;
  color?: string;
  /** Omit for a read-only row. */
  onChange?: (value: number) => void;
}

const STARS = [1, 2, 3, 4, 5];

const StarRating: React.FC<StarRatingProps> = React.memo(
  ({ value, size = 16, gap = 2, color = '#FFB02E', onChange }) => (
    <View style={[styles.row, { gap }]}>
      {STARS.map(star => {
        const icon = (
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={color}
          />
        );

        return onChange ? (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}>
            {icon}
          </Pressable>
        ) : (
          <View key={star}>{icon}</View>
        );
      })}
    </View>
  ),
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default StarRating;
