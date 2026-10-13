import React, { useEffect } from 'react';
import { ImageSourcePropType, Animated } from 'react-native';
import { styles } from '../styles';

interface HeroImageProps {
  source: ImageSourcePropType;
}

export const HeroImage: React.FC<HeroImageProps> = React.memo(({ source }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.Image 
      source={source} 
      style={[styles.heroImage, { opacity }]} 
      resizeMode="cover"
    />
  );
});
