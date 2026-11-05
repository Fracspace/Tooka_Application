import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Icon, Screen, Text } from '../../../components/ui';
import { colors, fadeIn, fonts, rise } from '../../../theme';
import type { WellnessArticle } from '../types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_R = 20.5;
const RING_LEN = 2 * Math.PI * RING_R;
/** Scroll distance after which the top bar turns solid and shows the title. */
const SOLID_AT = 180;

type Props = { article: WellnessArticle };

const WellnessArticleV4: React.FC<Props> = ({ article }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [heroFailed, setHeroFailed] = useState(false);

  const scrollY = useSharedValue(0);
  const maxScroll = useSharedValue(1);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    maxScroll.value = Math.max(1, e.contentSize.height - e.layoutMeasurement.height);
  });

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(18,16,14,${interpolate(scrollY.value, [SOLID_AT - 60, SOLID_AT], [0, 0.96], Extrapolation.CLAMP)})`,
    borderBottomColor: `rgba(255,240,224,${interpolate(scrollY.value, [SOLID_AT - 60, SOLID_AT], [0, 0.14], Extrapolation.CLAMP)})`,
  }));
  const miniStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [SOLID_AT - 40, SOLID_AT], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: 6 * (1 - p) }] };
  });
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LEN * (1 - Math.min(1, Math.max(0, scrollY.value / maxScroll.value))),
  }));

  const hasBenefits = article.benefits && article.benefits.length > 0;

  return (
    <Screen>
      <Animated.View style={[styles.bar, { paddingTop: insets.top + 8 }, barStyle]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Svg width={44} height={44} viewBox="0 0 44 44" style={styles.ring}>
            <AnimatedCircle
              cx={22}
              cy={22}
              r={RING_R}
              stroke={colors.brand}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={RING_LEN}
              animatedProps={ringProps}
            />
          </Svg>
          <Icon name="back" size={20} />
        </Pressable>
        <Animated.Text style={[styles.mini, miniStyle]} numberOfLines={1}>
          {article.title}
        </Animated.Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }}>
        <Animated.View entering={rise(0, 14)} style={[styles.head, { paddingTop: insets.top + 72 }]}>
          <View style={styles.kickRow}>
            <Text style={styles.kick}>{article.category.toUpperCase()}</Text>
            <View style={styles.kickRule} />
          </View>
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.subtitle}>{article.subtitle}</Text>
          <Text style={styles.meta}>Wellness Insight</Text>
        </Animated.View>

        <Animated.View entering={fadeIn(120)} style={styles.hero}>
          {heroFailed ? null : (
            <Image
              source={article.heroImage}
              style={styles.heroImg}
              resizeMode="cover"
              onError={() => setHeroFailed(true)}
              accessibilityIgnoresInvertColors
            />
          )}
        </Animated.View>

        <Text style={styles.body}>{article.body}</Text>

        {hasBenefits ? (
          <>
            <Text style={styles.section}>Why it works</Text>
            <View style={styles.benefits}>
              {article.benefits.map((b, i) => (
                <View key={b.id} style={[styles.benefit, i > 0 && styles.benefitRule]}>
                  <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.benefitTitle}>{b.title}</Text>
                    <Text style={styles.benefitText}>{b.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {article.didYouKnow ? (
          <View style={styles.quote}>
            <Text style={styles.quoteMark} accessible={false}>
              “
            </Text>
            <Text style={styles.quoteLabel}>DID YOU KNOW?</Text>
            <Text style={styles.quoteText}>{article.didYouKnow}</Text>
          </View>
        ) : null}
      </Animated.ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  mini: { flex: 1, fontFamily: fonts.display, fontSize: 14, lineHeight: 18, color: colors.text },
  head: { paddingHorizontal: 20 },
  kickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kick: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: colors.subtle },
  kickRule: { flex: 1, height: 1, backgroundColor: colors.edgeHi },
  title: {
    marginTop: 12,
    fontFamily: fonts.displayBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    color: colors.text,
  },
  subtitle: { marginTop: 12, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.muted },
  meta: { marginTop: 16, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.subtle },
  hero: {
    height: 260,
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.s2,
  },
  heroImg: { width: '100%', height: '100%' },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.cream,
  },
  section: {
    marginTop: 32,
    marginHorizontal: 20,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.text,
  },
  benefits: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edge,
  },
  benefit: { flexDirection: 'row', gap: 16, padding: 16 },
  benefitRule: { borderTopWidth: 1, borderTopColor: colors.edge },
  num: { width: 32, fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 22, color: colors.subtle },
  benefitTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22, color: colors.text },
  benefitText: { marginTop: 2, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  quote: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edge,
    overflow: 'hidden',
  },
  quoteMark: {
    position: 'absolute',
    right: 12,
    top: -14,
    fontFamily: fonts.displayBold,
    fontSize: 110,
    lineHeight: 130,
    color: colors.text,
    opacity: 0.06,
  },
  quoteLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: colors.brand2 },
  quoteText: {
    marginTop: 8,
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
});

export default WellnessArticleV4;
