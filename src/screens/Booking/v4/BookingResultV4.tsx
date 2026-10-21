import React, { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PressableScale, Screen, Text } from '../../../components/ui';
import { brandAlpha, colors, fonts, motion, radii, rise, useReduceMotion } from '../../../theme';
import type { useBookingResultScreen } from '../../../hooks/useBookingResultScreen';

type Props = ReturnType<typeof useBookingResultScreen>;
type ResultType = Props['type'];

const AnimatedPath = Animated.createAnimatedComponent(Path);

const COPY: Record<
  ResultType,
  { title: string; subtitle: string; icon: string; tone: string; primary: string; secondary: string }
> = {
  success: {
    title: "You're booked",
    subtitle: 'Pick your treatment when you arrive.',
    icon: 'checkmark',
    tone: colors.brand,
    primary: 'View in My Bookings',
    secondary: 'Done',
  },
  failure: {
    title: 'Payment failed',
    subtitle: "Your payment couldn't be completed.",
    icon: 'close',
    tone: colors.danger,
    primary: 'Retry payment',
    secondary: 'Back to Home',
  },
  cancelled: {
    title: 'Payment cancelled',
    subtitle: 'Your booking has not been confirmed.',
    icon: 'alert',
    tone: colors.brand,
    primary: 'Retry payment',
    secondary: 'Back',
  },
  processing: {
    title: 'Payment processing',
    subtitle: 'Payment is still processing.',
    icon: 'sync',
    tone: colors.brand,
    primary: 'View My Bookings',
    secondary: 'Back to Home',
  },
  timeout: {
    title: 'Payment processing',
    subtitle: 'Payment is still processing.',
    icon: 'sync',
    tone: colors.brand,
    primary: 'View My Bookings',
    secondary: 'Back to Home',
  },
  refunded: {
    title: 'Payment refunded',
    subtitle: 'Your payment was refunded.',
    icon: 'refresh',
    tone: colors.danger,
    primary: 'Retry payment',
    secondary: 'Back to Home',
  },
};

const BITS = [
  { a: 0, c: colors.text, round: false },
  { a: 40, c: colors.sage, round: true },
  { a: 80, c: colors.cream, round: false },
  { a: 125, c: colors.brand, round: true },
  { a: 165, c: colors.text, round: false },
  { a: 205, c: colors.sage, round: false },
  { a: 245, c: colors.cream, round: true },
  { a: 285, c: colors.text, round: false },
  { a: 325, c: colors.sage, round: true },
];

// "2026-10-19" -> "Mon, 19 Oct"; "06:00 PM" -> "6:00 PM".
const formatDay = (value?: string): string => {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};
const formatTime = (value?: string): string => (value ?? '').trim().replace(/^0(\d)/, '$1');
const formatAmount = (amount: number | string | null | undefined, currency?: string): string => {
  const n = Number(amount);
  if (!amount || !(n > 0)) return '';
  const v = n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return !currency || currency.toUpperCase() === 'INR' ? `₹${v}` : `${currency} ${v}`;
};

const isToday = (value?: string): boolean => {
  if (!value) return false;
  const d = new Date(`${value}T00:00:00`);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

function Bit({ a, c, round, run }: { a: number; c: string; round: boolean; run: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (run) p.value = withDelay(560, withTiming(1, { duration: 1100, easing: motion.out }));
  }, [p, run]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2, 1], [0, 1, 0]),
    transform: [
      { rotate: `${a}deg` },
      { translateY: -118 * p.value },
      { scale: 0.4 + 0.6 * p.value },
      { rotate: `${160 * p.value}deg` },
    ],
  }));
  return <Animated.View style={[styles.bit, { backgroundColor: c }, round && styles.bitRound, style]} />;
}

function Wave({ delay, run }: { delay: number; run: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (run) p.value = withDelay(delay, withTiming(1, { duration: 1600, easing: motion.out }));
  }, [p, delay, run]);
  const style = useAnimatedStyle(() => ({
    opacity: run ? 1 - p.value : 0,
    transform: [{ scale: 0.7 + 1.2 * p.value }],
  }));
  return <Animated.View style={[styles.wave, style]} />;
}

