import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';

interface HeroSectionProps {
  imageUri?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  imageUri = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80',
}) => {
  const { width, height } = useWindowDimensions();
  const heroHeight = height * 0.35;
  const curveHeight = 50; // Depth of the curve

  // SVG path for clipping the image:
  // Starts top-left (0,0) -> bottom-left (0, H - curveHeight)
  // Curves smoothly to bottom-right (W, H - curveHeight) via quadratic bezier curve control point in the middle
  // Goes to top-right (W,0) -> closes path.
  const clipPathD = `
    M 0 0 
    L 0 ${heroHeight - curveHeight} 
    Q ${width / 2} ${heroHeight + curveHeight} ${width} ${heroHeight - curveHeight} 
    L ${width} 0 
    Z
  `;

  return (
    <View style={[styles.container, { width, height: heroHeight }]}>
      <Svg width={width} height={heroHeight + curveHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id="heroClip">
            <Path d={clipPathD} />
          </ClipPath>
        </Defs>
        <Image
          href={{ uri: imageUri }}
          width={width}
          height={heroHeight}
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#heroClip)"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
