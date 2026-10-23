import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Haze, Icon, PressableScale, RoundButton, Screen, Text, useTabBarSpace, type IconName } from '../../../components/ui';
import type { useProfileScreen } from '../../../hooks/useProfileScreen';
import { colors, fonts, motion, radii, shadows, type as typeStyles, useReduceMotion, useRise } from '../../../theme';
import { ProfileSkeleton } from './ProfileSkeleton';

type Props = ReturnType<typeof useProfileScreen>;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 2 * Math.PI * 39;

/** Up to two initials for the avatar when there is no photo. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || name === 'No Name') {
    return '';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

const ProfileContent: React.FC<Props> = ({
  displayName,
  displayEmail,
  displayPhone,
  avatarSource,
  appVersion,
  completion,
  bookingStats,
  openBookings,
  handleLogout,
  handleDeleteAccount,
  handleRateApp,
  handleNotificationPress,
  openPaymentHistory,
  openTerms,
  openPrivacy,
  openRefund,
  openEditProfile,
  callSupport,
  emailSupport,
}) => {
  const bottomSpace = useTabBarSpace();
  const initials = initialsOf(displayName);

  const riseCard = useRise(0);
  const riseWell = useRise(80);
  const riseHelp = useRise(140);
  const riseLists = useRise(200);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomSpace + 24 }}>
        <Haze height={300} />
        <View style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <RoundButton accessibilityLabel="Notifications" onPress={handleNotificationPress}>
              <Bell />
            </RoundButton>
          </View>

          <Animated.View style={[styles.card, riseCard]} accessibilityLabel="Your account">
            <View style={styles.account}>
              <View style={styles.avatar}>
                <CompletionRing percent={completion?.percent ?? 0} />
                <View style={styles.face}>
                  {avatarSource ? (
                    <Image source={avatarSource} style={styles.faceImage} />
                  ) : initials ? (
                    <Text style={styles.initials}>{initials}</Text>
                  ) : (
                    <Icon name="profile" size={30} color={colors.muted} />
                  )}
                </View>
                <PressableScale
                  onPress={openEditProfile}
                  scaleTo={0.94}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                  style={styles.editBadge}>
                  <Icon name="edit" size={13} color={colors.ink} strokeWidth={2.4} />
                </PressableScale>
              </View>
              <View style={styles.accountText}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text variant="bodySm" color={colors.muted} style={styles.phone}>
                  {displayPhone}
                </Text>
                <Text variant="bodySm" color={colors.muted} numberOfLines={1}>
                  {displayEmail}
                </Text>
              </View>
            </View>
            {completion?.hint ? (
              <PressableScale
                onPress={openEditProfile}
                accessibilityRole="button"
                accessibilityLabel={`Profile ${completion.percent}% complete. ${completion.hint}`}
                style={styles.nudge}>
                <Text variant="bodySm" style={styles.nudgeText}>
                  <Text variant="bodySm" style={styles.nudgeStrong}>
                    Profile {completion.percent}% complete.
                  </Text>{' '}
                  <Text variant="bodySm" color={colors.muted}>
                    {completion.hint}
                  </Text>
                </Text>
                <Icon name="chevronRight" size={16} strokeWidth={2.4} />
              </PressableScale>
            ) : null}
            {bookingStats ? (
              <View style={styles.stats}>
                <Stat value={String(bookingStats.upcoming)} label="Upcoming" onPress={openBookings} />
                <Stat value={String(bookingStats.visits)} label="Visits" onPress={openBookings} divider />
                <Stat value={`₹${bookingStats.paid.toLocaleString('en-IN')}`} label="Paid" onPress={openPaymentHistory} divider />
              </View>
            ) : null}
          </Animated.View>

          <Animated.View style={[styles.well, riseWell]}>
            <Lotus />
            <View>
              <Text variant="cardTitle">Wellness is a happier you</Text>
              <Text variant="bodySm" color={colors.muted} style={styles.wellSub}>
                Book. Relax. Repeat.
              </Text>
            </View>
            <Leaf />
          </Animated.View>

          <Animated.View style={[styles.helpRow, riseHelp]}>
            <HelpCard icon="phone" eyebrow="Need help?" title="Call us" onPress={callSupport} />
            <HelpCard icon="mail" eyebrow="Drop a message" title="Email us" onPress={emailSupport} />
          </Animated.View>

          <Animated.View style={riseLists}>
            <Text style={styles.group}>ACCOUNT</Text>
            <View style={styles.list}>
              <Item icon="card" title="Payment history" subtitle="Receipts and refunds" onPress={openPaymentHistory} />
              <Item
                icon="profile"
                title="Personal details"
                subtitle="Name, gender, birthday, address"
                onPress={openEditProfile}
                divider
              />
            </View>

            <Text style={styles.group}>ABOUT TOOKA</Text>
            <View style={styles.list}>
              <Item icon="star" title="Rate the app" onPress={handleRateApp} />
              <Item icon="doc" title="Terms & conditions" onPress={openTerms} divider />
              <Item icon="shield" title="Privacy policy" onPress={openPrivacy} divider />
              <Item icon="refund" title="Refund & cancellation" onPress={openRefund} divider />
            </View>

            <View style={[styles.list, styles.signOut]}>
              <Item icon="logout" title="Log out" onPress={handleLogout} chevron={false} />
              <Item icon="trash" title="Delete account" onPress={handleDeleteAccount} chevron={false} danger divider />
            </View>

            <Text style={styles.brandLine}>TOOKA · NEAR YOU</Text>
            <Text style={styles.version}>Version {appVersion}</Text>
          </Animated.View>
        </View>
      </ScrollView>
    </Screen>
  );
};

/** The ring around the avatar fills to the profile's completion. */
function CompletionRing({ percent }: { percent: number }) {
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(RING);
  const target = RING * (1 - percent / 100);

  useEffect(() => {
    offset.value = reduceMotion
      ? target
      : withDelay(300, withTiming(target, { duration: 1400, easing: motion.out }));
  }, [offset, reduceMotion, target]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <Svg
      width={84}
      height={84}
      viewBox="0 0 84 84"
      fill="none"
      style={[StyleSheet.absoluteFill, styles.ring]}>
      <Circle cx={42} cy={42} r={39} stroke={colors.s3} strokeWidth={3} />
      <AnimatedCircle
        cx={42}
        cy={42}
        r={39}
        stroke={colors.brand}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={RING}
        animatedProps={arcProps}
      />
    </Svg>
  );
}

