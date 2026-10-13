import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import Svg, {
  Defs,
  ClipPath,
  Path,
  Image as SvgImage,
} from 'react-native-svg';

const HERO =
  'https://d2f15ematxpwp4.cloudfront.net/appImages/Rectangle+34625618.png';

export default function HeroSection() {
  const { width, height } = useWindowDimensions();

  const heroHeight =Math.min(height * 0.32, 340);
    // Math.min(height * 0.34, 340);

  return (
    <View style={styles.container}>
      <Svg
        width={width}
        height={heroHeight}
      >
        <Defs>

          <ClipPath id="clip">

            <Path
              d={`
                M0 0
                H${width}
                V${heroHeight - 70}

                C
                ${width * 0.90} ${heroHeight + 100}
                ${width * 0.62} ${heroHeight + 60}
                ${width * 0.90} ${heroHeight + 20}

                C
                ${width * 0.38} ${heroHeight + 60}
                ${width * 0.38} ${heroHeight + 100}
                0 ${heroHeight - 70}

                Z
              `}
            />

          </ClipPath>

        </Defs>

        <SvgImage
          href={{ uri: HERO }}
          width={width}
          height={heroHeight}
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#clip)"
        />

    </Svg>

      {/* <Image
        source={{ uri: LOGO }}
        resizeMode="contain"
        style={styles.logo}
      /> */}
    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    backgroundColor: '#FFF8EF',
    alignItems: 'center',
  },

  logo: {
    width: 230,
    height: 88,
    marginTop: -18,
  },
});