import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button, Icon, Screen, Text } from '../../../components/ui';
import { MAX_ONBOARDING_PICKS, type useOnboardingScreen } from '../../../hooks/useOnboardingScreen';
import { colors, fonts, motion, rise } from '../../../theme';
import type { OnboardingOption } from '../types';

type Props = ReturnType<typeof useOnboardingScreen>;

const SELECTED_RING = 'rgba(251,243,232,0.6)';

/** Line icons for each option id; anything unknown falls back to a sparkle. */
const OPTION_ICONS: Record<string, string> = {
  relax_massage: 'M12 20c-4 0-8-3-8-7 3 0 6 1 8 4 2-3 5-4 8-4 0 4-4 7-8 7zM12 17c-2-3-2-7 0-11 2 4 2 8 0 11z',
  recovery_pain: 'M3 12h4l2-5 4 10 2-5h6',
  beauty_skin: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  wellness_ayurveda: 'M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l7-7',
  steam_spa: 'M8 4c-2 2 2 3 0 5M12 4c-2 2 2 3 0 5M16 4c-2 2 2 3 0 5M4 14h16v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z',
  stress_relief: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01',
  top_rated: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  nearby_spas: 'M12 21s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  premium: 'M6 3h12l3 6-9 12L3 9zM3 9h18M9 3l3 18M15 3l-3 18',
  authentic: 'M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l7-7',
  best_value: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  couple_friendly: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
};
const FALLBACK_ICON = OPTION_ICONS.beauty_skin;

const stepIn = () => FadeInRight.duration(motion.enter).easing(motion.out).reduceMotion(ReduceMotion.System);

const OnboardingV4: React.FC<Props> = ({
  currentStepIndex,
  setCurrentStepIndex,
  currentStep,
  selectedOptions,
  totalSteps,
  isLastStep,
  isContinueDisabled,
  handleToggleOption,
  finish,
}) => {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const isGrid = currentStepIndex === 0;
  const full = selectedOptions.length >= MAX_ONBOARDING_PICKS;

  const handleNext = async () => {
    if (!isLastStep) {
      setCurrentStepIndex(currentStepIndex + 1);
      return;
    }
    setSaving(true);
    try {
      await finish();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.top, { marginTop: insets.top + 12 }]}>
        <View style={styles.bars} accessibilityLabel={`Step ${currentStepIndex + 1} of ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View key={i} style={styles.bar}>
              <View style={[styles.barFill, i <= currentStepIndex ? styles.barOn : null]} />
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Animated.View key={currentStep.id} entering={stepIn()}>
          <Text style={styles.kick}>
            STEP {String(currentStepIndex + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
          </Text>
          <Text style={styles.h1}>{currentStep.title}</Text>
          <Text style={styles.sub}>{currentStep.subtitle}</Text>

          <View style={isGrid ? styles.grid : styles.list} accessibilityRole="list">
            {currentStep.options.map((option, i) => {
              const order = selectedOptions.indexOf(option.id);
              const on = order >= 0;
              return isGrid ? (
                <Tile
                  key={option.id}
                  option={option}
                  on={on}
                  order={order + 1}
                  dim={!on && full}
                  index={i}
                  onPress={() => handleToggleOption(option.id)}
                />
              ) : (
                <Row
                  key={option.id}
                  option={option}
                  on={on}
                  dim={!on && full}
                  index={i}
                  onPress={() => handleToggleOption(option.id)}
                />
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.count}>
          <Text style={styles.countNum}>
            {selectedOptions.length}/{MAX_ONBOARDING_PICKS}
          </Text>
          <Text style={styles.countLabel}>picked</Text>
        </View>
        <Button
          label={isContinueDisabled ? 'Pick at least one' : isLastStep ? 'Finish' : 'Next'}
          onPress={handleNext}
          disabled={isContinueDisabled || saving}
          loading={saving}
          sheen={false}
          style={styles.btn}
        />
      </View>
    </Screen>
  );
};

function OptionIcon({ id, size, color }: { id: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d={OPTION_ICONS[id] ?? FALLBACK_ICON} />
    </Svg>
  );
}

type ItemProps = {
  option: OnboardingOption;
  on: boolean;
  dim: boolean;
  index: number;
  onPress: () => void;
};

function Tile({ option, on, order, dim, index, onPress }: ItemProps & { order: number }) {
  return (
    <Animated.View entering={rise(index * 50, 12)} style={styles.tileWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: dim }}
        accessibilityLabel={option.label}
        style={({ pressed }) => [styles.tile, on && styles.tileOn, dim && styles.dim, pressed && styles.pressed]}>
        <View style={[styles.tileIcon, on && styles.iconOn]}>
          <OptionIcon id={option.id} size={22} color={on ? colors.brand2 : colors.muted} />
        </View>
        <Text style={styles.tileLabel}>{option.label}</Text>
        {on ? (
          <Animated.View entering={ZoomIn.springify().reduceMotion(ReduceMotion.System)} style={styles.badge}>
            <Text style={styles.badgeText}>{order}</Text>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function Row({ option, on, dim, index, onPress }: ItemProps) {
  return (
    <Animated.View entering={rise(index * 50, 12)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: dim }}
        accessibilityLabel={option.label}
        style={({ pressed }) => [styles.row, on && styles.tileOn, dim && styles.dim, pressed && styles.pressed]}>
        <View style={[styles.rowIcon, on && styles.iconOn]}>
          <OptionIcon id={option.id} size={20} color={on ? colors.brand2 : colors.muted} />
        </View>
        <Text style={styles.rowLabel}>{option.label}</Text>
        <View style={[styles.check, on && styles.checkOn]}>
          {on ? <Icon name="check" size={16} color={colors.onBrand} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { height: 44, justifyContent: 'center', paddingHorizontal: 20 },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.s2, overflow: 'hidden' },
  barFill: { flex: 1, backgroundColor: 'transparent' },
  barOn: { backgroundColor: colors.brand },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  kick: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: colors.subtle },
  h1: {
    marginTop: 8,
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.text,
  },
  sub: { marginTop: 8, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  tileWrap: { width: '47.5%', flexGrow: 1 },
  tile: {
    height: 128,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edge,
    justifyContent: 'space-between',
  },
  tileOn: { backgroundColor: colors.s2, borderColor: SELECTED_RING, borderWidth: 1.5 },
  dim: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.97 }] },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOn: { backgroundColor: colors.s3 },
  tileLabel: { fontFamily: fonts.display, fontSize: 14, lineHeight: 19, color: colors.text },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.displayBold, fontSize: 12, lineHeight: 14, color: colors.onBrand },
  list: { gap: 8, marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 60,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 16,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edge,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.text },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.edgeHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.text, borderColor: colors.text },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.edge,
    backgroundColor: colors.bg,
  },
  count: { minWidth: 56 },
  countNum: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22, color: colors.text },
  countLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.muted },
  btn: { flex: 1 },
});

export default OnboardingV4;
