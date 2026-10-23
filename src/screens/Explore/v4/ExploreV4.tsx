import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  useBottomSheetTimingConfigs,
  useScrollEventsHandlersDefault,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps, ScrollEventsHandlersHookType } from '@gorhom/bottom-sheet';
import Svg, { Circle, Path } from 'react-native-svg';
import MapView, { Marker, PROVIDER_GOOGLE, type MapMarker } from 'react-native-maps';

import { BackButton, Button, FitImage, PressableScale, RoundButton, Text } from '../../../components/ui';
import { brandAlpha, colors, fadeIn, fonts, motion, radii, rise, shadows } from '../../../theme';
import type { ExploreSpa } from '../../../types/explore';
import type { useExploreScreen } from '../../../hooks/useExploreScreen';
import { bookingOption } from '../../Booking/bookingData';
import SpaDetailsV4, { type SpaDetailsSheet } from '../../Home/v4/SpaDetailsV4';
import BookingSummarySheet from '../../Booking/components/BookingSummarySheet';
import { slotMinutes } from '../../Booking/slotFormat';
import { formatRatingLabel } from '../../../utils/number';

type Props = ReturnType<typeof useExploreScreen>;

const MAP_DELTA = { latitudeDelta: 0.018, longitudeDelta: 0.018 };
// Must match the hook's CARD_SPACING / CARD_SIDE_PADDING: its snapInterval and
// scroll offsets assume them.
const CARD_SPACING = 14;
const CARD_SIDE_PADDING = 24;
const CARD_HEIGHT = 160;

const GLASS = 'rgba(29,25,21,0.88)';
const GLASS_SHADOW = `${shadows.ringHi}, 0 8px 20px rgba(0,0,0,0.4)`;

/**
 * The sheet's scroll view for v4 Spa Details. It keeps the sheet's own scroll
 * handling (so drags pass between sheet and content) and also writes the
 * offset into `scrollY`, on the UI thread, for the page's fading header bar.
 */
const makeSheetScroll = (scrollY: SharedValue<number>) => {
  const useHandlers: ScrollEventsHandlersHookType = (ref, contentOffsetY) => {
    const handlers = useScrollEventsHandlersDefault(ref, contentOffsetY);
    const { handleOnScroll } = handlers;
    return {
      ...handlers,
      handleOnScroll: (event, context) => {
        'worklet';
        handleOnScroll?.(event, context);
        scrollY.value = event.contentOffset.y;
      },
    };
  };
  return forwardRef<React.ComponentRef<typeof BottomSheetScrollView>, React.ComponentProps<typeof BottomSheetScrollView>>(
    (props, ref) => <BottomSheetScrollView ref={ref} {...props} scrollEventsHandlersHook={useHandlers} />,
  ) as unknown as NonNullable<SpaDetailsSheet['ScrollComponent']>;
};

const CardSeparator: React.FC = () => <View style={styles.cardSeparator} />;

type PinProps = { spa: ExploreSpa; selected: boolean; onPress: (spa: ExploreSpa) => void };

const SpaPin = memo<PinProps>(({ spa, selected, onPress }) => {
  const markerRef = useRef<MapMarker | null>(null);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // Android draws markers as cached bitmaps: re-capture after the pin changes
  // or its photo loads, or the new look never shows.
  const redraw = useCallback(() => {
    if (Platform.OS === 'android') markerRef.current?.redraw();
  }, []);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
      redraw();
    }, 250);
    return () => clearTimeout(timer);
  }, [selected, redraw]);

  const handleImageLoad = useCallback(() => {
    redraw();
    setTimeout(redraw, 150);
  }, [redraw]);

  if (spa.latitude == null || spa.longitude == null) return null;

  return (
    <Marker
      ref={markerRef}
      coordinate={{ latitude: spa.latitude, longitude: spa.longitude }}
      onPress={() => onPress(spa)}
      tracksViewChanges={tracksViewChanges}
      zIndex={selected ? 999 : 1}
      anchor={{ x: 0.5, y: 1 }}
      accessibilityLabel={`${spa.name}, rated ${formatRatingLabel(spa.rating)}`}>
      <View style={styles.pinWrap}>
        <View style={[styles.pin, selected && styles.pinOn]}>
          {selected ? (
            <Image source={{ uri: spa.image }} style={styles.pinImage} fadeDuration={0} onLoad={handleImageLoad} />
          ) : null}
          <Text style={[styles.pinText, selected && styles.pinTextOn]}>★ {formatRatingLabel(spa.rating)}</Text>
        </View>
        <View style={[styles.pinTail, selected && styles.pinTailOn]} />
      </View>
    </Marker>
  );
});

