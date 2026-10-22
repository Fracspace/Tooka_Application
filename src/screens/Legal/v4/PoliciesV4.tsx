import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BackButton, Icon, PressableScale, Screen, Text } from '../../../components/ui';
import { useLegalLinks } from '../../../hooks/useLegalLinks';
import { brandAlpha, colors, fonts, motion, radii, rise, shadows, useReduceMotion } from '../../../theme';
import { privacyData } from '../data/privacy';
import { refundData } from '../data/refund';
import { termsData } from '../data/terms';
import type { LegalBullet, LegalContent, LegalSectionData } from '../types';

export type PolicyTab = 'terms' | 'privacy' | 'refund';

const DOCS: { key: PolicyTab; tab: string; title: string; intro: string; data: LegalContent }[] = [
  { key: 'terms', tab: 'Terms', title: 'Terms & conditions', intro: 'The rules for using Tooka to find and book spas.', data: termsData },
  { key: 'privacy', tab: 'Privacy', title: 'Privacy policy', intro: 'What we collect, why, and how we keep it safe.', data: privacyData },
  {
    key: 'refund',
    tab: 'Refund',
    title: 'Refund & cancellation',
    intro: 'When you get your booking amount back, and how.',
    data: refundData,
  },
];

const SUPPORT_EMAIL = 'hello@tooka.app';

/** "1. Platform Services" → "Platform Services"; the number is drawn separately. */
const headingText = (heading: string) => heading.replace(/^\d+\.\s*/, '');
const sectionNumber = (index: number) => String(index + 1).padStart(2, '0');

const bulletText = (bullet: LegalBullet) => (typeof bullet === 'string' ? bullet : bullet.text);

/** Rough reading time at 200 words a minute. */
function readTime(data: LegalContent): string {
  const words = data.sections
    .flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []).flatMap((b) => [bulletText(b), ...(typeof b === 'string' ? [] : b.nested ?? [])]),
    ])
    .join(' ')
    .split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

type Props = { initialTab: PolicyTab };

