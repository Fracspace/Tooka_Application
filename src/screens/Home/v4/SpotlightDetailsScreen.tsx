import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useSpaDetailsScreen } from '../../../hooks/useSpaDetailsScreen';
import { SpaDetailsSummarySheet } from '../SpaDetailsScreen';
import SpaDetailsV4 from './SpaDetailsV4';
import { SpaBodyBones } from './SpaDetailsSkeleton';
import { FitImage, Text } from '../../../components/ui';
import { reportSpotlightSpa } from './spotlightSync';
import { colors, motion, radii, useReduceMotion } from '../../../theme';

type SpotlightSpa = RootStackParamList['SpotlightDetails']['spas'][number];

/** Gap between neighbouring cards, and each card's inset from the screen edge. */
const GAP = 10;
const SIDE = 20;
/** Space above the small card, below the status bar. */
const TOP_GAP = 44;
/** How far the card has to be dragged down to close (Android pull-down). */
const DRAG_TO_CLOSE = 90;

type Layout = { width: number; slot: number; pad: number; top: number };

/** The spa shown full on the current page: real Spa Details, as a card. */
function ActivePage({
  spa,
  scrollY,
  expand,
  onClose,
}: {
  spa: SpotlightSpa;
  scrollY: SharedValue<number>;
  expand: Readonly<SharedValue<number>>;
  onClose: () => void;
}) {
  const screen = useSpaDetailsScreen(spa.id);
  // Keep the card's photo and name up while the details load.
  if (!screen.spa && !screen.error) {
    return (
      <View style={styles.preview} accessibilityLabel="Loading spa details">
        {spa.image ? <FitImage uri={spa.image} style={styles.previewImage} /> : null}
        <Text variant="h1" numberOfLines={2} style={styles.previewName}>{spa.name}</Text>
        <SpaBodyBones withName={false} />
      </View>
    );
  }
  return (
    <>
      <SpaDetailsV4 {...screen} sheet={{ scrollY, expand, onClose }} />
      <SpaDetailsSummarySheet screen={screen} />
    </>
  );
}

/** Neighbouring pages only show the photo and name until they are swiped in. */
function PreviewPage({ spa }: { spa: SpotlightSpa }) {
  return (
    <View style={styles.preview}>
      {spa.image ? <FitImage uri={spa.image} style={styles.previewImage} /> : null}
      <Text variant="h1" numberOfLines={2} style={styles.previewName}>{spa.name}</Text>
    </View>
  );
}

function Page({
  spa,
  active,
  layout,
  scrollY,
  expand,
  onClose,
}: {
  spa: SpotlightSpa;
  active: boolean;
  layout: Layout;
  scrollY: SharedValue<number>;
  expand: Readonly<SharedValue<number>>;
  onClose: () => void;
}) {
  const { width, slot, pad, top } = layout;

  // Android scroll views don't overscroll past the top like iOS, so pulling
  // down never reached Spa Details' pull-to-close. Here a downward drag at the
  // top moves the card itself; let go far enough down and it closes.
  const drag = useSharedValue(0);
  const [atTop, setAtTop] = useState(true);
  useAnimatedReaction(
    () => scrollY.value <= 1,
    (now, before) => {
      if (active && now !== before) runOnJS(setAtTop)(now);
    },
    [active],
  );
  const pullDown = usePanGesture({
    enabled: Platform.OS === 'android' && active && atTop,
    activeOffsetY: 12,
    failOffsetX: [-15, 15],
    onUpdate: (e) => {
      'worklet';
      drag.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > DRAG_TO_CLOSE || e.velocityY > 900) runOnJS(onClose)();
      else drag.value = withTiming(0, { duration: motion.select, easing: motion.out });
    },
  });

  // Small: inset SIDE from both edges, TOP below the status bar, rounded.
  // Full: edge to edge. Neighbours fade out as the current card grows over them.
  const cardStyle = useAnimatedStyle(() => {
    const p = active ? expand.value : 0;
    const pull = active ? Math.max(0, -scrollY.value, drag.value) : 0;
    return {
      top: top * (1 - p),
      left: GAP / 2 - (GAP / 2 + pad) * p,
      width: width - 2 * SIDE + 2 * SIDE * p,
      borderRadius: radii.poster * (1 - p),
      opacity: active ? 1 : 1 - expand.value,
      transform: [
        { translateY: active ? drag.value : 0 },
        { scale: interpolate(pull, [0, 220], [1, 0.92], 'clamp') },
      ],
    };
  }, [active, width, pad, top]);

  return (
    <View style={{ width: slot }}>
      <GestureDetector gesture={pullDown}>
        <Animated.View style={[styles.card, cardStyle]}>
          {active ? (
            <ActivePage spa={spa} scrollY={scrollY} expand={expand} onClose={onClose} />
          ) : (
            <PreviewPage spa={spa} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/**
 * Opened from a Home spotlight card. Each spa is a card with its full details:
 * swipe sideways for the next spa, scroll up and the card fills the screen,
 * pull down at the top (or tap the chevron) to close.
 */
export default function SpotlightDetailsScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SpotlightDetails'>>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const slot = width - 2 * SIDE + GAP;
  const layout: Layout = { width, slot, pad: (width - slot) / 2, top: insets.top + TOP_GAP };

  const [index, setIndex] = useState(params.index);
  const [full, setFull] = useState(false);

  // Keep Home's carousel on the spa shown here, however the pager is closed.
  const shownId = params.spas[index]?.id;
  useEffect(() => {
    if (shownId) reportSpotlightSpa(shownId);
  }, [shownId]);
  const scrollY = useSharedValue(0);
  const expand = useDerivedValue(() => Math.min(1, Math.max(0, scrollY.value / layout.top)));

  // Sideways swiping stops once the card fills the screen.
  useAnimatedReaction(
    () => expand.value > 0.98,
    (now, before) => {
      if (now !== before) runOnJS(setFull)(now);
    },
  );

  const shown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) shown.value = withTiming(1, { duration: motion.enter, easing: motion.out });
  }, [reduceMotion, shown]);

  const closing = useRef(false);
  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (reduceMotion) {
      goBack();
      return;
    }
    shown.value = withTiming(0, { duration: 260, easing: motion.out }, (finished) => {
      if (finished) runOnJS(goBack)();
    });
  }, [reduceMotion, shown, goBack]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const pagerStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 120 }],
  }));

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / slot);
    if (next !== index && next >= 0 && next < params.spas.length) {
      scrollY.value = 0;
      setIndex(next);
    }
  };

  const renderItem = ({ item, index: i }: ListRenderItemInfo<SpotlightSpa>) => (
    <Page
      spa={item}
      active={i === index}
      layout={layout}
      scrollY={scrollY}
      expand={expand}
      onClose={close}
    />
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.root, pagerStyle]}>
        <FlatList
          data={params.spas}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          extraData={index}
          horizontal
          scrollEnabled={!full}
          showsHorizontalScrollIndicator={false}
          snapToInterval={slot}
          decelerationRate="fast"
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: layout.pad }}
          initialScrollIndex={params.index}
          getItemLayout={(_, i) => ({ length: slot, offset: slot * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          windowSize={3}
          initialNumToRender={3}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(8,6,5,0.82)' },
  card: {
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  preview: { flex: 1, backgroundColor: colors.bg },
  previewImage: { width: '100%', height: 420 },
  previewName: { margin: 20 },
});
