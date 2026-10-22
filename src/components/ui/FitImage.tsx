import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = { uri: string; style?: StyleProp<ViewStyle> };

/**
 * Shows the whole photo inside any frame. Spa photos are mostly landscape and
 * our cards are tall, so `cover` cut off their sides; the photo now fits
 * inside, over a blurred, dimmed copy of itself that fills the rest.
 */
export function FitImage({ uri, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={24} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  dim: { backgroundColor: 'rgba(18,16,14,0.35)' },
});
