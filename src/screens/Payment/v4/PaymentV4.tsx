import React, { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Button, Icon, Screen, Text } from '../../../components/ui';
import { formatPaymentAmount } from '../../../payment/PaymentMapper';
import { PaymentFlowState } from '../../../payment/PaymentTypes';
import { colors, fonts, rise, useReduceMotion } from '../../../theme';
import { FLOW_LABELS } from '../components/PaymentStatusBadge';

type Props = {
  flowState: PaymentFlowState;
  message: string;
  userMessage?: string;
  isBusy: boolean;
  gatewayHelp: boolean;
  amount: number;
  currency: string;
  bookingRef?: string;
  spaName?: string;
  spaImage?: string;
  location?: string;
  serviceName?: string;
  serviceDurationMinutes?: number | null;
  dateTime: string;
  onReopenGateway: () => void;
  onCancelGateway: () => void;
  onBackToHome: () => void;
};

const RING = 88;
const RING_R = 40;
const ARC = 2 * Math.PI * RING_R;

/** The waiting screen behind the Cashfree checkout, in the v4 dark theme. */
const PaymentV4: React.FC<Props> = ({
  flowState,
  message,
  userMessage,
  isBusy,
  gatewayHelp,
  amount,
  currency,
  bookingRef,
  spaName,
  spaImage,
  location,
  serviceName,
  serviceDurationMinutes,
  dateTime,
  onReopenGateway,
  onCancelGateway,
  onBackToHome,
}) => {
  const insets = useSafeAreaInsets();
  const service = serviceName
    ? serviceDurationMinutes
      ? `${serviceName} · ${serviceDurationMinutes} min`
      : serviceName
    : null;

  return (
    <Screen haze>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}>
        <Animated.View entering={rise(0, 12)} style={styles.hero} accessibilityLiveRegion="polite">
          <Spinner />
          <View style={styles.chip}>
            <View style={styles.chipDot} />
            <Text style={styles.chipText}>{FLOW_LABELS[flowState]}</Text>
          </View>
          <Text style={styles.title}>Payment processing</Text>
          <Text style={styles.message}>{message}</Text>
        </Animated.View>

        <Animated.View entering={rise(80, 12)} style={styles.card}>
          <Text style={styles.label}>AMOUNT PAYABLE</Text>
          <Text style={styles.amount} accessibilityLabel={`Amount ${formatPaymentAmount(amount, currency)}`}>
            {formatPaymentAmount(amount, currency)}
          </Text>

          <View style={styles.rule} />

          <View style={styles.spaRow}>
            {spaImage ? (
              <Image source={{ uri: spaImage }} style={styles.spaImage} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.spaImage, styles.spaInitial]}>
                <Text style={styles.spaInitialText}>{(spaName ?? 'S').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.spaName} numberOfLines={2}>
                {spaName ?? 'Your spa'}
              </Text>
              {location ? (
                <Text style={styles.spaLocation} numberOfLines={1}>
                  {location}
                </Text>
              ) : null}
            </View>
          </View>

          {service ? <Row label="Service" value={service} /> : null}
          <Row label="Date & time" value={dateTime} />
          {bookingRef ? <Row label="Booking ref" value={bookingRef} /> : null}
        </Animated.View>

        <View style={styles.secure}>
          <Icon name="lock" size={14} color={colors.subtle} />
          <Text style={styles.secureText}>Secure payment powered by Cashfree</Text>
        </View>

        {userMessage ? (
          <Text style={styles.error} accessibilityRole="alert">
            {userMessage}
          </Text>
        ) : null}

        {gatewayHelp ? (
          <Animated.View entering={rise(0, 10)} style={styles.help}>
            <Text style={styles.helpTitle}>Payment window closed?</Text>
            <Text style={styles.helpText}>
              If the Cashfree window closed before you finished, open it again or cancel this
              payment. Your slot is held while you decide.
            </Text>
            <Button label="Open payment again" onPress={onReopenGateway} sheen={false} style={styles.helpPrimary} />
            <Button label="Cancel payment" variant="secondary" onPress={onCancelGateway} />
          </Animated.View>
        ) : null}

        <View style={styles.spacer} />

        <Button label="Back to home" variant="ghost" onPress={onBackToHome} disabled={isBusy} />
      </ScrollView>
    </Screen>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** A slowly turning saffron arc around a lock. */
function Spinner() {
  const reduceMotion = useReduceMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    turn.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  return (
    <View style={styles.spinner} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={colors.s3} strokeWidth={3} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={RING_R}
            stroke={colors.brand}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${ARC * 0.28} ${ARC}`}
          />
        </Svg>
      </Animated.View>
      <View style={styles.spinnerCore}>
        <Icon name="lock" size={24} color={colors.brand2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  hero: { alignItems: 'center' },
  spinner: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  spinnerCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 28,
    marginTop: 20,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edgeHi,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.muted },
  title: {
    marginTop: 12,
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  card: {
    marginTop: 32,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edge,
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: colors.subtle },
  amount: { marginTop: 4, fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: colors.text },
  rule: { height: 1, marginVertical: 16, backgroundColor: colors.edge },
  spaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  spaImage: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.s2 },
  spaInitial: { alignItems: 'center', justifyContent: 'center' },
  spaInitialText: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.brand2 },
  spaName: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21, color: colors.text },
  spaLocation: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 12 },
  rowLabel: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: colors.text },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  secureText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.subtle },
  error: { marginTop: 16, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.danger, textAlign: 'center' },
  help: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edgeHi,
    gap: 10,
  },
  helpTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21, color: colors.text },
  helpText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  helpPrimary: { marginTop: 4 },
  spacer: { flex: 1, minHeight: 24 },
});

export default PaymentV4;