function Badge({ type }: { type: ResultType }) {
  const reduceMotion = useReduceMotion();
  const copy = COPY[type];
  const success = type === 'success';
  const spinning = type === 'processing' || type === 'timeout';

  const disc = useSharedValue(reduceMotion ? 1 : 0);
  const dash = useSharedValue(reduceMotion ? 0 : 40);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    disc.value = withDelay(120, withTiming(1, { duration: 700, easing: motion.spring }));
    dash.value = withDelay(640, withTiming(0, { duration: 460, easing: motion.out }));
  }, [disc, dash, reduceMotion]);

  useEffect(() => {
    if (!spinning || reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1);
  }, [spin, spinning, reduceMotion]);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: disc.value }, { rotate: `${-30 * (1 - disc.value)}deg` }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${360 * spin.value}deg` }] }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));

  return (
    <View style={styles.badge} accessibilityLabel={copy.title}>
      {success ? (
        <>
          <Wave delay={500} run={!reduceMotion} />
          <Wave delay={750} run={!reduceMotion} />
          {BITS.map((b) => (
            <Bit key={b.a} {...b} run={!reduceMotion} />
          ))}
        </>
      ) : null}
      <Animated.View
        style={[
          styles.disc,
          { backgroundColor: success ? colors.brand : colors.s2 },
          success && styles.discGlow,
          discStyle,
        ]}
      >
        {success ? (
          <Svg width={50} height={50} viewBox="0 0 24 24" fill="none">
            <AnimatedPath
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke={colors.onBrand}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={40}
              animatedProps={checkProps}
            />
          </Svg>
        ) : (
          <Animated.View style={iconStyle}>
            <Ionicons name={copy.icon} size={46} color={copy.tone} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

function NextStep({ title, sub, on, last }: { title: string; sub: string; on?: boolean; last?: boolean }) {
  return (
    <View style={styles.next}>
      <View style={styles.nextRail}>
        <View style={[styles.nextDot, on && styles.nextDotOn]} />
        {last ? null : <View style={styles.nextLine} />}
      </View>
      <View style={styles.flex}>
        <Text variant="itemTitle">{title}</Text>
        <Text variant="caption" color={colors.muted}>{sub}</Text>
      </View>
    </View>
  );
}

function BookingResultV4({
  params,
  type,
  message,
  retrying,
  bookingCode,
  dateTime,
  showPaymentDetails,
  paymentCompletedAt,
  handleCopy,
  handlePrimary,
  handleSecondary,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const copy = COPY[type];
  const success = type === 'success';
  const retry = type === 'failure' || type === 'cancelled' || type === 'refunded';

  const day = formatDay(params?.appointmentDate);
  const time = formatTime(params?.appointmentTime);
  const duration = params?.serviceDurationMinutes ? `${params.serviceDurationMinutes} min` : '';
  const when = day && time ? [day, time, duration].filter(Boolean).join(' · ') : dateTime;
  const paid = formatAmount(params?.amount, params?.currency);
  const t0 = success ? 760 : 300;

  let subtitle = message ?? copy.subtitle;
  if (success && !message && time) {
    const dayText = isToday(params?.appointmentDate) ? 'today' : day ? `on ${day}` : '';
    subtitle = `See you ${dayText ? `${dayText} ` : ''}at ${time}. ${copy.subtitle}`;
  }

  // Success: Done (home) is the main action, My Bookings the quiet one.
  // Otherwise the main action is retry or My Bookings, as in the old screen.
  const main = success
    ? { label: copy.secondary, onPress: handleSecondary }
    : { label: retrying ? 'Retrying…' : copy.primary, onPress: handlePrimary };
  const quiet = success
    ? { label: copy.primary, onPress: handlePrimary }
    : { label: copy.secondary, onPress: handleSecondary };

  return (
    <Screen>
      <View
        pointerEvents="none"
        style={[styles.glow, { experimental_backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${success ? brandAlpha(0.22) : 'rgba(255,240,224,0.06)'} 0%, rgba(0,0,0,0) 70%)` }]}
      />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: 150 + insets.bottom }]}
      >
        <Badge type={type} />
        <Animated.View entering={rise(t0)}>
          <Text variant="hero" style={styles.title}>{copy.title}</Text>
        </Animated.View>
        <Animated.View entering={rise(t0 + 80)}>
          <Text variant="body" color={colors.muted} style={styles.subtitle}>{subtitle}</Text>
        </Animated.View>

        {/* Ticket */}
        <Animated.View entering={rise(t0 + 180)} style={styles.ticket}>
          <View style={styles.ticketTop}>
            {params?.spaImage ? <Image source={{ uri: params.spaImage }} style={styles.spaImage} /> : null}
            <View style={styles.flex}>
              <Text variant="cardTitle" numberOfLines={1}>{params?.spaName ?? 'Your spa'}</Text>
              <Text variant="bodySm" color={colors.muted} numberOfLines={1}>{when}</Text>
            </View>
          </View>
          <View style={styles.perf}>
            <View style={styles.perfLine} />
            <View style={[styles.notch, styles.notchL]} />
            <View style={[styles.notch, styles.notchR]} />
          </View>
          <View style={styles.ticketBody}>
            <View style={styles.kv}>
              <Text variant="bodySm" color={colors.muted}>Booking ID</Text>
              <View style={styles.kvRight}>
                <Text style={styles.code} selectable>{bookingCode ?? '--'}</Text>
                {bookingCode ? (
                  <PressableScale onPress={handleCopy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Copy booking ID">
                    <Ionicons name="copy-outline" size={15} color={colors.brand2} />
                  </PressableScale>
                ) : null}
              </View>
            </View>
            {success && paid ? (
              <View style={styles.kv}>
                <Text variant="bodySm" color={colors.muted}>Paid</Text>
                <Text variant="bodySm" style={styles.kvValue}>{`${paid} · slot booking`}</Text>
              </View>
            ) : null}
            {showPaymentDetails ? (
              <View style={styles.kv}>
                <Text variant="bodySm" color={colors.muted}>Paid on</Text>
                <Text variant="bodySm" style={styles.kvValue}>{paymentCompletedAt}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* What happens next */}
        {success ? (
          <Animated.View entering={rise(t0 + 340)} style={styles.nextList} accessibilityLabel="What happens next">
            <NextStep on title="Slot confirmed" sub="It's saved in My Bookings." />
            <NextStep title="Arrive 5–10 minutes early" sub="For a relaxed start." />
            <NextStep last title="Choose and pay at the spa" sub="Any treatment on their menu." />
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
        <Button
          label={main.label}
          onPress={main.onPress}
          loading={!success && retry && retrying}
          disabled={retrying}
          size="lg"
          style={styles.done}
        />
        <PressableScale
          onPress={quiet.onPress}
          disabled={retrying}
          style={styles.quiet}
          accessibilityRole="button"
          accessibilityLabel={quiet.label}
        >
          <Text style={styles.quietText}>{quiet.label}</Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

export default BookingResultV4;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  glow: { position: 'absolute', left: -60, right: -60, top: -120, height: 460 },
  content: { paddingHorizontal: 16 },

  badge: { width: 112, height: 112, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  wave: {
    ...StyleSheet.absoluteFill,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: brandAlpha(0.65),
  },
  bit: { position: 'absolute', left: 52, top: 52, width: 8, height: 8, borderRadius: 2 },
  bitRound: { borderRadius: 4 },
  disc: {
    ...StyleSheet.absoluteFill,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
  },
  discGlow: { boxShadow: `0 18px 40px ${brandAlpha(0.25)}` },

  title: { marginTop: 22, textAlign: 'center' },
  subtitle: { marginTop: 8, paddingHorizontal: 8, textAlign: 'center' },

  ticket: {
    marginTop: 20,
    borderRadius: radii.card,
    backgroundColor: colors.s1,
    boxShadow: `inset 0 0 0 1px ${brandAlpha(0.24)}`,
  },
  ticketTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 12 },
  spaImage: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.s2 },
  perf: { height: 20, justifyContent: 'center' },
  perfLine: {
    marginHorizontal: 20,
    height: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.s3,
    borderStyle: 'dashed',
  },
  notch: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg,
    boxShadow: `inset 0 0 0 1px ${brandAlpha(0.24)}`,
  },
  notchL: { left: -10 },
  notchR: { right: -10 },
  ticketBody: { paddingTop: 8, paddingHorizontal: 18, paddingBottom: 16, gap: 8 },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kvRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kvValue: { fontFamily: fonts.bodySemiBold, flexShrink: 1, textAlign: 'right' },
  code: { fontFamily: fonts.display, fontSize: 13, lineHeight: 18, letterSpacing: 0.5 },

  nextList: { marginTop: 22, marginHorizontal: 8 },
  next: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  nextRail: { width: 24, alignItems: 'center' },
  nextDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    backgroundColor: colors.s3,
    boxShadow: `0 0 0 4px ${colors.bg}`,
  },
  nextDotOn: { backgroundColor: colors.brand },
  nextLine: { width: 1, height: 30, marginTop: 4, backgroundColor: colors.s3 },

  actions: { position: 'absolute', left: 16, right: 16, bottom: 0, gap: 4 },
  done: { height: 56, borderRadius: radii.xl },
  quiet: { alignItems: 'center', padding: 10 },
  quietText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.muted },
});
