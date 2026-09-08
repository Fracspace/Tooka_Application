import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { styles } from '../styles';
import Icon from 'react-native-vector-icons/Ionicons';
// import type { RootStackParamList } from '../../../navigation/types'; // Update this path
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function Header(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
      {/* <View style={{}}/> */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => { navigation.goBack() }}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
        hitSlop={40}
      >
        <Icon name="chevron-back" size={22} color={'#FFF'} />
      </Pressable>
      <View style={styles.headerCircleLarge} />
      <View style={styles.headerCircleSoft} />
      <View style={styles.headerDotLeft} />
      <View style={styles.headerDotRight} />
      {/* <View style={styles.headerDotDark} /> */}
      <Text style={styles.headerTitle}>Complete Your Profile</Text>
      <Text style={styles.headerSubtitle}>Tell us a little more about you.</Text>
    </View>
  );
}

export default React.memo(Header);
