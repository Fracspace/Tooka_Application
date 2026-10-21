/**
 * Development only: every v4 base piece on one screen, for checking them
 * against the design canvas. Turn on with SHOW_V4_GALLERY in src/config/uiFlags.
 */
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, rise, useReduceMotion } from '../../theme';
import BookingSummarySheetV4 from '../../screens/Booking/components/v4/BookingSummarySheetV4';
import BookingResultV4 from '../../screens/Booking/v4/BookingResultV4';
import {
  BackButton,
  Button,
  Card,
  Chip,
  Icon,
  RoundButton,
  Screen,
  TabBar,
  Text,
  useTabBarSpace,
  type TabBarItem,
} from './index';

const TABS: TabBarItem[] = [
  { key: 'Home', label: 'Home', icon: 'home' },
  { key: 'Explore', label: 'Explore', icon: 'explore' },
  { key: 'Bookings', label: 'Bookings', icon: 'bookings' },
  { key: 'Profile', label: 'Profile', icon: 'profile' },
];

const FILTERS = ['Recommended', 'Price: low to high', 'Open now', 'Couples'];

const SWATCHES: Array<[string, string]> = [
  ['bg', colors.bg],
  ['s1', colors.s1],
  ['s2', colors.s2],
  ['s3', colors.s3],
  ['text', colors.text],
  ['muted', colors.muted],
  ['subtle', colors.subtle],
  ['brand', colors.brand],
  ['brand2', colors.brand2],
  ['brandTint', colors.brandTint],
  ['sage', colors.sage],
];

export default function Gallery() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const reduceMotion = useReduceMotion();
  const [tab, setTab] = useState('Home');
  const [filter, setFilter] = useState(0);
  const [run, setRun] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);

  return (
    <Screen haze>
      <Modal visible={result !== null} animationType="slide" onRequestClose={() => setResult(null)}>
        {result ? (
          <BookingResultV4
            params={{
              spaName: 'The lemmon spa',
              spaImage: 'https://d2f15ematxpwp4.cloudfront.net/appImages/Spacover.jpg',
              appointmentDate: new Date().toISOString().slice(0, 10),
              appointmentTime: '06:00 PM',
              serviceDurationMinutes: 60,
              amount: 199,
            }}
            type={result}
            isProcessing={false}
            message={undefined}
            retrying={false}
            bookingCode="SPA6896181244"
            dateTime="Today | 06:00 PM"
            paymentCompletedAt={undefined}
            showPaymentDetails={false}
            handleCopy={() => undefined}
            handlePrimary={() => setResult(null)}
            handleSecondary={() => setResult(null)}
          />
        ) : null}
      </Modal>
      <BookingSummarySheetV4
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={() => setSheetOpen(false)}
        spaName="The lemmon spa"
        location="C.G. Road, Ahmedabad"
        dateLabel="Today, 21 Oct"
        timeLabel="06:00 PM"
        slotDurationMinutes={60}
        spaImage="https://d2f15ematxpwp4.cloudfront.net/appImages/Spacover.jpg"
        bookingFeeText="₹199"
        bookingFeeNote="Refundable as per the spa's terms"
      />
      <ScrollView
        key={run}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: tabSpace }]}>
        <View style={styles.header}>
          <BackButton onPress={() => {}} />
          <Text variant="title" style={styles.flex}>
            v4 pieces
          </Text>
          <RoundButton variant="soft" accessibilityLabel="Search" onPress={() => {}}>
            <Icon name="search" size={19} strokeWidth={2.2} />
          </RoundButton>
        </View>

        <Text variant="h1" style={styles.gap}>
          What does your body need today?
        </Text>
        <Text variant="bodySm" color={colors.muted}>
          Reduce motion is {reduceMotion ? 'on' : 'off'}.
        </Text>

        <Section title="BUTTONS">
          <Button label="Pay ₹199" icon={<Icon name="arrowRight" size={18} color={colors.onBrand} />} />
          <Button label="Book" size="md" />
          <View style={styles.row}>
            <Button label="Change" variant="outline" size="sm" />
            <Button label="Directions" variant="cream" size="sm" iconLeft={<Icon name="directions" size={16} color={colors.ink} />} />
            <Button label="Edit" variant="ghost" size="sm" />
          </View>
          <View style={styles.row}>
            <Button label="Loading" size="md" loading style={styles.flex} />
            <Button label="Disabled" size="md" disabled style={styles.flex} />
          </View>
        </Section>

        <Section title="CHIPS">
          <View style={styles.wrap}>
            {FILTERS.map((f, i) => (
              <Chip key={f} label={f} selected={filter === i} onPress={() => setFilter(i)} />
            ))}
          </View>
          <View style={styles.row}>
            <Chip label="60 min slot" icon={<Icon name="clock" size={13} strokeWidth={2.2} />} />
            <Chip label="Treatment at spa" />
          </View>
        </Section>

        <Section title="ROUND BUTTONS">
          <View style={styles.row}>
            <BackButton onPress={() => {}} />
            <RoundButton variant="soft" accessibilityLabel="Search" onPress={() => {}}>
              <Icon name="search" size={19} />
            </RoundButton>
            <View style={styles.photo}>
              <RoundButton variant="glass" accessibilityLabel="Close" onPress={() => {}}>
                <Icon name="close" size={18} />
              </RoundButton>
            </View>
          </View>
        </Section>

        <Section title="CARDS · ENTRANCE">
          {(['flat', 'raised', 'brand'] as const).map((variant, i) => (
            <Animated.View key={variant} entering={rise(i * 80)}>
              <Card variant={variant} style={styles.card}>
                <Text variant="cardTitle">The lemmon spa</Text>
                <Text variant="caption" color={colors.muted}>
                  {variant} card · C.G. Road · 4.2 km
                </Text>
              </Card>
            </Animated.View>
          ))}
          <Button label="Replay entrances" variant="secondary" size="md" onPress={() => setRun(r => r + 1)} />
          <Button label="Open Review & pay sheet" variant="secondary" size="md" onPress={() => setSheetOpen(true)} />
          <Button label="Open Booked (success)" variant="secondary" size="md" onPress={() => setResult('success')} />
          <Button label="Open Booked (failed)" variant="secondary" size="md" onPress={() => setResult('failure')} />
        </Section>

        <Section title="COLOURS">
          <View style={styles.wrap}>
            {SWATCHES.map(([name, value]) => (
              <View key={name} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: value }]} />
                <Text variant="caption" color={colors.muted}>
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      </ScrollView>

      <TabBar items={TABS} activeKey={tab} onPress={setTab} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" color={colors.brand2}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  gap: {
    marginTop: 18,
  },
  section: {
    marginTop: 24,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#6C5A48',
  },
  card: {
    padding: 16,
    gap: 4,
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 14,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.14)',
  },
});