export default function ExploreV4({
  booking,
  bookingDetails,
  bookingFeeText,
  cardListBottom,
  cardWidth,
  emptyState,
  handleBackPress,
  handleBookSpa,
  handleCurrentLocation,
  handleMapReady,
  handleMarkerPress,
  handleMomentumEnd,
  handleProceedBooking,
  handleRetryDetails,
  insets,
  listRef,
  loadNextPage,
  loading,
  loadingMore,
  location,
  mapReattached,
  mapRef,
  origin,
  retrySpas,
  selectSpa,
  selectedSpa,
  selectedSpaId,
  setSheetIndex,
  sheetIndex,
  sheetRef,
  snapInterval,
  snapPoints,
  spaDetails,
  spaDetailsError,
  spaDetailsLoading,
  spas,
  spasError,
  width,
}: Props) {
  // v4 Spa Details in the sheet: its header follows the sheet's scroll and
  // slides below the status bar as the sheet goes from 75% to full screen.
  const detailsScrollY = useSharedValue(0);
  const sheetIndexValue = useSharedValue(-1);
  const detailsExpand = useSharedValue(0);
  useAnimatedReaction(
    () => sheetIndexValue.value,
    (index) => {
      detailsExpand.value = Math.min(Math.max(index - 1, 0), 1);
    },
  );
  const SheetScroll = useMemo(() => makeSheetScroll(detailsScrollY), [detailsScrollY]);
  const closeSheet = useCallback(() => sheetRef.current?.close(), [sheetRef]);
  const detailsSheet = useMemo<SpaDetailsSheet>(
    () => ({ scrollY: detailsScrollY, expand: detailsExpand, onClose: closeSheet, ScrollComponent: SheetScroll }),
    [detailsScrollY, detailsExpand, closeSheet, SheetScroll],
  );
  const sheetAnimation = useBottomSheetTimingConfigs({ duration: 420, easing: motion.out });

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} pressBehavior="close" />
    ),
    [],
  );

  const renderSpaCard = useCallback(
    ({ item }: ListRenderItemInfo<ExploreSpa>) => {
      const selected = item.id === selectedSpaId;
      return (
        <PressableScale
          style={[styles.card, { width: cardWidth }, selected ? styles.cardOn : styles.cardDim]}
          onPress={() => selectSpa(item, { openSheet: true })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}>
          <FitImage uri={item.image} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <Text variant="cardTitle" numberOfLines={1}>{item.name}</Text>
            <Text variant="caption" color={colors.muted} numberOfLines={1} style={styles.cardArea}>
              {item.address}{item.distance ? ` · ${item.distance}` : ''}
            </Text>
            <Text style={styles.cardRating}>
              ★ {formatRatingLabel(item.rating)}
              {item.reviewCount > 0 ? (
                <Text style={styles.cardReviews}> ({formatReviewCount(item.reviewCount)})</Text>
              ) : null}
            </Text>
            {/* Only a known status is shown; "Unknown" told the user nothing. */}
            {item.isOpen !== null ? (
              <View style={styles.slots}>
                <View style={[styles.slot, item.isOpen === false && styles.slotClosed]}>
                  <Text style={[styles.slotText, item.isOpen === false && styles.slotTextClosed]}>
                    {item.isOpen ? 'Open now' : 'Closed today'}
                  </Text>
                </View>
              </View>
            ) : null}
            <Button
              label="Book"
              size="sm"
              sheen
              onPress={() => handleBookSpa(item)}
              accessibilityLabel={`Book ${item.name}`}
              style={styles.book}
            />
          </View>
        </PressableScale>
      );
    },
    [cardWidth, handleBookSpa, selectSpa, selectedSpaId],
  );

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.listFooter}>
          <ActivityIndicator size="small" color={colors.brand} />
        </View>
      );
    }
    if (spasError && spas.length > 0) {
      return (
        <View style={styles.listFooter}>
          <RoundButton onPress={retrySpas} accessibilityLabel="Retry loading more spas">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.brand} strokeWidth={2.2} strokeLinecap="round">
              <Path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" strokeLinejoin="round" />
            </Svg>
          </RoundButton>
        </View>
      );
    }
    return null;
  }, [loadingMore, spasError, spas.length, retrySpas]);

  const controlsVisible = sheetIndex < 2;
  const spaCount = spas.length;

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} collapsable={!mapReattached}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={StyleSheet.absoluteFill}
          userInterfaceStyle="dark"
          initialRegion={{ ...origin, ...MAP_DELTA }}
          onMapReady={handleMapReady}
          showsUserLocation={location?.permission === 'granted'}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          zoomEnabled
          rotateEnabled
          scrollEnabled
          pitchEnabled>
          {spas.map((spa) => (
            <SpaPin key={spa.id} spa={spa} selected={spa.id === selectedSpaId} onPress={handleMarkerPress} />
          ))}
        </MapView>
      </View>
      <View style={styles.vignette} pointerEvents="none" />

      {controlsVisible ? (
        <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
          <BackButton onPress={handleBackPress} style={styles.glass} />
          {spaCount > 0 ? (
            <Animated.View entering={rise(500, 8)} style={styles.count} accessibilityRole="text" accessibilityLiveRegion="polite">
              <View style={styles.countDot} />
              <Text style={styles.countText}>{spaCount} spa{spaCount === 1 ? '' : 's'} around you</Text>
            </Animated.View>
          ) : null}
          <View style={styles.topSpacer} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.locating, { top: insets.top + 64 }]}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={styles.countText}>Finding location</Text>
        </View>
      ) : null}

      {controlsVisible ? (
        <RoundButton
          onPress={handleCurrentLocation}
          accessibilityLabel="Show my location"
          style={[styles.glass, styles.locate, { bottom: cardListBottom + CARD_HEIGHT + 24 }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round">
            <Circle cx={12} cy={12} r={4} />
            <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </Svg>
        </RoundButton>
      ) : null}

      {emptyState ? (
        <Animated.View
          entering={fadeIn()}
          style={[styles.emptyCard, { bottom: cardListBottom, width: cardWidth }]}
          accessibilityRole="summary">
          {emptyState.action ? null : <ActivityIndicator size="small" color={colors.brand} />}
          <Text variant="cardTitle" style={styles.center}>{emptyState.title}</Text>
          {emptyState.subtitle ? (
            <Text variant="bodySm" color={colors.muted} style={styles.center}>{emptyState.subtitle}</Text>
          ) : null}
          {emptyState.action ? (
            <Button label={emptyState.action.label} size="sm" onPress={emptyState.action.onPress} style={styles.emptyAction} />
          ) : null}
        </Animated.View>
      ) : null}

      {/* Kept mounted under the full-height sheet so its scroll position survives. */}
      <FlatList<ExploreSpa>
        ref={listRef}
        pointerEvents={sheetIndex === 2 ? 'none' : 'auto'}
        data={spas}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderSpaCard}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={styles.cardListContent}
        ItemSeparatorComponent={CardSeparator}
        getItemLayout={(_, index) => ({ length: snapInterval, offset: snapInterval * index, index })}
        style={[styles.cardList, { bottom: cardListBottom }]}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        onChange={setSheetIndex}
        enablePanDownToClose
        animateOnMount={false}
        enableOverDrag
        enableContentPanningGesture
        enableHandlePanningGesture
        animationConfigs={sheetAnimation}
        animatedIndex={sheetIndexValue}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        style={styles.sheet}
        handleStyle={styles.sheetHandleArea}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}>
        {selectedSpa ? (
          <SpaDetailsV4
            // Remount per spa so the photo, scroll and "show all" start fresh.
            key={selectedSpa.id}
            isTablet={width >= 768}
            spa={spaDetails}
            loading={spaDetailsLoading}
            refreshing={false}
            error={spaDetailsError}
            refetch={async () => handleRetryDetails()}
            // Pull-to-refresh is off in sheet mode; the sheet's drag closes it instead.
            handleRefresh={async () => handleRetryDetails()}
            handleBack={closeSheet}
            handleProceedBooking={handleProceedBooking}
            booking={booking}
            bookingOption={bookingOption}
            bookingFeeText={bookingFeeText}
            sheet={detailsSheet}
          />
        ) : null}
      </BottomSheet>

      <BookingSummarySheet
        visible={booking.summaryVisible && Boolean(booking.selectedSlot)}
        loading={booking.submitting}
        onClose={booking.closeSummary}
        onDismissed={booking.onSummaryDismissed}
        onConfirm={booking.confirmBooking}
        spaName={bookingDetails.spaName}
        spaImage={bookingDetails.spaImage}
        location={bookingDetails.location}
        dateLabel={booking.summaryDateLabel}
        timeLabel={booking.summaryTimeLabel}
        slotDurationMinutes={slotMinutes(booking.selectedSlot)}
        serviceName={bookingDetails.serviceName}
        bookingFeeText={bookingFeeText}
        bookingFeeNote={bookingOption.description}
      />
    </View>
  );
}

