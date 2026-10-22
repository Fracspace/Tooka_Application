import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, FitImage, Icon, PressableScale, Screen, Text } from '../../../components/ui';
import { onSpotlightSpa } from './spotlightSync';
import { brandAlpha, colors, fadeIn, fonts, motion, radii, rise, useReduceMotion } from '../../../theme';
import { TypeIcon, type TypeIconName } from './typeIcons';
import type {
  FeaturedSpaItem,
  NearbyListItem,
  SpotlightSort,
  useHomeScreen,
} from '../../../hooks/useHomeScreen';
import type { BackendBookingListItem } from '../../../types/booking';

type Props = ReturnType<typeof useHomeScreen>;

// Fixed in the app for now; tapping one searches for it.
type TypeItem = { title: string; sub: string; icon: TypeIconName; query: string };
const TYPES: TypeItem[] = [
  { title: 'Swedish', sub: 'Relax & unwind', icon: 'swedish', query: 'Swedish' },
  { title: 'Deep tissue', sub: 'Release knots', icon: 'deepTissue', query: 'Deep tissue' },
  { title: 'Aroma', sub: 'Oils & calm', icon: 'aroma', query: 'Aroma' },
  { title: 'Thai', sub: 'Stretch & ease', icon: 'thai', query: 'Thai' },
  { title: 'Ayurveda', sub: 'Herbal rituals', icon: 'ayurveda', query: 'Ayurveda' },
  { title: 'Couples', sub: 'Spa together', icon: 'couples', query: 'Couple' },
];
const WIDE_TYPE: TypeItem = { title: 'Facial & skin', sub: 'Glow-up treatments', icon: 'facial', query: 'Facial' };

/**
 * A massage-type tile. As in the design, pressing shrinks the tile, rings it in
 * saffron and lifts and tilts the icon, which springs back on release.
 */
