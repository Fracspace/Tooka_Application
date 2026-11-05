import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Screen, Text } from '../../../components/ui';
import type { useIncomingCallScreen } from '../../../hooks/useIncomingCallScreen';
import { ENABLE_CALL_DIAGNOSTICS } from '../../../services/call/callLogger';
import { colors, fonts, useReduceMotion } from '../../../theme';
import { CallInspectorOverlay } from '../components/CallInspectorOverlay';

type Props = ReturnType<typeof useIncomingCallScreen>;

const TRACK_HEIGHT = 68;
const KNOB = 56;
const KNOB_INSET = 6;
/** How far along the track (0–1) the knob must be dropped to answer. */
const ANSWER_AT = 0.8;
const END_RED = '#E5654F';

const IncomingCallV4: React.FC<Props> = ({
  session,
  callState,
  accepting,
  callerName,
  handleAccept,
  handleReject,
  handleCancelAccept,
}) => {
  const insets = useSafeAreaInsets();
  const initial = callerName.charAt(0).toUpperCase();

  return (
    <Screen>
      <View style={styles.glow} pointerEvents="none" />

      <View style={[styles.head, { top: insets.top + 12 }]}>
        <View style={styles.chip}>
          <BlinkDot />
          <Text style={styles.chipText} numberOfLines={1}>{accepting ? 'Connecting' : 'Incoming Voice Call'}</Text>
        </View>
        <View style={styles.chip}>
          <Icon name="lock" size={13} color={colors.muted} />
          <Text style={styles.chipText} numberOfLines={1}>Number stays private</Text>
        </View>
      </View>

      <View style={[styles.who, { top: insets.top + 84 }]}>
        <Text style={styles.kick}>YOUR SPA IS CALLING</Text>
        <Text style={styles.name} numberOfLines={2}>
          {callerName}
        </Text>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {accepting ? 'Connecting…' : 'Incoming Voice Call'}
        </Text>
      </View>

      <View style={styles.discArea} pointerEvents="none">
        <Disc initial={initial} ringing={!accepting} />
      </View>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        {accepting ? (
          <>
            <View style={styles.connecting} accessibilityRole="progressbar" accessibilityLabel="Connecting">
              <ActivityIndicator size="small" color={colors.brand2} />
              <Text style={styles.connectingText}>Connecting…</Text>
            </View>
            <Pressable
              onPress={handleCancelAccept}
              style={({ pressed }) => [styles.reject, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel connecting call">
              <Text style={styles.rejectText}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <SlideToAnswer onAnswer={handleAccept} />
            <Pressable
              onPress={handleReject}
              style={({ pressed }) => [styles.reject, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Reject call">
              <View style={styles.rejectX}>
                <Icon name="close" size={14} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
          </>
        )}
      </View>

      {ENABLE_CALL_DIAGNOSTICS && <CallInspectorOverlay sessionId={session?.sessionId} callState={callState} />}
    </Screen>
  );
};

/**
 * Drag the green knob to the end to answer. A plain tap on the knob answers too,
 * as does the screen reader's activate action, so nobody is stuck.
 */
function SlideToAnswer({ onAnswer }: { onAnswer: () => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useRef(new RNAnimated.Value(0)).current;
  const maxRef = useRef(0);
  const firedRef = useRef(false);
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;

  maxRef.current = Math.max(0, trackWidth - KNOB - KNOB_INSET * 2);

  const answer = () => {
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;
    answerRef.current();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          x.setValue(Math.min(maxRef.current, Math.max(0, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          const isTap = Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6;
          if (isTap || (maxRef.current > 0 && g.dx >= maxRef.current * ANSWER_AT)) {
            RNAnimated.timing(x, { toValue: maxRef.current, duration: 150, useNativeDriver: true }).start();
            answer();
            return;
          }
          RNAnimated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        },
        onPanResponderTerminate: () => {
          RNAnimated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [x],
  );

  const hintOpacity = x.interpolate({ inputRange: [0, 120], outputRange: [1, 0], extrapolate: 'clamp' });
  // The green fill sits off the left edge and slides in behind the knob.
  const fillShift = RNAnimated.add(x, KNOB + KNOB_INSET * 2);

  return (
    <View
      style={styles.track}
      onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Accept call"
      accessibilityHint="Slide right to answer"
      accessibilityActions={[{ name: 'activate', label: 'Accept call' }]}
      onAccessibilityAction={answer}>
      {trackWidth ? (
        <RNAnimated.View
          style={[styles.fill, { width: trackWidth, left: -trackWidth, transform: [{ translateX: fillShift }] }]}
        />
      ) : null}
      <RNAnimated.Text style={[styles.hint, { opacity: hintOpacity }]}>Slide to answer</RNAnimated.Text>
      <RNAnimated.View {...responder.panHandlers} style={[styles.knob, { transform: [{ translateX: x }] }]}>
        <Icon name="phone" size={26} color={colors.onBrand} />
      </RNAnimated.View>
    </View>
  );
}

function BlinkDot() {
  const reduceMotion = useReduceMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    o.value = withRepeat(withTiming(0.25, { duration: 600 }), -1, true);
    return () => cancelAnimation(o);
  }, [o, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Disc({ initial, ringing }: { initial: string; ringing: boolean }) {
  const reduceMotion = useReduceMotion();
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const r3 = useSharedValue(0);
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const ring = () => withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }), -1, false);
    r1.value = ring();
    r2.value = withDelay(800, ring());
    r3.value = withDelay(1600, ring());
    return () => {
      cancelAnimation(r1);
      cancelAnimation(r2);
      cancelAnimation(r3);
    };
  }, [r1, r2, r3, reduceMotion]);
  useEffect(() => {
    if (reduceMotion || !ringing) {
      cancelAnimation(tilt);
      tilt.value = withTiming(0, { duration: 150 });
      return;
    }
    tilt.value = withRepeat(
      withSequence(
        withDelay(1400, withTiming(-6, { duration: 120 })),
        withTiming(6, { duration: 120 }),
        withTiming(-4, { duration: 120 }),
        withTiming(0, { duration: 120 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(tilt);
  }, [reduceMotion, ringing, tilt]);

  const s1 = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - r1.value), transform: [{ scale: 0.85 + 1.25 * r1.value }] }));
  const s2 = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - r2.value), transform: [{ scale: 0.85 + 1.25 * r2.value }] }));
  const s3 = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - r3.value), transform: [{ scale: 0.85 + 1.25 * r3.value }] }));
  const tileStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));

  return (
    <View style={styles.disc}>
      <Animated.View style={[styles.ring, s1]} />
      <Animated.View style={[styles.ring, s2]} />
      <Animated.View style={[styles.ring, s3]} />
      <Animated.View style={[styles.mono, tileStyle]}>
        <Text style={styles.monoText}>{initial}</Text>
      </Animated.View>
      <Bars active={ringing && !reduceMotion} />
    </View>
  );
}