const formatReviewCount = (count: number) =>
  count >= 1000 ? `${Number((count / 1000).toFixed(1))}K` : String(count);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.map },
  vignette: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(18,16,14,0.85) 0%, rgba(18,16,14,0) 22%, rgba(18,16,14,0) 58%, rgba(18,16,14,0.9) 100%)',
  },
  center: { textAlign: 'center' },

  pinWrap: { alignItems: 'center', paddingHorizontal: 4, paddingBottom: 2 },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.s2,
    borderWidth: 1,
    borderColor: colors.edgeHi,
  },
  pinOn: { height: 42, paddingLeft: 7, paddingRight: 14, backgroundColor: colors.brand, borderColor: colors.brand },
  pinImage: { width: 28, height: 28, borderRadius: 14 },
  pinText: { fontFamily: fonts.display, fontSize: 12, lineHeight: 15, color: colors.text },
  pinTextOn: { color: colors.onBrand },
  pinTail: {
    width: 10,
    height: 10,
    marginTop: -6,
    backgroundColor: colors.s2,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.edgeHi,
    borderBottomRightRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  pinTailOn: { backgroundColor: colors.brand, borderColor: colors.brand },

  top: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSpacer: { width: 44 },
  glass: { backgroundColor: GLASS, boxShadow: GLASS_SHADOW },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: GLASS,
    boxShadow: shadows.ringHi,
  },
  countDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, boxShadow: `0 0 0 3px ${brandAlpha(0.25)}` },
  countText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 15, color: colors.text },
  locating: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: GLASS,
    boxShadow: shadows.ringHi,
  },
  locate: { position: 'absolute', right: 16 },

  cardList: { position: 'absolute', left: 0, right: 0 },
  cardListContent: { alignItems: 'flex-end', paddingHorizontal: CARD_SIDE_PADDING, paddingVertical: 6 },
  cardSeparator: { width: CARD_SPACING },
  card: {
    height: CARD_HEIGHT,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: radii.card,
    backgroundColor: 'rgba(29,25,21,0.94)',
  },
  cardOn: { boxShadow: `inset 0 0 0 1px ${brandAlpha(0.35)}, 0 16px 36px rgba(0,0,0,0.55)` },
  cardDim: { opacity: 0.45, transform: [{ scale: 0.95 }], boxShadow: `${shadows.ringHi}, 0 16px 36px rgba(0,0,0,0.55)` },
  cardImage: { width: 96, height: 140, borderRadius: radii.md },
  cardBody: { flex: 1, minWidth: 0 },
  cardArea: { marginTop: 2, lineHeight: 16 },
  cardRating: { marginTop: 6, fontFamily: fonts.display, fontSize: 12, lineHeight: 15, color: colors.text },
  cardReviews: { fontFamily: fonts.bodyMedium, color: colors.muted },
  slots: { marginTop: 10, flexDirection: 'row', gap: 6 },
  slot: {
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 9,
    justifyContent: 'center',
    boxShadow: `inset 0 0 0 1px ${brandAlpha(0.3)}`,
  },
  slotClosed: { boxShadow: shadows.ringHi },
  slotText: { fontFamily: fonts.display, fontSize: 11, lineHeight: 14, color: colors.brand2 },
  slotTextClosed: { color: colors.muted },
  book: { marginTop: 'auto', height: 44, borderRadius: radii.sm },

  listFooter: { width: 64, height: CARD_HEIGHT, alignItems: 'center', justifyContent: 'center' },

  emptyCard: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: radii.card,
    backgroundColor: 'rgba(29,25,21,0.94)',
    boxShadow: `${shadows.ringHi}, 0 16px 36px rgba(0,0,0,0.55)`,
  },
  emptyAction: { marginTop: 4 },

  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  sheetBackground: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.bg },
  // Floats over the photo instead of taking a strip above it.
  sheetHandleArea: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingTop: 8 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(251,243,232,0.7)' },
});
