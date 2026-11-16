import React, { useEffect } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, useReduceMotion } from '../../theme';

const IMAGE_BASE = 'https://d2f15ematxpwp4.cloudfront.net/appImages/';
const lm = (n: number) => ({ uri: `${IMAGE_BASE}LM${n}.png` });

type Column = { duration: number; reverse: boolean; tiles: Array<[number, number]> };

/** Image number and tile height (pt), as on the Login6 / Otp6 design. */
const COLUMNS: Column[] = [
  { duration: 56000, reverse: false, tiles: [[1, 240], [2, 210], [3, 180], [4, 250]] },
  { duration: 64000, reverse: true, tiles: [[5, 220], [6, 190], [7, 260], [8, 210]] },
  { duration: 72000, reverse: false, tiles: [[9, 270], [10, 210], [11, 240], [12, 190], [13, 220]] },
];

/** Width the design was drawn at; wider screens (iPad) scale the mosaic up. */
const DESIGN_WIDTH = 390;
const MOSAIC_WIDTH = 560;
const MOSAIC_HEIGHT = 760;

/**
 * Three tilted columns of spa photos drifting up and down behind the login
 * card, faded into the page colour towards the bottom.
 */
export function LoginMosaic() {
  const { width, height } = useWindowDimensions();
  const scale = Math.max(1, width / DESIGN_WIDTH);
  // The fade covers the whole screen and reaches the page colour well before
  // the columns end, so their bottom edges never show on tall screens.
  const at = (px: number) => `${Math.min(100, ((px * scale) / height) * 100).toFixed(1)}%`;
  const shade = `linear-gradient(rgba(18,16,14,0.7) 0%, rgba(18,16,14,0.15) ${at(100)}, rgba(18,16,14,0.2) ${at(260)}, #12100E ${at(520)})`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.mosaic,
          { left: (width - MOSAIC_WIDTH) / 2, transform: [{ scale }, { rotate: '-13deg' }] },
        ]}>
        {COLUMNS.map((column, i) => (
          <MosaicColumn key={i} column={column} />
        ))}
      </View>
      <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: shade }]} />
    </View>
  );
}

function MosaicColumn({ column }: { column: Column }) {
  const reduceMotion = useReduceMotion();
  const loop = column.tiles.reduce((sum, [, h]) => sum + h, 0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: column.duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [column.duration, progress, reduceMotion]);

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateY: -(column.reverse ? 1 - progress.value : progress.value) * loop }],
  }));

  // The tiles twice, so the loop restarts on an identical frame.
  const tiles = column.tiles.concat(column.tiles);
  return (
    <View style={styles.column}>
      <Animated.View style={drift}>
        {tiles.map(([n, h], i) => (
          <View key={i} style={[styles.tile, { height: h }]}>
            <Image source={lm(n)} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.dim} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mosaic: {
    position: 'absolute',
    top: -110,
    width: MOSAIC_WIDTH,
    height: MOSAIC_HEIGHT,
    flexDirection: 'row',
    gap: 14,
    transformOrigin: '50% 40%',
  },
  column: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edgeHi,
  },
  tile: { overflow: 'hidden', backgroundColor: colors.s1 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,16,14,0.18)' },
});
