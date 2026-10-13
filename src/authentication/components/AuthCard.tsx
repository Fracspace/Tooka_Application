import React from 'react';
import { StyleSheet, View } from 'react-native';

interface AuthCardProps {
  children: React.ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = React.memo(({ children }) => {
  return <View style={styles.card}>{children}</View>;
});

const styles = StyleSheet.create({
  card: {
    // backgroundColor: AUTH_COLORS.white,
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 16,
    // shadowColor: '#000',
    // shadowOpacity: 0.08,
    // shadowRadius: 18,
    // shadowOffset: { width: 0, height: 10 },
    // elevation: 6,
    // width: '70%',
  },
});
