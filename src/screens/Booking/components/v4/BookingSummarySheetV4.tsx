import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, Button, Icon, PressableScale, Screen, Text } from '../../../../components/ui';
import { brandAlpha, colors, fonts, gradients, motion, radii, rise, shadows } from '../../../../theme';
import { useAuth } from '../../../../context/AuthContext';
import { useProfile } from '../../../../context/ProfileContext';
import type { BookingSummarySheetProps } from '../BookingSummarySheet';

// "04:00 PM" -> ["4:00", "PM"], so the time can be drawn large with a small AM/PM.
const splitTime = (label: string): [string, string] => {
  const m = label.trim().match(/^0?(.*?)\s*([AaPp][Mm])$/);
  return m ? [m[1], m[2].toUpperCase()] : [label, ''];
};

/**
 * v4 "Review & pay", full screen. It is still a Modal: the iOS Cashfree fix
 * waits for this Modal's onDismiss before opening the gateway. Closing is
 * blocked while payment is starting, as in the old sheet.
 */
function BookingSummarySheetV4({
  visible,
  loading = false,
  onClose,
  onConfirm,
  onDismissed,
  spaName,
  spaImage,
  location,
  dateLabel,
  timeLabel,
  serviceName,
  serviceDurationMinutes,
  slotDurationMinutes,
  bookingFeeText,
  bookingFeeNote,
}: BookingSummarySheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();

  const handleClose = () => {
    if (!loading) onClose();
  };

  const serviceValue =
    serviceName && serviceDurationMinutes
      ? `${serviceName} · ${serviceDurationMinutes} min`
      : serviceName;
  const [time, meridiem] = splitTime(timeLabel);
  const overline = dateLabel.replace(/,\s*/g, ' · ').toUpperCase();
  const bookingFor =
    profile?.fullName?.trim() ||
    profile?.displayName?.trim() ||
    profile?.username?.trim() ||
    user?.userName?.trim() ||
    user?.fullName?.trim() ||
    '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
      onDismiss={onDismissed}
    >
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <BackButton onPress={handleClose} accessibilityLabel={`Back to ${spaName ?? 'spa'}`} />
          <Text variant="title">Review & pay</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 150 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Your slot */}
          <Animated.View entering={rise(0)} style={styles.slot} accessibilityLabel="Your slot">
            <View style={styles.spaRow}>
              {spaImage ? <Image source={{ uri: spaImage }} style={styles.spaImage} resizeMode="cover" /> : null}
              <View style={styles.flex}>
                <Text variant="cardTitle" numberOfLines={1}>{spaName ?? 'Spa'}</Text>
                {location ? (
                  <Text variant="caption" color={colors.muted} numberOfLines={1}>{location}</Text>
                ) : null}
              </View>
            </View>

            {overline ? <Text style={styles.overline}>{overline}</Text> : null}
            <View style={styles.timeRow} accessibilityLabel={timeLabel}>
              {time.split('').map((ch, i) => (
                <Animated.Text
                  key={`${ch}-${i}`}
                  entering={rise(120 + i * 50, 22).duration(motion.rise)}
                  style={styles.big}
                >
                  {ch}
                </Animated.Text>
              ))}
              {meridiem ? (
                <Animated.Text entering={rise(120 + time.length * 50 + 70, 22)} style={styles.meridiem}>
                  {meridiem}
                </Animated.Text>
              ) : null}
            </View>

            <View style={styles.chipRow}>
              {slotDurationMinutes ? (
                <View style={styles.chip}>
                  <Icon name="clock" size={13} color={colors.text} />
                  <Text style={styles.chipText}>{`${slotDurationMinutes} min slot`}</Text>
                </View>
              ) : null}
              <View style={[styles.chip, styles.chipShrink]}>
                <Text style={styles.chipText} numberOfLines={1}>{serviceValue ?? 'Treatment at spa'}</Text>
              </View>
              <View style={styles.spacer} />
              <PressableScale
                onPress={handleClose}
                disabled={loading}
                style={[styles.change, loading && styles.dim]}
                accessibilityRole="button"
                accessibilityLabel="Change time"
              >
                <Text style={styles.changeText}>Change</Text>
              </PressableScale>
            </View>
          </Animated.View>

          {/* Price */}
          <Animated.View entering={rise(200)} style={styles.card} accessibilityLabel="Price">
            <View style={styles.line}>
              <View style={styles.flex}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineTitle}>Slot booking</Text>
                  <View style={styles.now}>
                    <Text style={styles.nowText}>PAY NOW</Text>
                  </View>
                </View>
                {bookingFeeNote ? <Text variant="caption" color={colors.muted}>{bookingFeeNote}</Text> : null}
              </View>
              <Text style={styles.lineValue}>{bookingFeeText ?? 'At payment'}</Text>
            </View>
            {serviceValue ? null : (
              <View style={[styles.line, styles.divider]}>
                <View style={styles.flex}>
                  <Text style={styles.lineTitle}>Your treatment</Text>
                  <Text variant="caption" color={colors.muted}>Choose from the menu and pay at the spa</Text>
                </View>
              </View>
            )}
            {bookingFeeText ? (
              <View style={styles.total}>
                <View style={styles.dashes} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>To pay now</Text>
                  <Text style={styles.totalValue}>{bookingFeeText}</Text>
                </View>
              </View>
            ) : null}
          </Animated.View>

          {/* Booking for */}
          {bookingFor ? (
            <Animated.View entering={rise(280)} style={styles.forRow}>
              <View style={styles.av}>
                <Text style={styles.avText}>{bookingFor.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.flex}>
                <Text variant="bodySm" color={colors.muted}>Booking for</Text>
                <Text variant="itemTitle" numberOfLines={1}>{bookingFor}</Text>
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>

        {/* Pay */}
        <View style={[styles.payArea, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Button
            label={bookingFeeText ? `Pay ${bookingFeeText}` : 'Continue to payment'}
            onPress={onConfirm}
            loading={loading}
            disabled={loading}
            size="lg"
            style={styles.pay}
            icon={<Icon name="arrowRight" size={18} color={colors.onBrand} />}
          />
          <View style={styles.lock}>
            <Icon name="lock" size={13} color={colors.muted} />
            <Text variant="caption" color={colors.muted}>Secure payment by Cashfree · UPI, cards, net banking</Text>
          </View>
        </View>
      </Screen>
    </Modal>
  );
}

export default BookingSummarySheetV4;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  dim: { opacity: 0.5 },
  divider: { borderTopWidth: 1, borderTopColor: colors.edge },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  content: { paddingTop: 20, paddingHorizontal: 16, gap: 12 },

  slot: {
    overflow: 'hidden',
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderRadius: radii.poster,
    experimental_backgroundImage: 'radial-gradient(120% 90% at 100% 0%, #3A2A12 0%, #1D1915 62%)',
    boxShadow: shadows.brandRing,
  },
  spaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spaImage: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.s2 },
  overline: {
    marginTop: 22,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.54,
    color: colors.muted,
  },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  big: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52, letterSpacing: -1.9, color: colors.text },
  meridiem: { marginLeft: 8, fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.muted },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.s2,
    boxShadow: shadows.ring,
  },
  chipShrink: { flexShrink: 1 },
  spacer: { flexGrow: 1 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 14 },
  change: {
    height: 36,
    paddingHorizontal: 13,
    marginLeft: 2,
    borderRadius: radii.pill,
    justifyContent: 'center',
    boxShadow: shadows.brandRingStrong,
  },
  changeText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.brand2 },

  card: {
    backgroundColor: colors.s1,
    borderRadius: radii.card,
    boxShadow: shadows.card,
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineTitle: { fontFamily: fonts.display, fontSize: 14, lineHeight: 20 },
  lineValue: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
  now: {
    height: 20,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    justifyContent: 'center',
  },
  nowText: { fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 0.6, color: colors.onBrand },
  total: { paddingTop: 14, paddingBottom: 4 },
  // A 1px dashed rule: iOS cannot dash one side of a border, so it is drawn as
  // the top edge of a box whose other edges sit outside the clip.
  dashes: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.s3,
    borderStyle: 'dashed',
    marginBottom: -1,
  },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18 },
  totalValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: colors.brand },

  forRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, paddingHorizontal: 4 },
  av: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: { fontFamily: fonts.display, fontSize: 14 },

  payArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 18,
    paddingHorizontal: 16,
    experimental_backgroundImage: gradients.dock,
  },
  pay: { height: 58, borderRadius: radii.xl, boxShadow: `0 10px 26px ${brandAlpha(0.3)}` },
  lock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
});
