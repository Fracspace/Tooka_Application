import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, Button, Card, Icon, PressableScale, RoundButton, Screen, Text } from '../../../components/ui';
import { brandAlpha, colors, fonts, gradients, motion, radii, rise, useReduceMotion } from '../../../theme';
import { useSpaDetailsContentState } from '../../../hooks/useSpaDetailsContentState';
import type { useSpaDetailsScreen } from '../../../hooks/useSpaDetailsScreen';
import type { TimeSlot } from '../../Booking/types';
import SpaDetailsSkeleton, { SlotBones } from './SpaDetailsSkeleton';
import { formatDateSubLabel, formatServicePrice } from '../spaDetailsFormat';

/**
 * Set when Spa Details is shown as a card in the Home spotlight pager: the
 * pager grows the card with the scroll position, and pulling down at the top
 * (or the chevron) closes it.
 */
export type SpaDetailsSheet = {
  scrollY: SharedValue<number>;
  /** 0 while the card is small, 1 once it fills the screen. */
  expand: SharedValue<number>;
  onClose: () => void;
  /**
   * Set when the page sits inside a gorhom BottomSheet (Explore): its own
   * scroll view, which must report the offset into `scrollY` itself, since the
   * sheet needs the scroll events to hand drags between sheet and content.
   */
  ScrollComponent?: React.ComponentType<React.ComponentProps<typeof Animated.ScrollView>>;
};

/** How far past the top a pull has to go to close the card. */
const PULL_TO_CLOSE = 80;

type Props = Omit<ReturnType<typeof useSpaDetailsScreen>, 'bookingDetails' | 'summaryLocation'> & {
  sheet?: SpaDetailsSheet;
};

const HERO_HEIGHT = 420;

// Slots grouped the way the design shows them. Unknown times go in one unlabelled group.
const groupSlots = (slots: TimeSlot[]) => {
  const groups: { label: string; slots: TimeSlot[] }[] = [];
  slots.forEach((slot) => {
    const hour = parseInt(slot.startTime?.split(':')[0] ?? '', 10);
    let label = '';
    if (Number.isFinite(hour)) {
      label = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';
    }
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.slots.push(slot);
    else groups.push({ label, slots: [slot] });
  });
  return groups;
};

const formatReviewDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Spa's own maps link first, then its coordinates, then a search by name and address.
const directionsUrl = (spa: NonNullable<Props['spa']>, address: string): string => {
  const mapUrl = spa.google_maps_url?.trim();
  if (mapUrl) return mapUrl;
  const lat = Number(spa.lat);
  const lng = Number(spa.lng);
  const query = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
    ? `${lat},${lng}`
    : `${spa.name} ${address}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const openLink = async (url: string, failTitle: string, failBody: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(failTitle, failBody);
  }
};

function LiveChip({ open }: { open: boolean }) {
  return (
    <View style={[styles.live, !open && styles.liveClosed]}>
      <View style={[styles.liveDot, !open && styles.liveDotClosed]} />
      <Text style={[styles.liveText, !open && styles.liveTextClosed]}>{open ? 'Open now' : 'Closed now'}</Text>
    </View>
  );
}

function SpaDetailsV4({
  spa,
  loading,
  refreshing,
  error,
  refetch,
  handleRefresh,
  handleBack,
  handleProceedBooking,
  booking,
  bookingOption,
  bookingFeeText,
  sheet,
}: Props): React.ReactElement {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [hoursOpen, setHoursOpen] = useState(false);

  const {
    isBookable,
    spaName,
    showAllTreatments,
    setShowAllTreatments,
    formattedHours,
    hasAnyHours,
    ratingDisplay,
    spaLocation,
    services,
    visibleServices,
    mediaItems,
    hasRealPhotos,
    currentImageIndex,
    handleSelectThumbnail,
    trustBadges,
    amenitiesList,
    isOpenNow,
    firstAvailableSlot,
    selectedSlot,
  } = useSpaDetailsContentState({
    spa,
    slots: booking.timeSlots,
    selectedSlotId: booking.selectedSlotId,
  });

  // Hero photo strip slides to the current photo.
  const stripX = useSharedValue(0);
  useEffect(() => {
    const to = -currentImageIndex * width;
    stripX.value = reduceMotion ? to : withTiming(to, { duration: motion.rise, easing: motion.out });
  }, [currentImageIndex, width, reduceMotion, stripX]);
  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: stripX.value }] }));

  // The header gets a solid bar and the spa's name once the photo scrolls away.
  const ownScrollY = useSharedValue(0);
  const SheetScroll = sheet?.ScrollComponent;
  const scrollY = SheetScroll && sheet ? sheet.scrollY : ownScrollY;
  const sheetScrollY = sheet?.scrollY;
  const sheetClose = sheet?.onClose;
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      if (sheetScrollY) sheetScrollY.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      if (sheetClose && e.contentOffset.y < -PULL_TO_CLOSE) runOnJS(sheetClose)();
    },
  });
  // In the pager the card starts below the status bar; the header moves down
  // under it as the card grows to full screen.
  const sheetExpand = sheet?.expand;
  const headerTop = sheet ? 12 : insets.top + 6;
  const headerShift = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetExpand ? insets.top * sheetExpand.value : 0 }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_HEIGHT - 160, HERO_HEIGHT - 90], [0, 1], 'clamp'),
  }));

  const slotGroups = useMemo(() => groupSlots(booking.timeSlots), [booking.timeSlots]);
  const ratingValue = Number(spa?.rating_google);
  const reviewCount = Number(spa?.review_count_google);
  const reviews = (spa?.reviews ?? []).filter((r) => r && (r.comment || r.rating != null));
  const amenityCount = trustBadges.length + amenitiesList.length;
  const photoCount = hasRealPhotos ? mediaItems.length : 0;
  const hasLocation = spaLocation !== 'Location unavailable';
  const phone = spa?.phone?.replace(/[^\d+]/g, '') ?? '';
  const selectedDate = booking.scheduleDates.find((d) => d.id === booking.selectedDateId);
  const hasSlot = Boolean(booking.selectedSlot);
  const ctaDisabled = !isBookable || !hasSlot || booking.submitting;

  if (!spa && !(error && !loading)) return <SpaDetailsSkeleton heroHeight={HERO_HEIGHT} />;

  if (!spa) {
    return (
      <Screen style={styles.center}>
        {error && !loading ? (
          <View style={styles.stateBox}>
            <Text variant="title" style={styles.centerText}>Couldn't load this spa</Text>
            <Text variant="bodySm" color={colors.muted} style={styles.centerText}>{error}</Text>
            <Button label="Try again" variant="secondary" onPress={refetch} style={styles.stateBtn} />
            <Button label="Go back" variant="ghost" onPress={handleBack} />
          </View>
        ) : null}
      </Screen>
    );
  }

  const goPhoto = (step: number) =>
    handleSelectThumbnail((currentImageIndex + step + mediaItems.length) % mediaItems.length);

  let dockTitle = 'Pick a time';
  if (!isBookable) dockTitle = 'Booking unavailable';
  else if (selectedSlot) dockTitle = selectedDate ? `${selectedDate.label}, ${selectedSlot.label}` : selectedSlot.label;

  const Scroller = SheetScroll ?? Animated.ScrollView;

  return (
    <Screen>
      <Scroller
        onScroll={SheetScroll ? undefined : onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 + insets.bottom }}
        refreshControl={
          sheet ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} progressViewOffset={insets.top} />
          )
        }
      >
        {/* Hero photos */}
        <View style={styles.hero} accessibilityLabel={`Photos of ${spaName}`}>
          <Animated.View style={[styles.strip, { width: width * mediaItems.length }, stripStyle]}>
            {mediaItems.map((uri, i) => (
              <Image key={`${uri}-${i}`} source={{ uri }} style={{ width, height: HERO_HEIGHT }} resizeMode="cover" />
            ))}
          </Animated.View>
          <View style={styles.heroShade} pointerEvents="none" />
          {photoCount > 1 ? (
            <>
              <Pressable style={[styles.tapzone, styles.tapLeft]} onPress={() => goPhoto(-1)} accessibilityRole="button" accessibilityLabel="Previous photo" />
              <Pressable style={[styles.tapzone, styles.tapRight]} onPress={() => goPhoto(1)} accessibilityRole="button" accessibilityLabel="Next photo" />
              <View style={styles.segs} pointerEvents="none">
                {mediaItems.map((uri, i) => (
                  <View key={`seg-${uri}-${i}`} style={[styles.seg, i === currentImageIndex && styles.segOn]} />
                ))}
              </View>
              <View style={styles.count} pointerEvents="none">
                <Ionicons name="images-outline" size={13} color={colors.text} />
                <Text style={styles.countText}>{`${currentImageIndex + 1} / ${photoCount}`}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Intro */}
        <View style={styles.intro}>
          {isOpenNow !== null || spa.is_verified ? (
            <Animated.View entering={rise(80)} style={styles.chipRow}>
              {isOpenNow !== null ? <LiveChip open={isOpenNow} /> : null}
              {spa.is_verified ? (
                <View style={styles.tagv}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.sage} />
                  <Text style={styles.tagvText}>Verified</Text>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
          <Animated.View entering={rise(140)}>
            <Text variant="hero" style={styles.name}>{spaName}</Text>
          </Animated.View>
          <Animated.View entering={rise(200)} style={styles.rateRow}>
            <Ionicons name="star" size={14} color={ratingDisplay.isRated ? colors.brand : colors.subtle} />
            <Text style={styles.rateText}>{ratingDisplay.text}</Text>
          </Animated.View>
          {hasLocation ? (
            <Animated.View entering={rise(260)} style={styles.addrRow}>
              <Icon name="pin" size={15} color={colors.muted} />
              <Text variant="bodySm" color={colors.muted} style={styles.flex}>{spaLocation}</Text>
            </Animated.View>
          ) : null}
        </View>

        {/* Pick a time */}
        {booking.scheduleDates.length > 0 ? (
          <Animated.View entering={rise(320)}>
            <Card style={styles.timeCard}>
              <Text variant="title">Pick a time</Text>
              <View style={styles.days} accessibilityRole="tablist">
                {booking.scheduleDates.map((d) => {
                  const on = d.id === booking.selectedDateId;
                  const sub = formatDateSubLabel(d.date);
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => booking.selectDate(d.id)}
                      accessibilityRole="tab"
                      accessibilityLabel={sub ? `${d.label}, ${sub}` : d.label}
                      accessibilityState={{ selected: on }}
                      style={[styles.day, on && styles.dayOn]}
                    >
                      <Text style={[styles.dayLabel, on && styles.dayTextOn]}>{d.label}</Text>
                      {sub ? <Text style={[styles.daySub, on && styles.dayTextOn]}>{sub}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>

              {booking.loadingSlots ? (
                <View accessibilityLabel="Checking availability">
                  <SlotBones />
                </View>
              ) : booking.availabilityError ? (
                <View style={styles.slotState}>
                  <Text variant="itemTitle">Unable to load slots</Text>
                  <Text variant="bodySm" color={colors.muted} style={styles.centerText}>{booking.availabilityError}</Text>
                </View>
              ) : booking.timeSlots.length === 0 ? (
                <View style={styles.slotState}>
                  <Text variant="itemTitle">No slots available</Text>
                  <Text variant="bodySm" color={colors.muted}>Please pick another day.</Text>
                </View>
              ) : (
                slotGroups.map((grp, gi) => (
                  <View key={`${grp.label}-${gi}`}>
                    {grp.label ? (
                      <View style={styles.grp}>
                        <Text style={styles.grpText}>{grp.label}</Text>
                        <View style={styles.grpLine} />
                      </View>
                    ) : null}
                    <View style={styles.slots}>
                      {grp.slots.map((s) => {
                        const on = s.id === booking.selectedSlotId;
                        const off = s.status !== 'available';
                        const soonest = !on && !off && firstAvailableSlot?.id === s.id;
                        return (
                          <PressableScale
                            key={s.id}
                            disabled={off}
                            onPress={() => booking.selectSlot(s.id)}
                            scaleTo={0.94}
                            accessibilityRole="radio"
                            accessibilityLabel={off ? `${s.label}, unavailable` : s.label}
                            accessibilityState={{ checked: on, disabled: off }}
                            style={[styles.slot, on && styles.slotOn, off && styles.slotOff]}
                          >
                            {soonest ? (
                              <View style={styles.soon}>
                                <Text style={styles.soonText}>SOONEST</Text>
                              </View>
                            ) : null}
                            <Text style={[styles.slotText, on && styles.slotTextOn, off && styles.slotTextOff]}>{s.label}</Text>
                            {on ? (
                              <View style={styles.tick}>
                                <Icon name="check" size={12} color={colors.ink} strokeWidth={3} />
                              </View>
                            ) : null}
                          </PressableScale>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}

              <View style={styles.tip}>
                <Icon name="clock" size={14} color={colors.muted} />
                <Text variant="caption" color={colors.muted}>Arrive 5–10 minutes early for a relaxed start.</Text>
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {/* How it works */}
        <View style={styles.section}>
          <Text variant="title">How it works</Text>
          <Text variant="bodySm" color={colors.muted} style={styles.sub}>
            You only book the slot. Pick your treatment when you get there.
          </Text>
          <View style={styles.steps}>
            <View style={styles.stepLine} />
            {[
              { icon: 'lock-closed-outline', title: bookingFeeText ? `Pay ${bookingFeeText}` : 'Pay to book', sub: 'holds your slot' },
              { icon: 'sparkles-outline', title: 'Choose there', sub: 'any treatment on the menu' },
              { icon: 'wallet-outline', title: 'Pay at spa', sub: 'for the treatment' },
            ].map((st) => (
              <View key={st.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Ionicons name={st.icon} size={18} color={colors.text} />
                </View>
                <Text style={styles.stepTitle}>{st.title}</Text>
                <Text variant="caption" color={colors.muted} style={styles.centerText}>{st.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Treatment menu */}
        {services.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.headRow}>
              <Text variant="title">Treatment menu</Text>
              <Text variant="caption" color={colors.muted}>Choose at the spa</Text>
            </View>
            <Card style={styles.menuCard}>
              {visibleServices.map((item, i) => {
                const price = formatServicePrice(item.base_price, item.currency);
                const meta = [
                  item.duration_minutes != null ? `${item.duration_minutes} min` : null,
                  item.category ?? null,
                ].filter(Boolean).join(' · ');
                return (
                  <View key={item.id} style={[styles.treat, i > 0 && styles.divider]}>
                    <View style={styles.flex}>
                      <Text style={styles.treatTitle}>{item.name}</Text>
                      {meta ? <Text variant="caption" color={colors.muted}>{meta}</Text> : null}
                    </View>
                    {price ? <Text variant="price">{price}</Text> : null}
                  </View>
                );
              })}
              {services.length > 3 ? (
                <Pressable
                  onPress={() => setShowAllTreatments((prev) => !prev)}
                  style={[styles.more, styles.divider]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllTreatments }}
                >
                  <Text style={styles.moreText}>{showAllTreatments ? 'Show less' : `See all ${services.length} treatments`}</Text>
                  <View style={showAllTreatments && styles.flip}>
                    <Icon name="chevronDown" size={16} color={colors.text} />
                  </View>
                </Pressable>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* Ratings & reviews */}
        <View style={styles.section}>
          <Text variant="title">Ratings & reviews</Text>
          {ratingDisplay.isRated && Number.isFinite(ratingValue) ? (
            <Card style={styles.scoreCard}>
              <Text style={styles.score}>{ratingValue.toFixed(1)}</Text>
              <View>
                <View style={styles.stars} accessibilityLabel={`${ratingValue.toFixed(1)} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={ratingValue >= n ? 'star' : ratingValue >= n - 0.5 ? 'star-half' : 'star-outline'}
                      size={16}
                      color={colors.brand}
                    />
                  ))}
                </View>
                {Number.isFinite(reviewCount) && reviewCount > 0 ? (
                  <Text variant="caption" color={colors.muted} style={styles.mt6}>
                    {`${reviewCount.toLocaleString('en-IN')} reviews on Google`}
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : (
            <Card style={styles.scoreCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="star-outline" size={20} color={colors.muted} />
              </View>
              <View style={styles.flex}>
                <Text variant="cardTitle">No ratings yet</Text>
                <Text variant="bodySm" color={colors.muted}>New on Tooka. Be the first to rate it after your visit.</Text>
              </View>
            </Card>
          )}
        </View>
        {reviews.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.revs}>
            {reviews.map((r) => {
              const name = r.reviewer_name?.trim() || 'Guest';
              const rating = Number(r.rating);
              const date = formatReviewDate(r.created_at);
              return (
                <Card key={r.id} style={styles.rev}>
                  <View style={styles.revHead}>
                    <View style={styles.av}>
                      <Text style={styles.avText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text variant="itemTitle">{name}</Text>
                      {date ? <Text variant="caption" color={colors.muted}>{date}</Text> : null}
                    </View>
                    {Number.isFinite(rating) && rating > 0 ? (
                      <View style={styles.revRate}>
                        <Ionicons name="star" size={12} color={colors.brand} />
                        <Text style={styles.revRateText}>{rating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                  {r.comment ? (
                    <Text variant="bodySm" style={styles.revBody} numberOfLines={5}>{r.comment}</Text>
                  ) : null}
                </Card>
              );
            })}
          </ScrollView>
        ) : null}

        {/* What's here */}
        {amenityCount > 0 ? (
          <View style={styles.sectionWide}>
            <View style={[styles.headRow, styles.px8]}>
              <Text variant="title">What's here</Text>
              <Text variant="caption" color={colors.muted}>{`${amenityCount} ${amenityCount === 1 ? 'amenity' : 'amenities'}`}</Text>
            </View>
            <View style={styles.amen}>
              {[...trustBadges.map((b) => ({ ...b, key: b.id })), ...amenitiesList.map((a) => ({ ...a, key: `amenity-${a.id}` }))].map(
                (a, i) => (
                  <Animated.View key={a.key} entering={rise(i * motion.stagger)} style={styles.am}>
                    <View style={styles.amIcon}>
                      <Ionicons name={a.icon} size={20} color={colors.cream} />
                    </View>
                    <Text style={styles.amText}>{a.label}</Text>
                  </Animated.View>
                ),
              )}
            </View>
          </View>
        ) : null}

        {/* Opening hours */}
        {hasAnyHours || isOpenNow !== null ? (
          <View style={styles.sectionWide}>
            <Card style={styles.hoursCard}>
              <View style={styles.hoursHead}>
                {isOpenNow !== null ? <LiveChip open={isOpenNow} /> : <Text variant="cardTitle">Opening hours</Text>}
              </View>
              {hasAnyHours ? (
                <>
                  <Pressable
                    onPress={() => setHoursOpen((v) => !v)}
                    style={[styles.more, styles.divider, styles.mt12]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: hoursOpen }}
                  >
                    <Text style={[styles.moreText, styles.flex]}>All opening hours</Text>
                    <View style={hoursOpen && styles.flip}>
                      <Icon name="chevronDown" size={16} color={colors.text} />
                    </View>
                  </Pressable>
                  {hoursOpen ? (
                    <Animated.View entering={rise(0, 8)} style={styles.week}>
                      {formattedHours.map((row) => (
                        <View key={row.day} style={styles.weekRow}>
                          <Text variant="bodySm" color={colors.muted}>{row.day}</Text>
                          <Text variant="bodySm" color={colors.text}>{row.timeText}</Text>
                        </View>
                      ))}
                    </Animated.View>
                  ) : null}
                </>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* House rules */}
        <View style={styles.sectionWide}>
          <Text style={[styles.rulesTitle, styles.px8]}>House rules</Text>
          <Card style={styles.rulesCard}>
            {[
              { icon: 'time-outline', text: 'Arrive 5–10 minutes early. Late arrivals may get a shorter session.' },
              { icon: 'sparkles-outline', text: 'Your treatment is chosen and paid for at the spa.' },
              { icon: 'receipt-outline', text: bookingOption.description },
            ]
              .filter((r) => r.text)
              .map((r, i) => (
                <View key={r.icon} style={[styles.rule, i > 0 && styles.divider]}>
                  <View style={styles.ruleIcon}>
                    <Ionicons name={r.icon} size={17} color={colors.muted} />
                  </View>
                  <Text variant="bodySm" style={styles.flex}>{r.text}</Text>
                </View>
              ))}
          </Card>
        </View>

        {/* Location */}
        {hasLocation ? (
          <View style={styles.sectionWide}>
            <Text variant="title" style={styles.px8}>Location</Text>
            <Card style={styles.locCard}>
              <View style={styles.map} pointerEvents="none">
                <View style={[styles.road, styles.road1, { width: width + 40 }]} />
                <View style={[styles.road, styles.road2]} />
                <View style={[styles.road, styles.road3, { left: width - 110 }]} />
                <View style={styles.pin}>
                  {hasRealPhotos ? (
                    <Image source={{ uri: mediaItems[0] }} style={styles.pinImg} />
                  ) : (
                    <Icon name="pin" size={20} color={colors.onBrand} />
                  )}
                </View>
              </View>
              <View style={styles.locBody}>
                <Text variant="bodySm">{spaLocation}</Text>
                <View style={styles.locBtns}>
                  <Button
                    label="Directions"
                    variant="cream"
                    size="md"
                    style={styles.flex}
                    iconLeft={<Icon name="directions" size={17} color={colors.ink} />}
                    onPress={() =>
                      openLink(directionsUrl(spa, spaLocation), 'Unable to open maps', 'No maps app could open this location.')
                    }
                    accessibilityLabel={`Directions to ${spaName}`}
                  />
                  {phone ? (
                    <Button
                      label="Call spa"
                      variant="secondary"
                      size="md"
                      style={styles.flex}
                      iconLeft={<Icon name="phone" size={17} color={colors.text} />}
                      onPress={() => openLink(`tel:${phone}`, 'Unable to call', `Please call ${spa.phone} from your phone.`)}
                      accessibilityLabel={`Call ${spaName}`}
                    />
                  ) : null}
                </View>
              </View>
            </Card>
          </View>
        ) : null}
      </Scroller>

      {/* Header */}
      <Animated.View style={[styles.header, { paddingTop: headerTop }, headerShift]} pointerEvents="box-none">
        {/* In the pager the header slides down below the status bar as the card
            fills the screen, so the bar reaches up over the status bar too. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.headerBar, sheet && { top: -insets.top }, barStyle]}
          pointerEvents="none"
        />
        {sheet ? (
          <RoundButton variant="glass" onPress={sheet.onClose} accessibilityLabel="Close">
            <Icon name="chevronDown" size={18} color={colors.text} />
          </RoundButton>
        ) : (
          <BackButton variant="glass" onPress={handleBack} />
        )}
        <Animated.View style={[styles.flex, barStyle]} pointerEvents="none">
          <Text variant="cardTitle" numberOfLines={1} style={styles.headerTitle}>{spaName}</Text>
        </Animated.View>
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* Dock */}
      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 14) }]} pointerEvents="box-none">
        {!isBookable ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={colors.danger} />
            <Text variant="caption" color={colors.danger}>Booking isn't available yet. Please check back soon.</Text>
          </View>
        ) : null}
        <Animated.View entering={rise(200)} style={styles.dockIn}>
          <View style={styles.flex}>
            <Text variant="cardTitle" numberOfLines={1}>{dockTitle}</Text>
            {bookingFeeText ? (
              <Text variant="caption" color={colors.muted}>{`${bookingFeeText} holds your slot`}</Text>
            ) : null}
          </View>
          <Button
            label="Continue"
            onPress={handleProceedBooking}
            disabled={ctaDisabled}
            loading={booking.submitting}
            icon={<Icon name="arrowRight" size={18} color={colors.onBrand} />}
            accessibilityLabel={selectedSlot ? `Continue with ${selectedSlot.label}` : 'Continue'}
          />
        </Animated.View>
      </View>
    </Screen>
  );
}