function Stat({ value, label, onPress, divider = false }: { value: string; label: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={[styles.stat, divider && styles.statDivider]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

/** The bell gives a short shake every 4s, as on the canvas. */
function Bell() {
  const reduceMotion = useReduceMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const step = (to: number) => withTiming(to, { duration: 80, easing: Easing.inOut(Easing.ease) });
    angle.value = withDelay(
      1200,
      withRepeat(
        withSequence(withDelay(3600, step(14)), step(-12), step(8), step(-4), step(0)),
        -1,
      ),
    );
    return () => cancelAnimation(angle);
  }, [reduceMotion, angle]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 }, { rotate: `${angle.value}deg` }, { translateY: 8 }],
  }));

  return (
    <Animated.View style={style}>
      <Icon name="bell" size={20} />
    </Animated.View>
  );
}

function Lotus() {
  return (
    <Svg width={52} height={52} viewBox="0 0 52 52">
      <Circle cx={26} cy={26} r={26} fill={colors.s2} />
      <Path d="M26 36c-8 0-13-5-14-11 6 0 11 3 14 11z" fill={colors.brandDeep} />
      <Path d="M26 36c8 0 13-5 14-11-6 0-11 3-14 11z" fill={colors.brandDeep} />
      <Path d="M26 36c-5-4-5-12 0-19 5 7 5 15 0 19z" fill={colors.brand} />
    </Svg>
  );
}

