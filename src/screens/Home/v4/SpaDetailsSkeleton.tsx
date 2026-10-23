import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Bone, PulseProvider } from '../../../components/ui';
import { colors, radii } from '../../../theme';

/** Three rows of slot-shaped blocks, used while a day's slots load. */
export function SlotBones() {
  return (
    <PulseProvider>
      <View style={styles.slotBones}>
        <Bone w={90} h={11} style={styles.grp} />
        <View style={styles.slots}>
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} h={56} r={radii.md} style={styles.slot} />
          ))}
        </View>
      </View>
    </PulseProvider>
  );
}

/** Rating, address, the Pick a time card and a section below it. */
export function SpaBodyBones({ withName = true }: { withName?: boolean }) {
  return (
    <PulseProvider>
      <View style={styles.intro}>
        {withName ? (
          <>
            <Bone w={92} h={28} r={radii.pill} style={styles.mb14} />
            <Bone w="75%" h={34} />
          </>
        ) : null}
        <Bone w={130} h={14} style={styles.mt10} />
        <Bone w="85%" h={14} style={styles.mt12} />
      </View>
      <View style={styles.timeCard}>
        <Bone w={120} h={20} />
        <Bone h={60} r={radii.lg} style={styles.mt14} />
        <View style={styles.slots}>
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} h={56} r={radii.md} style={styles.slot} />
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Bone w={140} h={20} />
        <Bone h={64} r={radii.md} style={styles.mt14} />
        <Bone h={64} r={radii.md} style={styles.mt10} />
      </View>
    </PulseProvider>
  );
}

/** Whole Spa Details page shape, shown until the spa loads. */
export default function SpaDetailsSkeleton({ heroHeight }: { heroHeight: number }) {
  return (
    <View style={styles.root} accessibilityLabel="Loading spa details">
      <PulseProvider>
        <Bone h={heroHeight} r={0} style={styles.hero} />
      </PulseProvider>
      <SpaBodyBones />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { borderBottomLeftRadius: radii.hero, borderBottomRightRadius: radii.hero },
  intro: { paddingTop: 22, paddingHorizontal: 20 },
  timeCard: {
    marginTop: 26,
    marginHorizontal: 12,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: radii.card,
    backgroundColor: colors.s1,
  },
  section: { marginTop: 28, paddingHorizontal: 20 },
  slotBones: { paddingTop: 6 },
  grp: { marginTop: 18 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slot: { width: '31.5%', flexGrow: 1, maxWidth: '32.5%' },
  mb14: { marginBottom: 14 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
});