/** Terms, Privacy and Refund in one screen, with a tab for each. */
function PoliciesV4({ initialTab }: Props) {
  const navigation = useNavigation();
  const { handleEmailPress, handleLinkPress } = useLegalLinks();
  const [tab, setTab] = useState<PolicyTab>(initialTab);
  const [headerHeight, setHeaderHeight] = useState(182);
  const doc = DOCS.find((d) => d.key === tab) ?? DOCS[0]!;
  const minutes = useMemo(() => readTime(doc.data), [doc]);
  const contactEmail = doc.data.sections.find((s) => s.contact)?.contact?.email ?? SUPPORT_EMAIL;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const sectionY = useRef<Record<number, number>>({});
  const progress = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    const max = event.contentSize.height - event.layoutMeasurement.height;
    progress.value = max > 0 ? Math.min(1, Math.max(0, event.contentOffset.y / max)) : 0;
  });
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const pickTab = useCallback(
    (next: PolicyTab) => {
      if (next === tab) {
        return;
      }
      sectionY.current = {};
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      progress.value = 0;
      setTab(next);
    },
    [progress, scrollRef, tab],
  );

  const jumpTo = useCallback(
    (index: number) => {
      // Section offsets are measured inside the document, which starts 18pt
      // below the header, so this lands each heading 12pt under the header.
      const y = sectionY.current[index];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: y + 6, animated: true });
      }
    },
    [scrollRef],
  );

  return (
    <Screen>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.doc, { paddingTop: headerHeight + 18 }]}>
        <Animated.View key={tab} entering={rise(0, 16).duration(520)}>
          <View style={styles.meta}>
            <View style={styles.metaPill}>
              <Text style={[styles.metaText, { color: colors.brand2 }]}>Last updated {doc.data.lastUpdated}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{minutes}</Text>
            </View>
          </View>
          <Text style={styles.title}>{doc.title}</Text>
          <Text style={styles.intro}>{doc.intro}</Text>

          <View style={styles.toc} accessibilityLabel="Sections">
            {doc.data.sections.map((section, index) => (
              <Pressable
                key={section.heading}
                onPress={() => jumpTo(index)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${headingText(section.heading)}`}
                style={({ pressed }) => [styles.tocRow, index > 0 && styles.tocDivider, pressed && styles.tocPressed]}>
                <Text style={styles.tocNumber}>{sectionNumber(index)}</Text>
                <Text style={styles.tocLabel} numberOfLines={1}>
                  {headingText(section.heading)}
                </Text>
                <Icon name="chevronDown" size={14} color={colors.subtle} />
              </Pressable>
            ))}
          </View>

          {doc.data.sections.map((section, index) => (
            <View
              key={section.heading}
              style={styles.section}
              onLayout={(event) => {
                sectionY.current[index] = event.nativeEvent.layout.y;
              }}>
              <Section section={section} index={index} onEmail={handleEmailPress} onLink={handleLinkPress} />
            </View>
          ))}

          <View style={styles.help}>
            <View style={styles.flex}>
              <Text style={styles.helpTitle}>Still have a question?</Text>
              <Text variant="caption" color={colors.muted}>
                We usually reply within a day.
              </Text>
            </View>
            <PressableScale
              onPress={() => handleEmailPress(contactEmail)}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={`Email us at ${contactEmail}`}
              style={styles.helpButton}>
              <Text style={styles.helpButtonText}>Email us</Text>
            </PressableScale>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      <View style={styles.top} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <View style={styles.topRow}>
          <BackButton onPress={() => navigation.goBack()} accessibilityLabel="Back to Profile" />
          <Text variant="title">Policies</Text>
        </View>
        <Segment value={tab} onChange={pickTab} />
        <Animated.View style={[styles.progress, progressStyle]} />
      </View>
    </Screen>
  );
}

type SectionProps = {
  section: LegalSectionData;
  index: number;
  onEmail: (email: string) => void;
  onLink: (url: string) => void;
};

function Section({ section, index, onEmail, onLink }: SectionProps) {
  return (
    <>
      <View style={styles.h2}>
        <Text style={[styles.h2Text, { color: colors.brand }]}>{sectionNumber(index)}</Text>
        <Text style={[styles.h2Text, styles.flex]}>{headingText(section.heading)}</Text>
      </View>
      {section.paragraphs?.map((paragraph) => (
        <Text key={paragraph} style={styles.p}>
          {paragraph}
        </Text>
      ))}
      {section.bullets?.length ? (
        <View style={styles.ul}>
          {section.bullets.map((bullet) => (
            <View key={bulletText(bullet)}>
              <Bullet text={bulletText(bullet)} />
              {typeof bullet !== 'string' && bullet.nested?.length ? (
                <View style={styles.nested}>
                  {bullet.nested.map((item) => (
                    <Bullet key={item} text={item} small />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {section.contact ? (
        <Text style={styles.p}>
          {section.contact.prefix ? `${section.contact.prefix} ` : null}
          <Text style={styles.link} onPress={() => onEmail(section.contact!.email)} accessibilityRole="link">
            {section.contact.email}
          </Text>
        </Text>
      ) : null}
      {section.links?.map((link) => (
        <Text key={link.url} style={[styles.p, styles.link]} onPress={() => onLink(link.url)} accessibilityRole="link">
          {link.text}
        </Text>
      ))}
    </>
  );
}

function Bullet({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <View style={styles.li}>
      <View style={[styles.dot, small && styles.dotSmall]} />
      <Text style={[styles.liText, small && styles.liTextSmall]}>{text}</Text>
    </View>
  );
}

/** Terms / Privacy / Refund with a saffron pill that springs to the choice. */
function Segment({ value, onChange }: { value: PolicyTab; onChange: (tab: PolicyTab) => void }) {
  const [width, setWidth] = useState(0);
  const index = DOCS.findIndex((d) => d.key === value);
  const x = useSharedValue(index);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    x.value = reduceMotion ? index : withTiming(index, { duration: 440, easing: motion.spring });
  }, [index, reduceMotion, x]);

  const pillWidth = (width - 8) / DOCS.length;
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * pillWidth }] }));

  return (
    <View style={styles.seg} accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View style={[styles.pill, { width: pillWidth }, pillStyle]} /> : null}
      {DOCS.map((d) => {
        const on = d.key === value;
        return (
          <Pressable
            key={d.key}
            onPress={() => onChange(d.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.segButton}>
            <Text style={[styles.segText, { color: on ? colors.onBrand : colors.muted }]}>{d.tab}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const BODY = '#D9CDBD';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  doc: { paddingHorizontal: 20, paddingBottom: 60 },

  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(18,16,14,0.96)',
    boxShadow: `0 1px 0 ${colors.edge}`,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progress: {
    position: 'absolute',
    left: 0,
    bottom: -1,
    height: 2,
    backgroundColor: colors.brand,
    boxShadow: `0 0 8px ${brandAlpha(0.6)}`,
  },

  seg: {
    marginTop: 12,
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.md,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  pill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 12,
    backgroundColor: colors.brand,
    boxShadow: shadows.selected,
  },
  segButton: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 16 },

  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaPill: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  metaText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13, color: colors.muted },
  title: { marginTop: 16, fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.52 },
  intro: { marginTop: 8, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted },

  toc: { marginTop: 20, borderRadius: radii.xl, backgroundColor: colors.s1, boxShadow: shadows.ring, overflow: 'hidden' },
  tocRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 14 },
  tocDivider: { borderTopWidth: 1, borderTopColor: colors.edge },
  tocPressed: { backgroundColor: colors.s2 },
  tocNumber: { width: 22, fontFamily: fonts.display, fontSize: 12, lineHeight: 14, color: colors.brand },
  tocLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },

  section: { marginTop: 28 },
  h2: { flexDirection: 'row', gap: 10 },
  h2Text: { fontFamily: fonts.display, fontSize: 17, lineHeight: 23 },
  p: { marginTop: 10, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: BODY },
  link: { color: colors.brand2, textDecorationLine: 'underline' },
  ul: { marginTop: 10, gap: 8 },
  nested: { marginTop: 6, marginLeft: 18, gap: 6 },
  li: { flexDirection: 'row', gap: 10 },
  dot: { marginTop: 8, marginLeft: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  dotSmall: { width: 4, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: colors.brandDeep },
  liText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: BODY },
  liTextSmall: { fontSize: 13, lineHeight: 19, color: colors.muted },

  help: {
    marginTop: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.s1,
    boxShadow: shadows.ring,
  },
  helpTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
  helpButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  helpButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 16, color: colors.onBrand },
});

export default PoliciesV4;
