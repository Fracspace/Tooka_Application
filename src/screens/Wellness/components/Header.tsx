import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, styles } from '../styles';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = React.memo(({ title = 'Wellness Insight' }) => {
  const navigation = useNavigation();

  return (
    <View style={[styles.headerContainer, { backgroundColor: COLORS.primary }]}>
      <View style={StyleSheet.absoluteFill}>
        {/* Decorative circles */}
        <View style={{
          position: 'absolute',
          top: -20,
          left: -20,
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: 'rgba(255, 255, 255, 0.1)'
        }} />
        <View style={{
          position: 'absolute',
          bottom: -30,
          right: -30,
          width: 150,
          height: 550,
          borderRadius: 75,
          backgroundColor: 'rgba(255, 255, 255, 0.1)'
        }} />
      </View>
      <View style={{ position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
});
