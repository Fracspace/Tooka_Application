import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Bone, Haze, PulseProvider, Screen, Text } from '../../../components/ui';
import { colors, fonts, radii, shadows } from '../../../theme';

/**
 * The Profile page's shape while it loads: the account card, wellness banner,
 * help cards and the first list. Drawn on the dark page so the tab never
 * flashes light before the content arrives.
 */
export function ProfileSkeleton() {
  return (
    <Screen>
      <Haze height={300} />
      <PulseProvider>
        <View style={styles.page} accessibilityLabel="Loading your profile" accessible>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Bone w={44} h={44} r={22} />
          </View>

          <View style={styles.card}>
            <View style={styles.account}>
              <Bone w={84} h={84} r={42} />
              <View style={styles.accountText}>
                <Bone w="70%" h={20} />
                <Bone w="50%" h={13} style={styles.mt8} />
                <Bone w="60%" h={13} style={styles.mt6} />
              </View>
            </View>
            <Bone h={40} r={radii.sm} style={styles.mt14} />
            <View style={styles.stats}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.stat}>
                  <Bone w={28} h={18} />
                  <Bone w={52} h={11} style={styles.mt6} />
                </View>
              ))}
            </View>
          </View>

          <Bone h={84} r={22} style={styles.mt12} />

          <View style={styles.helpRow}>
            <Bone h={66} r={radii.xl} style={styles.flex} />
            <Bone h={66} r={radii.xl} style={styles.flex} />
          </View>

          <Bone w={70} h={11} style={styles.group} />
          <View style={styles.list}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.item, i > 0 && styles.itemDivider]}>
                <Bone w={38} h={38} r={12} />
                <View style={styles.flex}>
                  <Bone w="55%" h={15} />
                  <Bone w="75%" h={12} style={styles.mt6} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </PulseProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingTop: 56, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  card: { marginTop: 18, padding: 16, borderRadius: radii.card, backgroundColor: colors.s1, boxShadow: shadows.card },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accountText: { flex: 1 },
  stats: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.edge },
  stat: { flex: 1, alignItems: 'center' },
  helpRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  group: { marginTop: 22, marginBottom: 8, marginHorizontal: 4 },
  list: { borderRadius: 22, backgroundColor: colors.s1, boxShadow: shadows.ring, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 60 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.edge },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
});