function TypeTile({ item, wide, onPress }: { item: TypeItem; wide?: boolean; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);
  const animate = (to: number) => {
    pressed.value = reduceMotion ? to : withTiming(to, { duration: 260, easing: motion.spring });
  };
  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, wide ? 0.97 : 0.95]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * pressed.value },
      { rotate: `${-6 * pressed.value}deg` },
      { scale: 1 + 0.06 * pressed.value },
    ],
  }));

  const text = (
    <>
      <Text style={styles.typeTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.typeSub} numberOfLines={1}>{item.sub}</Text>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} spas`}>
      <Animated.View style={[styles.type, wide && styles.typeWide, tileStyle]}>
        <Animated.View style={[!wide && styles.typeIcon, styles.typeIconShadow, iconStyle]}>
          <TypeIcon name={item.icon} />
        </Animated.View>
        {wide ? (
          <>
            <View style={styles.flex}>{text}</View>
            <Icon name="arrowRight" size={16} color={colors.muted} />
          </>
        ) : (
          text
        )}
        <Animated.View pointerEvents="none" style={[styles.typeRing, ringStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const SORT_LABELS: Record<SpotlightSort, string> = {
  recommended: 'Recommended',
  priceLow: 'Price: low to high',
  priceHigh: 'Price: high to low',
};
const NEXT_SORT: Record<SpotlightSort, SpotlightSort> = {
  recommended: 'priceLow',
  priceLow: 'priceHigh',
  priceHigh: 'recommended',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w, i) => (i === 0 ? w[0].toUpperCase() : w[0].toLowerCase()))
    .join('');

const hasRealImage = (uri: string) => Boolean(uri) && !/placeholder/i.test(uri);

function Section({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <View>
      <View style={styles.secRow}>
        <View style={[styles.secLine, styles.secLineLeft]} />
        <Text style={styles.secText}>{title}</Text>
        <View style={[styles.secLine, styles.secLineRight]} />
      </View>
      {/* {sub ? <Text style={styles.picks}>{sub}</Text> : null} */}
    </View>
  );
}

// ---------- Next visit ----------

const dayDiff = (d: Date) => {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((start(d) - start(new Date())) / 86400000);
};

function NextVisitCard({ booking }: { booking: BackendBookingListItem }) {
  const at = booking.appointmentAt ? new Date(booking.appointmentAt) : null;
  const valid = at && !Number.isNaN(at.getTime());
  const diff = valid ? dayDiff(at) : null;
  const when = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff != null && diff > 1 ? `in ${diff} days` : '';

  const openDirections = async () => {
    const query = `${booking.spaName} ${booking.location}`.trim();
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
    } catch {
      Alert.alert("Couldn't open maps", 'Please try again.');
    }
  };

  return (
    <Card variant="brand" style={styles.upcoming}>
      <View style={styles.datebox}>
        {valid ? (
          <>
            <Text style={styles.dateSmall}>
              {at.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
            </Text>
            <Text style={styles.dateDay}>{at.getDate()}</Text>
            <Text style={styles.dateSmall}>
              {at.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
            </Text>
          </>
        ) : (
          <Icon name="clock" size={22} color={colors.onBrand} />
        )}
      </View>
      <View style={styles.flex}>
        <View style={styles.upLabelRow}>
          <View style={styles.upDot} />
          <Text style={styles.upLabel}>Your next visit{when ? ` · ${when}` : ''}</Text>
        </View>
        <Text variant="cardTitle" numberOfLines={1} style={styles.upName}>
          {booking.spaName}
        </Text>
        <Text variant="bodySm" color={colors.muted} numberOfLines={1}>
          {booking.time}
        </Text>
      </View>
      <PressableScale
        onPress={openDirections}
        style={styles.iconRound}
        accessibilityRole="button"
        accessibilityLabel={`Directions to ${booking.spaName}`}>
        <Icon name="directions" size={18} color={colors.text} />
      </PressableScale>
    </Card>
  );
}

// ---------- Spotlight carousel ----------

type PosterItem = FeaturedSpaItem & { tag?: string };

// Sizes from District's spotlight: the middle card is ~61% of the screen wide,
// side cards are 80% of its size and sit 18pt away, partly off screen.
const SIDE_SCALE = 0.8;
const CARD_GAP = 18;
const spotlightSizes = (screenWidth: number) => {
  const cardW = Math.round(screenWidth * 0.607);
  return {
    cardW,
    cardH: Math.round(cardW * 1.34),
    interval: cardW * ((1 + SIDE_SCALE) / 2) + CARD_GAP,
  };
};

function SpotlightCard({
  item,
  index,
  x,
  sizes,
  onPress,
}: {
  item: PosterItem;
  index: number;
  x: SharedValue<number>;
  sizes: ReturnType<typeof spotlightSizes>;
  onPress: () => void;
}) {
  const { cardW, cardH, interval } = sizes;
  const scaleStyle = useAnimatedStyle(() => {
    const d = Math.abs(x.value - index * interval) / interval;
    return { transform: [{ scale: interpolate(d, [0, 1], [1, SIDE_SCALE], 'clamp') }] };
  }, [index, interval]);
  const dimStyle = useAnimatedStyle(() => {
    const d = Math.abs(x.value - index * interval) / interval;
    return { opacity: interpolate(d, [0, 1], [0, 0.35], 'clamp') };
  }, [index, interval]);

  return (
    <View style={[styles.slot, { width: interval, height: cardH }]}>
      <Animated.View style={[styles.poster, { width: cardW, height: cardH }, scaleStyle]}>
        <PressableScale onPress={onPress} scaleTo={0.98} style={StyleSheet.absoluteFill}
          accessibilityRole="button" accessibilityLabel={item.name}>
          {hasRealImage(item.image) ? (
            <FitImage uri={item.image} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={styles.mono}>
              <Text style={styles.monoText}>{initials(item.name)}</Text>
            </View>
          )}
          {item.tag ? (
            <View style={styles.pTag}>
              <Text style={styles.pTagText} numberOfLines={1}>{item.tag}</Text>
            </View>
          ) : null}
        </PressableScale>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
      </Animated.View>
    </View>
  );
}

/** Swipe-only carousel; tapping the middle card opens the spotlight pager. */
function Spotlight({ items, onOpen }: { items: PosterItem[]; onOpen: (items: PosterItem[], index: number) => void }) {
  const { width } = useWindowDimensions();
  const sizes = useMemo(() => spotlightSizes(width), [width]);
  const { interval } = sizes;
  const listRef = useRef<FlatList<PosterItem>>(null);
  const x = useSharedValue(0);
  const [active, setActive] = useState(0);
  const n = items.length;

  // Back to the first (best-matching) card whenever the list changes.
  const key = items.map((i) => i.id).join(',');
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setActive(0);
  }, [key]);

  // Follow the spotlight pager, so closing it lands on the spa it showed.
  useEffect(
    () =>
      onSpotlightSpa((spaId) => {
        const i = items.findIndex((item) => item.id === spaId);
        if (i < 0) return;
        listRef.current?.scrollToOffset({ offset: i * interval, animated: false });
        setActive(i);
      }),
    [items, interval],
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  useAnimatedReaction(
    () => Math.round(x.value / interval),
    (now, before) => {
      if (now !== before) runOnJS(setActive)(now);
    },
    [interval],
  );

  const current = items[Math.min(Math.max(active, 0), n - 1)];
  const meta = current ? [current.location, current.distance].filter(Boolean).join(' · ') : '';

  return (
    <View>
      <Animated.FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.flow, { paddingHorizontal: (width - interval) / 2 }]}
        getItemLayout={(_, i) => ({ length: interval, offset: interval * i, index: i })}
        initialNumToRender={4}
        windowSize={5}
        renderItem={({ item, index }) => (
          <SpotlightCard
            item={item}
            index={index}
            x={x}
            sizes={sizes}
            onPress={() =>
              index === active
                ? onOpen(items, index)
                : listRef.current?.scrollToOffset({ offset: index * interval, animated: true })
            }
          />
        )}
      />
      {current ? (
        <Animated.View key={current.id} entering={fadeIn()} style={styles.caption}>
          <Text style={styles.captionName} numberOfLines={1}>{current.name}</Text>
          {meta ? <Text variant="bodySm" color={colors.muted} numberOfLines={1} style={styles.center}>{meta}</Text> : null}
        </Animated.View>
      ) : null}
      <View style={styles.dots}>
        {items.map((item, i) => (
          <View key={item.id} style={[styles.dot, i === active && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

function StageMessage({
  title,
  body,
  action,
  onAction,
  loading,
}: {
  title?: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.stageMsg}>
      {loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <>
          <Text style={styles.stageTitle}>{title}</Text>
          {body ? <Text variant="bodySm" color={colors.muted} style={styles.center}>{body}</Text> : null}
          {action && onAction ? (
            <Button label={action} onPress={onAction} size="sm" variant="secondary" style={styles.stageBtn} />
          ) : null}
        </>
      )}
    </View>
  );
}

// ---------- Nearby list ----------

function Outlet({ item, delay, onPress }: { item: NearbyListItem; delay: number; onPress: () => void }) {
  const meta = [item.typeA, item.typeB].filter(Boolean).join(' · ');
  const where = [item.distance, item.area].filter(Boolean).join(' · ');
  const isNew = item.rating === 'New';
  return (
    <Animated.View entering={rise(delay)}>
      <PressableScale onPress={onPress} style={styles.outlet} accessibilityRole="button" accessibilityLabel={item.name}>
        <View style={styles.oTop}>
          <View style={styles.oLogo}>
            {hasRealImage(item.image) ? (
              <Image source={{ uri: item.image }} style={styles.oLogoImg} />
            ) : (
              <Text style={styles.oLogoText}>{initials(item.name)}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text variant="cardTitle" numberOfLines={1}>{item.name}</Text>
            {meta ? <Text style={styles.oMeta} numberOfLines={1}>{meta}</Text> : null}
            {where ? <Text style={styles.oMeta} numberOfLines={1}>{where}</Text> : null}
          </View>
        </View>
        <View style={styles.oStrip}>
          <Ionicons name={isNew ? 'sparkles' : 'star'} size={13} color={colors.brand} />
          <Text style={styles.oStripText} numberOfLines={1}>
            <Text style={styles.oStripBold}>{isNew ? 'New on Tooka' : item.rating}</Text>
            {item.price ? ` · from ${item.price}` : ''}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

// ---------- Screen ----------

export default function HomeV4(props: Props) {
  const {
    profile,
    location,
    locationDisplay,
    resolvedCity,
    spas,
    error,
    refetch,
    loadNextPage,
    loadingMore,
    pagination,
    searchQuery,
    setSearchQuery,
    retrySearch,
    clearSearch,
    isSearchActive,
    shouldShowSearchLoading,
    shouldShowSearchEmptyState,
    shouldShowSearchError,
    curatedList,
    previewSpas,
    mapRef,
    handleMapReady,
    handlePressLocation,
    handlePressSpaCard,
    handleOpenSpotlight,
    handleOpenExplore,
    isRefreshing,
    handleRefresh,
    isInitialLoading,
    shouldRenderEmptyState,
    nextVisit,
    onboardingPicksLabel,
    spotlightSpas,
    spotlightSort,
    setSpotlightSort,
    openTodayOnly,
    setOpenTodayOnly,
    couplesOnly,
    setCouplesOnly,
    hasCoupleRooms,
    nearbyClosestFirst,
  } = props;
  const insets = useSafeAreaInsets();
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const curatedY = useRef(0);
  const showSearch = searchOpen || searchQuery.length > 0;

  if (isInitialLoading) {
    return (
      <Screen haze style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </Screen>
    );
  }

  // Bring the results into view; the tiles sit above them.
  const scrollToResults = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, curatedY.current - insets.top - 80), animated: true });
  };

  const pickType = (query: string) => {
    setSearchOpen(true);
    setSearchQuery(query);
    scrollToResults();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    clearSearch();
  };

  const nearest = nearbyClosestFirst.find((s) => s.distance);
  const spaCount = nearbyClosestFirst.length;
  const avatar = profile?.displayName?.trim()?.[0]?.toUpperCase() ?? '';

  const renderStage = () => {
    if (shouldShowSearchLoading) return <StageMessage loading />;
    if (shouldShowSearchEmptyState) {
      return <StageMessage title="No spas found" body="Try another spa name or city." action="Clear search" onAction={closeSearch} />;
    }
    if (shouldShowSearchError) {
      return <StageMessage title="Couldn't search spas" body="Please try again." action="Retry" onAction={retrySearch} />;
    }
    if (isSearchActive) return <Spotlight items={curatedList} onOpen={handleOpenSpotlight} />;
    if (error && spas.length === 0) {
      return <StageMessage title="Something went wrong" body="Please try again." action="Retry" onAction={refetch} />;
    }
    if (shouldRenderEmptyState && !resolvedCity) {
      return (
        <StageMessage
          title="Where are you?"
          body="Choose your location to see spas curated for your city."
          action="Choose location"
          onAction={handlePressLocation}
        />
      );
    }
    if (shouldRenderEmptyState) {
      return <StageMessage title="No spas here yet" body="Try a different city or refresh." action="Retry" onAction={refetch} />;
    }
    if (spotlightSpas.length === 0) {
      return <StageMessage title="No spas match these filters" body="Clear a filter to see more." />;
    }
    return <Spotlight items={spotlightSpas} onOpen={handleOpenSpotlight} />;
  };

  return (
    <Screen haze>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand} progressViewOffset={insets.top} />
        }>
        {/* Header */}
        <View style={styles.gutter}>
          <View style={styles.headRow}>
            <PressableScale
              onPress={handlePressLocation}
              style={styles.pill}
              accessibilityRole="button"
              accessibilityLabel={`Change location, now ${locationDisplay.primary}`}>
              <Icon name="pin" size={16} color={colors.brand} />
              <View style={styles.pillText}>
                <Text style={styles.pillPrimary} numberOfLines={1}>{locationDisplay.primary}</Text>
                {locationDisplay.secondary ? (
                  <Text style={styles.pillSecondary} numberOfLines={1}>{locationDisplay.secondary}</Text>
                ) : null}
              </View>
              <Icon name="chevronDown" size={14} color={colors.muted} />
            </PressableScale>
            <View style={styles.flex} />
            <PressableScale
              onPress={() => (showSearch ? closeSearch() : setSearchOpen(true))}
              style={styles.roundBtn}
              accessibilityRole="button"
              accessibilityLabel={showSearch ? 'Close search' : 'Search'}>
              <Icon name={showSearch ? 'close' : 'search'} size={18} color={colors.text} />
            </PressableScale>
            {avatar ? (
              <View style={styles.roundBtn}>
                <Text style={styles.avatar}>{avatar}</Text>
              </View>
            ) : null}
          </View>

          {showSearch ? (
            <Animated.View entering={rise(30, 8)} style={styles.searchBox}>
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search spas or cities"
                placeholderTextColor={colors.subtle}
                style={styles.searchInput}
                autoFocus={searchOpen && !searchQuery}
                returnKeyType="search"
                onSubmitEditing={scrollToResults}
                selectionColor={colors.brand}
              />
            </Animated.View>
          ) : null}

          <Text variant="h1" style={styles.h1}>What does your body need today?</Text>

          <View style={styles.types}>
            {TYPES.map((t, i) => (
              <Animated.View key={t.title} entering={rise(30 + i * 40, 10)} style={styles.typeCell}>
                <TypeTile item={t} onPress={() => pickType(t.query)} />
              </Animated.View>
            ))}
            <Animated.View entering={rise(240, 10)} style={styles.typeWideCell}>
              <TypeTile item={WIDE_TYPE} wide onPress={() => pickType(WIDE_TYPE.query)} />
            </Animated.View>
          </View>
        </View>

        {nextVisit ? (
          <Animated.View entering={rise(120)} style={styles.nextWrap}>
            <NextVisitCard booking={nextVisit} />
          </Animated.View>
        ) : null}

        {/* Curated for you */}
        <View style={styles.section} onLayout={(e) => { curatedY.current = e.nativeEvent.layout.y; }}>
          <Section
            title={isSearchActive ? 'SEARCH RESULTS' : 'CURATED FOR YOU'}
            sub={
              !isSearchActive && onboardingPicksLabel ? (
                <>
                  Based on your picks: <Text style={styles.picksBold}>{onboardingPicksLabel}</Text>
                </>
              ) : undefined
            }
          />
          {!isSearchActive && spotlightSpas.length + (openTodayOnly || couplesOnly ? 1 : 0) > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip
                label={SORT_LABELS[spotlightSort]}
                selected={spotlightSort !== 'recommended'}
                onPress={() => setSpotlightSort(NEXT_SORT[spotlightSort])}
                icon={
                  <Ionicons
                    name="swap-vertical"
                    size={14}
                    color={spotlightSort !== 'recommended' ? colors.onBrand : colors.text}
                  />
                }
                accessibilityLabel={`Sort: ${SORT_LABELS[spotlightSort]}`}
              />
              <Chip label="Open today" selected={openTodayOnly} onPress={() => setOpenTodayOnly(!openTodayOnly)} />
              {hasCoupleRooms ? (
                <Chip label="Couples" selected={couplesOnly} onPress={() => setCouplesOnly(!couplesOnly)} />
              ) : null}
            </ScrollView>
          ) : null}
          <View style={styles.stage}>{renderStage()}</View>
        </View>

        {/* Around you */}
        <View style={styles.section}>
          <Section title="AROUND YOU" />
          <View style={styles.mapPad}>
            <PressableScale onPress={handleOpenExplore} scaleTo={0.98} style={styles.map}
              accessibilityRole="button" accessibilityLabel={`Open the map of ${spaCount} spas around you`}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                userInterfaceStyle="dark"
                onMapReady={handleMapReady}
                initialRegion={{
                  latitude: location?.latitude ?? 17.41217,
                  longitude: location?.longitude ?? 78.42293,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                }}>
                {location?.latitude != null && location?.longitude != null ? (
                  <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }}>
                    <View style={styles.me} />
                  </Marker>
                ) : null}
                {previewSpas.map((spa) => (
                  <Marker key={spa.id} coordinate={{ latitude: spa.latitude, longitude: spa.longitude }}>
                    <View style={styles.spot} />
                  </Marker>
                ))}
              </MapView>
              <View style={styles.mapBar}>
                <View style={styles.flex}>
                  <Text style={styles.mapTitle}>
                    {spaCount > 0 ? `${spaCount} spa${spaCount === 1 ? '' : 's'} around you` : 'Spas around you'}
                  </Text>
                  {nearest ? <Text variant="caption" color={colors.muted}>Nearest is {nearest.distance} away</Text> : null}
                </View>
                <View style={styles.mapCta}>
                  <Text style={styles.mapCtaText}>Explore map</Text>
                </View>
              </View>
            </PressableScale>
          </View>
        </View>

        {/* All spas near you */}
        {spaCount > 0 ? (
          <View style={styles.section}>
            <Section title="ALL SPAS NEAR YOU" sub={`Closest first · ${spaCount} spa${spaCount === 1 ? '' : 's'}`} />
            <View style={styles.list}>
              {nearbyClosestFirst.map((item, i) => (
                <Outlet key={item.id} item={item} delay={30 + Math.min(i, 5) * 70} onPress={() => handlePressSpaCard(item.id)} />
              ))}
              {pagination?.hasMore ? (
                <Button
                  label="Show more spas"
                  variant="secondary"
                  size="md"
                  loading={loadingMore}
                  disabled={loadingMore}
                  onPress={loadNextPage}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  gutter: { paddingHorizontal: 16 },
  // Room for the current floating tab bar.
  content: { paddingBottom: 130 },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    height: 44,
    maxWidth: 240,
    borderRadius: radii.pill,
    backgroundColor: colors.soft,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 14,
  },
  pillText: { flexShrink: 1 },
  pillPrimary: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 15, color: colors.text },
  pillSecondary: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 13, color: colors.muted },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.soft,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  searchBox: {
    marginTop: 14,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.s1,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, paddingVertical: 0 },
  h1: { marginTop: 26 },

  types: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCell: { width: '30%', flexGrow: 1 },
  typeWideCell: { width: '100%' },
  type: {
    height: 112,
    padding: 12,
    borderRadius: radii.lg,
    experimental_backgroundImage: 'linear-gradient(180deg, #221D18 0%, #1A1612 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,240,224,0.14), inset 0 0 0 1px rgba(255,240,224,0.08)',
    overflow: 'hidden',
  },
  typeIcon: { marginBottom: 'auto', alignSelf: 'flex-start' },
  typeIconShadow: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 5, shadowOffset: { width: 0, height: 6 } },
  typeRing: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    borderRadius: radii.lg,
    boxShadow: 'inset 0 0 0 1px rgba(255,176,46,0.5)',
  },
  typeWide: { height: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeTitle: { fontFamily: fonts.display, fontSize: 14, lineHeight: 18, color: colors.text },
  typeSub: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.muted, marginTop: 2 },

  nextWrap: { marginTop: 20, marginHorizontal: 16 },
  upcoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 22,
    boxShadow: 'inset 0 0 0 1px rgba(255,176,46,0.3), 0 14px 30px rgba(255,176,46,0.08)',
  },
  datebox: {
    width: 58,
    height: 62,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSmall: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 12, letterSpacing: 0.9, color: colors.onBrandMuted },
  dateDay: { fontFamily: fonts.display, fontSize: 23, lineHeight: 26, color: colors.onBrand },
  upLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  upDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  upLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.muted },
  upName: { marginTop: 3 },
  iconRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.s2,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { marginTop: 42 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  secLine: { flex: 1, height: 1 },
  secLineLeft: { experimental_backgroundImage: 'linear-gradient(90deg, rgba(255,240,224,0), rgba(255,240,224,0.16))' },
  secLineRight: { experimental_backgroundImage: 'linear-gradient(90deg, rgba(255,240,224,0.16), rgba(255,240,224,0))' },
  secText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 14, letterSpacing: 2.16, color: colors.brand2 },
  picks: { marginTop: 10, paddingHorizontal: 16, textAlign: 'center', fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  picksBold: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  chips: { gap: 8, paddingHorizontal: 16, marginTop: 16 },

  stage: { marginTop: 16 },
  flow: { paddingVertical: 8 },
  slot: { alignItems: 'center', justifyContent: 'center' },
  poster: {
    borderRadius: radii.poster,
    overflow: 'hidden',
    backgroundColor: colors.s1,
    boxShadow: '0 16px 32px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,240,224,0.08)',
  },
  dim: { backgroundColor: '#000' },
  mono: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'radial-gradient(circle at 70% 18%, #3B3229 0%, #221D18 62%)',
  },
  monoText: { fontFamily: fonts.display, fontSize: 92, lineHeight: 100, letterSpacing: -4.6, color: colors.cream },
  pTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: '85%',
    height: 24,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18,16,14,0.66)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
    justifyContent: 'center',
  },
  pTagText: { fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 0.8, color: colors.text },
  caption: { marginTop: 18, paddingHorizontal: 32, alignItems: 'center', gap: 4 },
  captionName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.text, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap', paddingHorizontal: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.s3 },
  dotOn: { width: 20, backgroundColor: colors.text },
  stageMsg: {
    marginHorizontal: 40,
    minHeight: 220,
    borderRadius: radii.card,
    backgroundColor: colors.s1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  stageTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.text, textAlign: 'center' },
  stageBtn: { marginTop: 8 },

  mapPad: { paddingTop: 18, paddingHorizontal: 16 },
  map: {
    height: 204,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.map,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
  },
  me: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.me,
    boxShadow: '0 0 0 5px rgba(142,197,255,0.18)',
  },
  spot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand,
    boxShadow: `0 0 0 4px ${brandAlpha(0.18)}`,
  },
  mapBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingRight: 10,
    paddingLeft: 14,
    borderRadius: radii.md,
    backgroundColor: 'rgba(29,25,21,0.92)',
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
  },
  mapTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.text },
  mapCta: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    justifyContent: 'center',
  },
  mapCtaText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },

  list: { paddingTop: 16, paddingHorizontal: 16, gap: 14 },
  outlet: {
    backgroundColor: colors.s1,
    borderRadius: radii.xl,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
    overflow: 'hidden',
  },
  oTop: { flexDirection: 'row', gap: 12, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12 },
  oLogo: {
    width: 50,
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.s2,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  oLogoImg: { width: 50, height: 50 },
  oLogoText: { fontFamily: fonts.display, fontSize: 17, color: colors.cream },
  oMeta: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
  oStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.edge,
  },
  oStripText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  oStripBold: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.text },
});