export default SpaDetailsV4;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  stateBox: { paddingHorizontal: 32, gap: 8, alignItems: 'center' },
  stateBtn: { marginTop: 12 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  px8: { paddingHorizontal: 8 },
  divider: { borderTopWidth: 1, borderTopColor: colors.edge },
  flip: { transform: [{ rotate: '180deg' }] },

  hero: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    borderBottomLeftRadius: radii.hero,
    borderBottomRightRadius: radii.hero,
    backgroundColor: colors.s1,
  },
  strip: { flexDirection: 'row', height: HERO_HEIGHT },
  heroShade: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(18,16,14,0.5) 0%, rgba(18,16,14,0) 26%, rgba(18,16,14,0) 62%, rgba(18,16,14,0.7) 100%)',
  },
  tapzone: { position: 'absolute', top: 0, bottom: 0, width: '40%' },
  tapLeft: { left: 0 },
  tapRight: { right: 0 },
  segs: { position: 'absolute', left: 20, bottom: 22, flexDirection: 'row', gap: 6 },
  seg: { width: 8, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,224,0.35)' },
  segOn: { width: 26, backgroundColor: colors.text },
  count: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18,16,14,0.55)',
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: { fontFamily: fonts.bodySemiBold, fontSize: 12 },

  intro: { paddingTop: 22, paddingHorizontal: 20 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(156,199,168,0.12)',
    alignSelf: 'flex-start',
  },
  liveClosed: { backgroundColor: 'rgba(240,138,126,0.12)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.sage },
  liveDotClosed: { backgroundColor: colors.danger },
  liveText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.sage },
  liveTextClosed: { color: colors.danger },
  tagv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.14)',
  },
  tagvText: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
  name: {},
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  rateText: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 },
  addrRow: { flexDirection: 'row', gap: 8, marginTop: 10 },

  timeCard: { marginTop: 26, marginHorizontal: 12, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16 },
  days: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.bg,
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
  },
  day: { flex: 1, height: 52, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayOn: { backgroundColor: colors.text },
  dayLabel: { fontFamily: fonts.display, fontSize: 14, lineHeight: 16, color: colors.muted },
  daySub: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 13, color: colors.muted },
  dayTextOn: { color: colors.ink },
  grp: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  grpText: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.5, color: colors.subtle },
  grpLine: { flex: 1, height: 1, backgroundColor: colors.edge },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slot: {
    width: '31.5%',
    flexGrow: 1,
    maxWidth: '32.5%',
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.14)',
  },
  slotOn: { backgroundColor: colors.text, boxShadow: 'none' },
  slotOff: { boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.08)' },
  slotText: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
  slotTextOn: { color: colors.ink },
  slotTextOff: { color: colors.subtle, textDecorationLine: 'line-through' },
  tick: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 0 3px ${colors.s1}`,
  },
  soon: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    height: 16,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.s3,
    justifyContent: 'center',
  },
  soonText: { fontFamily: fonts.bodySemiBold, fontSize: 9, letterSpacing: 0.7 },
  slotState: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },

  section: { marginTop: 36, marginHorizontal: 20 },
  sectionWide: { marginTop: 30, marginHorizontal: 12 },
  sub: { marginTop: 4 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  steps: { flexDirection: 'row', gap: 10, marginTop: 18 },
  stepLine: {
    position: 'absolute',
    left: '16.6%',
    right: '16.6%',
    top: 21,
    height: 1,
    backgroundColor: colors.s3,
  },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `inset 0 0 0 1px rgba(255,240,224,0.14), 0 0 0 6px ${colors.bg}`,
    marginBottom: 4,
  },
  stepTitle: { fontFamily: fonts.display, fontSize: 13, lineHeight: 17, textAlign: 'center' },

  menuCard: { marginTop: 12, paddingHorizontal: 16 },
  treat: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  treatTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
  more: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  moreText: { fontFamily: fonts.bodySemiBold, fontSize: 14 },

  scoreCard: { marginTop: 12, marginHorizontal: -8, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18 },
  score: { fontFamily: fonts.display, fontSize: 52, lineHeight: 56, letterSpacing: -2 },
  stars: { flexDirection: 'row', gap: 2 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revs: { gap: 10, paddingHorizontal: 12, marginTop: 12 },
  rev: { width: 280, padding: 16 },
  revHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  av: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: { fontFamily: fonts.display, fontSize: 14 },
  revRate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  revRateText: { fontFamily: fonts.display, fontSize: 13 },
  revBody: { marginTop: 12, lineHeight: 20 },

  amen: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  am: {
    width: '31.5%',
    flexGrow: 1,
    maxWidth: '32.5%',
    minHeight: 112,
    padding: 12,
    borderRadius: radii.xl,
    experimental_backgroundImage: 'linear-gradient(170deg, #211C17 0%, #1A1612 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,240,224,0.14), inset 0 0 0 1px rgba(255,240,224,0.08)',
  },
  amIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amText: { marginTop: 'auto', paddingTop: 14, fontFamily: fonts.display, fontSize: 13, lineHeight: 17 },

  hoursCard: { padding: 16, paddingBottom: 4 },
  hoursHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  week: { paddingVertical: 10, gap: 8 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },

  rulesTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21 },
  rulesCard: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locCard: { marginTop: 12, overflow: 'hidden' },
  map: {
    height: 168,
    overflow: 'hidden',
    backgroundColor: colors.map,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
  },
  road: { position: 'absolute', backgroundColor: colors.s2, borderRadius: 6 },
  road1: { top: 96, left: -20, height: 11, transform: [{ rotate: '-7deg' }] },
  road2: { top: -20, left: 120, width: 9, height: 230, transform: [{ rotate: '16deg' }] },
  road3: { top: -20, width: 8, height: 230, transform: [{ rotate: '-20deg' }] },
  pin: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 0 10px ${brandAlpha(0.16)}, 0 10px 24px rgba(0,0,0,0.5)`,
  },
  pinImg: { width: 46, height: 46, borderRadius: 23 },
  locBody: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  locBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerBar: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.edge },
  headerTitle: { textAlign: 'center' },
  headerSpacer: { width: 44 },

  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    paddingHorizontal: 12,
    experimental_backgroundImage: gradients.dock,
  },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8 },
  dockIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingRight: 10,
    paddingLeft: 18,
    borderRadius: radii.card,
    backgroundColor: 'rgba(40,34,29,0.96)',
    boxShadow: 'inset 0 0 0 1px rgba(255,240,224,0.14), 0 16px 36px rgba(0,0,0,0.5)',
  },
});
