import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bone, PulseProvider, Screen } from '../../../components/ui';
import { colors, radii } from '../../../theme';
import { SIDE_SCALE, spotlightSizes } from './spotlightLayout';

function SectionBone() {
  return (
    <View style={styles.secRow}>
      <View style={styles.secLine} />
      <Bone w={120} h={12} r={6} />
      <View style={styles.secLine} />
    </View>
  );
}

/** Middle card, the two side cards, the caption and the dots. */
function SpotlightBones() {
  const { width } = useWindowDimensions();
  const { cardW, cardH, interval } = spotlightSizes(width);
  const sideW = cardW * SIDE_SCALE;
  const sideH = cardH * SIDE_SCALE;
  const sideTop = 8 + (cardH - sideH) / 2;
  return (
    <View>
      <View style={[styles.flow, { height: cardH + 16 }]}>
        <Bone w={sideW} h={sideH} r={radii.poster} style={{ ...styles.abs, top: sideTop, left: width / 2 - interval - sideW / 2 }} />
        <Bone w={cardW} h={cardH} r={radii.poster} style={{ ...styles.abs, left: (width - cardW) / 2 }} />
        <Bone w={sideW} h={sideH} r={radii.poster} style={{ ...styles.abs, top: sideTop, left: width / 2 + interval - sideW / 2 }} />
      </View>
      <View style={styles.caption}>
        <Bone w={160} h={18} r={9} />
        <Bone w={100} h={12} r={6} />
      </View>
      <View style={styles.dots}>
        <Bone w={20} h={6} r={3} />
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} w={6} h={6} r={3} />
        ))}
      </View>
    </View>
  );
}

/** Shown in the spotlight area while a search loads. */
export function SpotlightSkeleton() {
  return (
    <PulseProvider>
      <SpotlightBones />
    </PulseProvider>
  );
}

/** The whole v4 Home in grey blocks, shown until the first spas load. */
export function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <Screen haze>
      <PulseProvider>
        <ScrollView
          scrollEnabled={false}
          contentContainerStyle={{ paddingTop: insets.top + 12 }}
          accessibilityLabel="Loading spas"
          accessible>
          <View style={styles.gutter}>
            <View style={styles.headRow}>
              <Bone w={170} h={44} r={radii.pill} />
              <View style={styles.flex} />
              <Bone w={44} h={44} r={22} />
              <Bone w={44} h={44} r={22} />
            </View>
            <Bone w="85%" h={26} r={8} style={styles.h1} />
            <Bone w="55%" h={26} r={8} style={styles.h1Line2} />
            <View style={styles.types}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={styles.typeCell}>
                  <Bone h={112} r={radii.lg} />
                </View>
              ))}
              <Bone h={72} r={radii.lg} />
            </View>
          </View>

          <View style={styles.section}>
            <SectionBone />
            <View style={styles.chips}>
              <Bone w={130} h={36} r={radii.pill} />
              <Bone w={100} h={36} r={radii.pill} />
              <Bone w={90} h={36} r={radii.pill} />
            </View>
            <View style={styles.stage}>
              <SpotlightBones />
            </View>
          </View>

          <View style={styles.section}>
            <SectionBone />
            <View style={styles.mapPad}>
              <Bone h={204} r={radii.card} />
            </View>
          </View>
        </ScrollView>
      </PulseProvider>
    </Screen>
  );
}

// Spacing mirrors HomeV4's styles so nothing jumps when the content arrives.
const styles = StyleSheet.create({
  abs: { position: 'absolute', top: 8 },
  flex: { flex: 1 },
  gutter: { paddingHorizontal: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { marginTop: 26 },
  h1Line2: { marginTop: 8 },
  types: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCell: { width: '30%', flexGrow: 1 },
  section: { marginTop: 42 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  secLine: { flex: 1, height: 1, backgroundColor: colors.edge },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16 },
  stage: { marginTop: 16 },
  flow: { justifyContent: 'center' },
  caption: { marginTop: 18, alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  mapPad: { paddingTop: 18, paddingHorizontal: 16 },
});
