import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { COLORS } from '../constants';
import { styles } from '../styles';
import type { ProfileImage } from '../../../../types/profileImage';
import { resolveImageUri } from '../../../../types/profileImage';

type Props = {
  photoUri: ProfileImage;
  onChoosePhoto: () => void;
  /** Shows progress and disables the button; taps used to be silently ignored. */
  uploading?: boolean;
};

function ProfilePhotoCard({ photoUri, onChoosePhoto, uploading = false }: Props): React.ReactElement {
  const opacity = useRef(new Animated.Value(0)).current;

  // Safely compute a plain string URI — never pass an object to <Image source>.
  // resolveImageUri handles: null → null, string → string, object → object.uri
  const resolvedUri = resolveImageUri(photoUri);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [opacity, resolvedUri]);

  return (
    <View style={styles.photoCard}>
      <Animated.View style={[styles.uploadCircle, { opacity }]}>
        {uploading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : resolvedUri ? (
          <Image source={{ uri: resolvedUri }} style={styles.selectedPhoto} resizeMode="cover" />
        ) : (
          <Ionicons name="cloud-upload-outline" size={25} color={COLORS.primary} />
        )}
      </Animated.View>
      <Text style={styles.photoTitle}>Add Profile Photo</Text>
      <Text style={styles.photoSubtitle}>Tap to upload your photo</Text>
      <Pressable
        onPress={onChoosePhoto}
        disabled={uploading}
        style={({ pressed }) => [
          styles.chooseButton,
          (pressed || uploading) && { opacity: 0.72 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Choose profile photo"
        accessibilityState={{ disabled: uploading, busy: uploading }}
      >
        <Text style={styles.chooseButtonText}>{uploading ? 'Uploading…' : 'Choose Photo'}</Text>
      </Pressable>
    </View>
  );
}

export default React.memo(ProfilePhotoCard);