function Bars({ active }: { active: boolean }) {
  return (
    <View style={styles.bars}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Bar key={i} delay={i * 180} active={active} />
      ))}
    </View>
  );
}

function Bar({ delay, active }: { delay: number; active: boolean }) {
  const h = useSharedValue(6);
  useEffect(() => {
    if (!active) {
      cancelAnimation(h);
      h.value = 6;
      return;
    }
    h.value = withDelay(delay, withRepeat(withTiming(22, { duration: 450, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(h);
  }, [active, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, style]} />;
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: 180,
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(255,176,46,0.05)',
  },
  head: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  chip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(29,25,21,0.8)',
    borderWidth: 1,
    borderColor: colors.edgeHi,
  },
  chipText: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  who: { position: 'absolute', left: 20, right: 20 },
  kick: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: colors.subtle },
  name: {
    marginTop: 8,
    fontFamily: fonts.displayBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    color: colors.text,
  },
  status: { marginTop: 8, fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22, color: colors.muted },
  discArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 140 },
  disc: { width: 136, height: 136, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1.5,
    borderColor: 'rgba(251,243,232,0.18)',
  },
  mono: {
    width: 136,
    height: 136,
    borderRadius: 40,
    backgroundColor: colors.s2,
    borderWidth: 1,
    borderColor: colors.edgeHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoText: { fontFamily: fonts.displayBold, fontSize: 48, lineHeight: 56, color: colors.brand2 },
  bars: {
    position: 'absolute',
    bottom: -48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
  },
  bar: { width: 3, borderRadius: 2, backgroundColor: colors.muted },
  foot: { paddingHorizontal: 20, gap: 12 },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edgeHi,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(156,199,168,0.16)',
  },
  hint: {
    textAlign: 'center',
    paddingLeft: KNOB,
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.muted,
  },
  knob: {
    position: 'absolute',
    left: KNOB_INSET - 1,
    top: KNOB_INSET - 1,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reject: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(229,101,79,0.5)',
  },
  rejectX: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: END_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.danger },
  pressed: { opacity: 0.7 },
  connecting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edgeHi,
  },
  connectingText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.text },
});

export default IncomingCallV4;