/** The faint leaf in the banner's corner drifts slowly. */
function Leaf() {
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    t.value = withRepeat(
      withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: t.value * 6 }, { rotate: `${t.value * -6}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.leaf, style]}>
      <Svg width={90} height={90} viewBox="0 0 90 90" fill="none">
        <Path d="M80 10C40 10 12 34 12 78c40 0 68-28 68-68z" stroke="#3A3027" strokeWidth={2} />
        <Path d="M74 16 18 72" stroke="#3A3027" strokeWidth={2} />
      </Svg>
    </Animated.View>
  );
}

function HelpCard({ icon, eyebrow, title, onPress }: { icon: IconName; eyebrow: string; title: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} accessibilityRole="button" accessibilityLabel={title} style={styles.help}>
      <View style={styles.ic}>
        <Icon name={icon} size={18} color={colors.cream} />
      </View>
      <View>
        <Text style={styles.helpEyebrow}>{eyebrow}</Text>
        <Text variant="itemTitle">{title}</Text>
      </View>
    </PressableScale>
  );
}

type ItemProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  chevron?: boolean;
  danger?: boolean;
  divider?: boolean;
};

function Item({ icon, title, subtitle, onPress, chevron = true, danger = false, divider = false }: ItemProps) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.item, divider && styles.itemDivider, pressed && styles.itemPressed]}>
      <View style={styles.ic}>
        <Icon name={icon} size={18} color={danger ? colors.danger : colors.cream} />
      </View>
      <View style={styles.itemText}>
        <Text style={[styles.itemTitle, { color: tint }]}>{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.muted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {chevron ? <Icon name="chevronRight" size={16} color={colors.subtle} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },

  card: { marginTop: 18, padding: 16, borderRadius: radii.card, backgroundColor: colors.s1, boxShadow: shadows.card },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 84, height: 84 },
  face: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(160deg, #3A3129 0%, #241E19 100%)',
  },
  faceImage: { width: '100%', height: '100%' },
  initials: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 0 3px ${colors.s1}`,
  },
  accountText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24 },
  phone: { marginTop: 2 },
  ring: { transform: [{ rotate: '-90deg' }] },
  nudge: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.s2,
  },
  nudgeText: { flex: 1 },
  nudgeStrong: { fontFamily: fonts.bodySemiBold },
  stats: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.edge },
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.edge },
  statValue: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.brand2 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, lineHeight: 13, color: colors.muted },

  well: {
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    experimental_backgroundImage: 'linear-gradient(120deg, #3A2A12 0%, #1A1612 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(255,176,46,0.22)',
  },
  wellSub: { marginTop: 2 },
  leaf: { position: 'absolute', right: -18, top: -20, opacity: 0.5 },

  helpRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  help: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  helpEyebrow: { ...typeStyles.tab, fontFamily: fonts.body, color: colors.muted },
  ic: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.glassEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },

  group: {
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: 4,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.54,
    color: colors.brand2,
  },
  list: { borderRadius: 22, backgroundColor: colors.s1, boxShadow: shadows.ring, overflow: 'hidden' },
  signOut: { marginTop: 22 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 60 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.edge },
  itemPressed: { backgroundColor: colors.s2 },
  itemText: { flex: 1 },
  itemTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20 },

  brandLine: {
    marginTop: 26,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1.92,
    color: colors.muted,
  },
  version: { marginTop: 6, textAlign: 'center', fontFamily: fonts.body, fontSize: 11, lineHeight: 13, color: colors.subtle },
});

/**
 * Shows the skeleton on the tab's first frame and while the profile loads, then
 * the page. The skeleton is cheap to draw, so the tab never sits blank.
 */
const ProfileV4: React.FC<Props> = (props) => {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPainted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!painted || (props.profileLoading && !props.profile)) {
    return <ProfileSkeleton />;
  }
  return <ProfileContent {...props} />;
};

export default ProfileV4;
