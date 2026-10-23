import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Bone, PulseProvider, Screen, Text, useTabBarSpace } from '../../../components/ui';
import { colors, radii, shadows } from '../../../theme';

function UpcomingBones() {
  return (
    <View style={styles.up}>
      <Bone h={150} r={0} />
      <View style={styles.upBody}>
        <Bone w={110} h={22} r={radii.pill} />
        <Bone w="60%" h={20} style={styles.mt12} />
        <Bone w="45%" h={12} style={styles.mt8} />
        <View style={styles.when}>
          <Bone h={52} r={radii.md} style={styles.flex} />
          <Bone h={52} r={radii.md} style={styles.flex} />
        </View>
        <View style={styles.actions}>
          <Bone h={46} r={15} style={styles.flex} />
          <Bone h={46} r={15} style={styles.flex} />
        </View>
      </View>
    </View>
  );
}

function RowBones() {
  return (
    <View style={styles.row}>
      <Bone w={72} h={84} r={radii.sm} />
      <View style={styles.rowBody}>
        <Bone w={90} h={20} r={radii.pill} />
        <Bone w="70%" h={16} style={styles.mt12} />
        <Bone w="50%" h={12} style={styles.mt8} />
      </View>
    </View>
  );
}

// Spacing mirrors AllBookingV4's styles so nothing jumps when the content arrives.
export function BookingsSkeleton() {
  const bottomSpace = useTabBarSpace();
  return (
    <Screen haze>
      <PulseProvider>
        <ScrollView
          scrollEnabled={false}
          contentContainerStyle={[styles.list, { paddingBottom: bottomSpace }]}>
          <View style={styles.listHeader}>
            <View style={styles.header}>
              <Text variant="h1" style={styles.title}>
                Bookings
              </Text>
              <Text variant="bodySm" color={colors.muted} style={styles.subtitle}>
                Your visits, past and upcoming
              </Text>
            </View>
            <View style={styles.seg}>
              <Bone h={44} r={radii.sm} style={styles.flex} />
              <Bone h={44} r={radii.sm} style={styles.segGhost} />
              <Bone h={44} r={radii.sm} style={styles.segGhost} />
            </View>
          </View>
          <UpcomingBones />
          <RowBones />
          <RowBones />
        </ScrollView>
      </PulseProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  list: { paddingHorizontal: 16, gap: 12 },
  listHeader: { marginBottom: 6 },
  header: { paddingTop: 60, paddingHorizontal: 4 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  subtitle: { marginTop: 4, fontSize: 14 },
  seg: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  segGhost: { flex: 1, opacity: 0.5 },
  up: { borderRadius: radii.poster, overflow: 'hidden', backgroundColor: colors.s1, boxShadow: shadows.ring },
  upBody: { padding: 16 },
  when: { flexDirection: 'row', gap: 1, marginTop: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  rowBody: { flex: 1, paddingTop: 4 },
});
