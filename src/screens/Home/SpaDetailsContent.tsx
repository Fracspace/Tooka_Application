import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import SpaDetailsSkeleton from '../../components/loaders/SpaDetailsSkeleton';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { SpaDetails } from '../../types/spaDetails';
import type { BookingDate, BookingOption, TimeSlot } from '../Booking/types';

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80';

const AMENITY_ICON_MAP: Record<string, string> = {
  steam: 'water-outline',
  hot_tub: 'flame-outline',
  local_parking: 'car-outline',
  wifi: 'wifi-outline',
  ac_unit: 'snow-outline',
  favorite: 'heart-outline',
  king_bed: 'bed-outline',
  lock: 'lock-closed-outline',
  shower: 'water-outline',
  checkroom: 'shirt-outline',
  parking: 'car-outline',
  ac: 'snow-outline',
  sauna: 'flame-outline',
  pool: 'water-outline',
  cafe: 'cafe-outline',
  locker: 'lock-closed-outline',
};

export type SpaDetailsContentProps = {
  spa: SpaDetails | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  spaId: string;
  serviceId?: string;
  serviceName?: string;
  openEnquiry?: boolean;
  onBookSpa?: (spaId: string, serviceId?: string, serviceName?: string) => void;
  onBack?: () => void;
  showBackButton?: boolean;
  showBookBar?: boolean;

  // Integrated Booking Section Props
  dates?: BookingDate[];
  selectedDateId?: string;
  onSelectDate?: (id: string) => void;
  slots?: TimeSlot[];
  selectedSlotId?: string;
  onSelectSlot?: (id: string) => void;
  loadingSlots?: boolean;
  availabilityError?: string | null;
  bookingOption?: BookingOption;
  optionSelected?: boolean;
  onProceedBooking?: () => void;
  proceedLoading?: boolean;
  proceedDisabled?: boolean;
  footerPrice?: number;
};

const formatDateSubLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = Number(parts[2]);
  const monthIdx = Number(parts[1]) - 1;
  if (!Number.isFinite(day) || !monthNames[monthIdx]) return '';
  return `${day} ${monthNames[monthIdx]}`;
};

const formatServicePrice = (price: string | null | number, currency: string | null) => {
  if (!price) return '₹999';
  const numericPrice = Number(price);
  const formattedPrice = Number.isFinite(numericPrice)
    ? numericPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : price;

  if (!currency || currency.toUpperCase() === 'INR') {
    return `₹${formattedPrice}`;
  }
  return `${currency} ${formattedPrice}`;
};

const formatTimeStr = (rawTime: string | null | undefined): string => {
  if (!rawTime || typeof rawTime !== 'string') return '';
  const time = rawTime.trim();
  if (!time) return '';

  const parts = time.split(':');
  if (parts.length < 2) return time;

  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return time;

  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const minStr = minutes > 0 ? `:${minutes < 10 ? '0' : ''}${minutes}` : '';
  return `${hours}${minStr}${period}`;
};

const SpaDetailsContent = memo(function SpaDetailsContentInner({
  spa,
  loading,
  spaId,
  serviceId,
  serviceName,
  onBack,
  showBackButton = true,
  showBookBar = true,

  // Integrated Booking props
  dates = [],
  selectedDateId = '',
  onSelectDate,
  slots = [],
  selectedSlotId = '',
  onSelectSlot,
  loadingSlots = false,
  availabilityError = null,
  bookingOption = {
    id: 'standard',
    title: 'Standard slot booking',
    subtitle: '',
    description:
      'The booking amount is refundable only as per the applicable Terms & Conditions.',
    price: 199,
  },
  onProceedBooking,
  proceedLoading = false,
  proceedDisabled = false,
}: SpaDetailsContentProps): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isBookable = spa?.is_bookable ?? true;
  const spaName = spa?.name ?? 'Spa';

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGalleryModalVisible, setIsGalleryModalVisible] = useState(false);
  const [showAllTreatments, setShowAllTreatments] = useState(false);
  const [hoursModalVisible, setHoursModalVisible] = useState(false);

  const formattedHours = useMemo(() => {
    const rawHours = spa?.opening_hours ?? spa?.timings ?? [];
    const hoursMap = new Map<string, any>();

    if (Array.isArray(rawHours)) {
      rawHours.forEach((item: any) => {
        const dayKey = (item?.day_of_week ?? item?.day ?? '').toLowerCase().trim();
        if (dayKey) {
          hoursMap.set(dayKey, item);
        }
      });
    }

    const DAYS_ORDER = [
      { key: 'monday', label: 'Monday' },
      { key: 'tuesday', label: 'Tuesday' },
      { key: 'wednesday', label: 'Wednesday' },
      { key: 'thursday', label: 'Thursday' },
      { key: 'friday', label: 'Friday' },
      { key: 'saturday', label: 'Saturday' },
      { key: 'sunday', label: 'Sunday' },
    ];

    return DAYS_ORDER.map(({ key, label }) => {
      const item = hoursMap.get(key);
      if (!item) {
        return { day: label, timeText: 'Hours unavailable' };
      }

      if (item.is_open === false) {
        return { day: label, timeText: 'Closed' };
      }

      if (item.is_open_24h === true) {
        return { day: label, timeText: 'Open 24 hours' };
      }

      const openRaw = item.open_time ?? item.open;
      const closeRaw = item.close_time ?? item.close;

      const openFmt = formatTimeStr(openRaw);
      const closeFmt = formatTimeStr(closeRaw);

      if (openFmt && closeFmt) {
        return { day: label, timeText: `${openFmt} - ${closeFmt}` };
      }

      return { day: label, timeText: 'Hours unavailable' };
    });
  }, [spa?.opening_hours, spa?.timings]);

  const ratingVal = spa?.rating_google != null ? Number(spa.rating_google) : null;
  const reviewCountVal =
    spa?.review_count_google != null ? Number(spa.review_count_google) : 0;

  const ratingDisplay = useMemo(() => {
    if (
      ratingVal == null ||
      !Number.isFinite(ratingVal) ||
      ratingVal === 0 ||
      reviewCountVal === 0
    ) {
      return { text: 'No ratings yet', isRated: false };
    }
    const formattedCount =
      reviewCountVal >= 1000
        ? `${(reviewCountVal / 1000).toFixed(1)}K`
        : `${reviewCountVal}`;
    return { text: `${ratingVal.toFixed(1)} (${formattedCount})`, isRated: true };
  }, [ratingVal, reviewCountVal]);

  const spaLocation = useMemo(() => {
    const parts = [spa?.address_line1, spa?.locality_name, spa?.city_name]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts.join(', ') : 'Location unavailable';
  }, [spa?.address_line1, spa?.locality_name, spa?.city_name]);

  const services = useMemo(() => spa?.services ?? [], [spa?.services]);

  const visibleServices = useMemo(() => {
    if (showAllTreatments || services.length <= 3) {
      return services;
    }
    return services.slice(0, 3);
  }, [services, showAllTreatments]);

  // Gallery items strictly ordered: 1. cover_photo_url, 2. media[].url, 3. gallery[].image_url
  const mediaItems = useMemo(() => {
    const urls: string[] = [];

    // 1. spa.cover_photo_url if available
    if (
      spa?.cover_photo_url &&
      typeof spa.cover_photo_url === 'string' &&
      spa.cover_photo_url.trim()
    ) {
      urls.push(spa.cover_photo_url.trim());
    }

    // 2. spa.media[].url
    if (Array.isArray(spa?.media) && spa.media.length > 0) {
      spa.media.forEach((m) => {
        if (
          m?.url &&
          typeof m.url === 'string' &&
          m.url.trim() &&
          !urls.includes(m.url.trim())
        ) {
          urls.push(m.url.trim());
        }
      });
    }

    // 3. spa.gallery[].image_url
    if (Array.isArray(spa?.gallery) && spa.gallery.length > 0) {
      spa.gallery.forEach((g) => {
        if (
          g?.image_url &&
          typeof g.image_url === 'string' &&
          g.image_url.trim() &&
          !urls.includes(g.image_url.trim())
        ) {
          urls.push(g.image_url.trim());
        }
      });
    }

    if (urls.length === 0) {
      urls.push(PLACEHOLDER_IMAGE);
    }
    return urls;
  }, [spa?.cover_photo_url, spa?.media, spa?.gallery]);

  // Safety check for index out of bounds
  useEffect(() => {
    if (selectedImageIndex >= mediaItems.length) {
      setSelectedImageIndex(0);
    }
  }, [mediaItems.length, selectedImageIndex]);

  const currentImageIndex =
    selectedImageIndex < mediaItems.length ? selectedImageIndex : 0;
  const currentHeroUrl = mediaItems[currentImageIndex] ?? PLACEHOLDER_IMAGE;

  // Visible thumbnails (indexes 1, 2, 3) with actual index references
  const visibleThumbnails = useMemo(
    () =>
      mediaItems.slice(1, 4).map((url, idx) => ({
        url,
        actualIndex: idx + 1,
      })),
    [mediaItems],
  );

  const remainingCount = Math.max(0, mediaItems.length - 4);

  // Auto-scroll timer (every 3.5s)
  useEffect(() => {
    if (mediaItems.length <= 1 || isGalleryModalVisible) {
      return;
    }

    const interval = setInterval(() => {
      setSelectedImageIndex((prevIndex) => (prevIndex + 1) % mediaItems.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [mediaItems.length, isGalleryModalVisible, selectedImageIndex]);

  const handleSelectThumbnail = useCallback((actualIndex: number) => {
    setSelectedImageIndex(actualIndex);
  }, []);

  const handleOpenGalleryModal = useCallback(() => {
    setIsGalleryModalVisible(true);
  }, []);

  const handleCloseGalleryModal = useCallback(() => {
    setIsGalleryModalVisible(false);
  }, []);

  const handleSelectModalImage = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setIsGalleryModalVisible(false);
  }, []);

  // Trust Badges
  const trustBadges = useMemo(() => {
    const badges = [];
    if (spa?.is_verified) {
      badges.push({ id: 'verified', icon: 'checkmark-circle-outline', label: 'Verified Spa' });
    }
    if (spa?.is_claimed) {
      badges.push({ id: 'claimed', icon: 'shield-checkmark-outline', label: 'Claimed Spa' });
    }
    if (spa?.is_featured) {
      badges.push({ id: 'featured', icon: 'flash-outline', label: 'Featured' });
    }
    return badges;
  }, [spa?.is_verified, spa?.is_claimed, spa?.is_featured]);

  // Dynamic Amenities List
  const amenitiesList = useMemo(() => {
    if (!Array.isArray(spa?.amenities) || spa.amenities.length === 0) {
      return [];
    }

    return spa.amenities
      .filter((a) => a && (a.name || (a as any).label))
      .map((a) => {
        const label = a.name ?? (a as any).label;
        const rawIcon = ((a as any).icon ?? '').toLowerCase();
        const icon = AMENITY_ICON_MAP[rawIcon] ?? 'sparkles-outline';
        return {
          id: a.id ?? label,
          label,
          icon,
        };
      });
  }, [spa?.amenities]);

  // Open/Closed Status
  const isOpenNow = spa?.is_open_now ?? true;

  // Booking Fee Amount
  const bookingFeeAmount = useMemo(() => {
    const feeStr = spa?.booking_fee ?? spa?.minimum_booking_amount ?? bookingOption.price;
    const numericFee = Number(feeStr);
    return Number.isFinite(numericFee) ? Math.round(numericFee) : 199;
  }, [spa?.booking_fee, spa?.minimum_booking_amount, bookingOption.price]);

  const slotWidth = useMemo(() => {
    const contentWidth = Math.min(width, 720) - 68;
    return Math.floor((contentWidth - 16) / 3);
  }, [width]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId && s.status === 'available'),
    [slots, selectedSlotId],
  );

  const firstAvailableSlot = useMemo(
    () => slots.find((s) => s.status === 'available'),
    [slots],
  );

  const selectedTimeLabel = selectedSlot?.label;
  let ctaLabel = 'Continue to Payment ➔';
  if (!isBookable) {
    ctaLabel = 'Booking unavailable';
  } else if (selectedTimeLabel) {
    ctaLabel = `Continue with ${selectedTimeLabel} ➔`;
  }

  if (loading && spa === null) {
    return <SpaDetailsSkeleton />;
  }

  if (!spa) {
    return <SpaDetailsSkeleton />;
  }

  return (
    <View style={styles.root}>
      {/* 1. HERO GALLERY */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: currentHeroUrl }} style={styles.heroImage} resizeMode="cover" />

        {/* Header Overlay Buttons */}
        <View style={[styles.heroOverlayHeader, { paddingTop: Math.max(insets.top, 12) }]}>
          {showBackButton && (
            <Pressable
              style={styles.heroBackButton}
              onPress={onBack ?? (() => navigation.goBack())}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
          )}
          {/* <Pressable style={styles.favoriteButton} hitSlop={10}>
            <Ionicons name="heart-outline" size={22} color="#FFFFFF" />
          </Pressable> */}
        </View>

        {/* Bottom Gallery Thumbnail Overlay */}
        <View style={styles.galleryStrip}>
          {visibleThumbnails.map((item) => (
            <Pressable
              key={`thumb-${item.actualIndex}`}
              onPress={() => handleSelectThumbnail(item.actualIndex)}
              style={[
                styles.galleryThumb,
                currentImageIndex === item.actualIndex && styles.galleryThumbSelected,
              ]}
            >
              <Image source={{ uri: item.url }} style={styles.galleryThumbImg} resizeMode="cover" />
            </Pressable>
          ))}
          {remainingCount > 0 ? (
            <Pressable
              onPress={handleOpenGalleryModal}
              style={[styles.galleryThumb, styles.galleryExtraThumb]}
            >
              <Image
                source={{ uri: mediaItems[4] ?? currentHeroUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <View style={styles.galleryExtraOverlay}>
                <Text style={styles.galleryExtraText}>+{remainingCount}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.bodyContainer}>
        {/* 2. SPA INFORMATION HEADER */}
        <View style={styles.spaHeaderBlock}>
          <View style={styles.spaTitleRow}>
            <Text style={styles.spaName}>{spaName}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons
                name="star"
                size={14}
                color={ratingDisplay.isRated ? '#F8C51D' : '#9A9084'}
              />
              <Text style={styles.ratingText}>{ratingDisplay.text}</Text>
            </View>
          </View>

          <View style={styles.timingRow}>
            <View style={[styles.openNowBadge, !isOpenNow && styles.closedBadge]}>
              <Text style={[styles.openNowText, !isOpenNow && styles.closedText]}>
                {isOpenNow ? 'Open now' : 'Closed now'}
              </Text>
            </View>

            <Pressable
              onPress={() => setHoursModalVisible(true)}
              hitSlop={10}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}
            >
              <Text style={{ fontFamily: 'WorkSans-Medium', fontSize: 12, color: '#FFB02E' }}>View Hours </Text>
              <Ionicons
                name={"chevron-forward-outline"}
                size={12}
                color="#FFAA26"
              />
            </Pressable>
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color="#6C6258" />
            <Text style={styles.locationText}>{spaLocation}</Text>
          </View>
        </View>

        {/* 3. TRUST BADGES & AMENITIES IN ONE SEQUENTIAL HORIZONTAL ROW */}
        {(trustBadges.length > 0 || amenitiesList.length > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trustChipsRow}
          >
            {trustBadges.map((b) => (
              <View key={b.id} style={styles.trustChip}>
                <Ionicons name={b.icon} size={15} color="#2D2B28" />
                <Text style={styles.trustChipText}>{b.label}</Text>
              </View>
            ))}

            {amenitiesList.map((a) => (
              <View key={`amenity-${a.id}`} style={styles.trustChip}>
                <Ionicons name={a.icon} size={15} color="#6C6258" />
                <Text style={styles.trustChipText}>{a.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 4. NON-INTERACTIVE TREATMENTS DISPLAY */}
        {services.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Choose your treatment</Text>
            </View>

            <View style={styles.handpickedBanner}>
              <View style={styles.handpickedCopy}>
                <View style={styles.lotusCircle}>
                  <Ionicons name="sparkles" size={16} color="#FFAA26" />
                </View>
                <Text style={styles.handpickedText}>
                  Handpicked treatments for your mind, body & soul.
                </Text>
              </View>
              <Image source={{ uri: mediaItems[0] }} style={styles.handpickedImage} resizeMode="cover" />
            </View>

            <View style={styles.servicesList}>
              {visibleServices.map((item) => {
                const priceText = formatServicePrice(item.base_price, item.currency);
                const durationText =
                  item.duration_minutes != null ? `${item.duration_minutes} min` : '60 min';
                const categoryText = item.category ?? 'Wellness';

                return (
                  <View key={item.id} style={styles.treatmentCard}>
                    <View style={styles.treatmentTopRow}>
                      <Text style={styles.treatmentTitle}>{item.name}</Text>
                      <Text style={styles.treatmentPrice}>{priceText}</Text>
                    </View>
                    <View style={styles.treatmentMetaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={13} color="#FFB02E" />
                        <Text style={styles.metaItemText}>{durationText}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="sparkles-outline" size={13} color="#FFB02E" />
                        <Text style={styles.metaItemText}>{categoryText}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {services.length > 3 && (
              <Pressable
                onPress={() => setShowAllTreatments((prev) => !prev)}
                style={styles.toggleTreatmentsBtn}
                hitSlop={8}
              >
                <Text style={styles.toggleTreatmentsText}>
                  {showAllTreatments ? 'Show less' : 'View all treatments'}
                </Text>
                <Ionicons
                  name={showAllTreatments ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#FFAA26"
                />
              </Pressable>
            )}
          </>
        )}

        {/* 5. "WHEN WOULD YOU LIKE TO VISIT?" SECTION */}
        {dates.length > 0 && (
          <View style={styles.bookingSectionBlock}>
            <Text style={styles.sectionTitle}>When would you like to visit?</Text>

            <View style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginTop: 15 }}>
              {/* Date Selector Tabs */}
              <View style={styles.dateTabsRow}>
                {dates.map((d) => {
                  const isSelectedDate = d.id === selectedDateId;
                  const dateFormatted = formatDateSubLabel(d.date);
                  const labelText = dateFormatted ? `${d.label} • ${dateFormatted}` : d.label;

                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => onSelectDate?.(d.id)}
                      style={[styles.dateTab, isSelectedDate && styles.dateTabActive]}
                    >
                      <Text style={[styles.dateTabText, isSelectedDate && styles.dateTabTextActive]}>
                        {labelText}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Next Available Banner */}
              {!loadingSlots && !availabilityError && firstAvailableSlot && (
                <View style={styles.nextAvailableBanner}>
                  <Text style={styles.nextAvailableText}>
                    Next available:{' '}
                    <Text style={{ fontFamily: 'Sora-SemiBold', color: '#2D2B28' }}>
                      {firstAvailableSlot.label}
                    </Text>
                  </Text>
                  <View style={styles.recommendedPill}>
                    <Ionicons name="star" size={12} color="#F8C51D" />
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                </View>
              )}

              {/* Time Slot Grid */}
              <Text style={styles.otherSlotsTitle}>Other Slots</Text>

              {loadingSlots && (
                <View style={styles.slotStateBox}>
                  <ActivityIndicator color="#FFAA26" />
                  <Text style={styles.slotStateText}>Checking availability...</Text>
                </View>
              )}

              {!loadingSlots && availabilityError && (
                <View style={styles.slotStateBox}>
                  <Text style={styles.slotStateTitle}>Unable to load slots</Text>
                  <Text style={styles.slotStateText}>{availabilityError}</Text>
                </View>
              )}

              {!loadingSlots && !availabilityError && slots.length === 0 && (
                <View style={styles.slotStateBox}>
                  <Text style={styles.slotStateTitle}>No slots available</Text>
                  <Text style={styles.slotStateText}>Please select another date.</Text>
                </View>
              )}

              {!loadingSlots && !availabilityError && slots.length > 0 && (
                <View style={styles.slotGridRow}>
                  {slots.map((s) => {
                    const isSelectedSlot = s.id === selectedSlotId;
                    const isDisabled = s.status !== 'available';

                    return (
                      <Pressable
                        key={s.id}
                        disabled={isDisabled}
                        onPress={() => onSelectSlot?.(s.id)}
                        style={[
                          styles.slotBtn,
                          { width: slotWidth },
                          isSelectedSlot && styles.slotBtnSelected,
                          isDisabled && styles.slotBtnDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotBtnText,
                            isSelectedSlot && styles.slotBtnTextSelected,
                            isDisabled && styles.slotBtnTextDisabled,
                          ]}
                        >
                          {s.label}
                        </Text>
                        {isSelectedSlot && (
                          <View style={styles.selectedSlotBadge}>
                            <Text style={styles.selectedSlotBadgeText}>SELECTED</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Arrival Tip Banner */}
              <View style={styles.arrivalTipBanner}>
                <Text style={{ fontSize: 14 }}>🌿</Text>
                <Text style={styles.arrivalTipText}>
                  Arrive 5–10 minutes early for a relaxed experience.
                </Text>
              </View>
            </View>

            {/* 6. BOOKING OPTION CARD */}
            <View style={styles.optionCard}>
              <View style={styles.priceBubble}>
                <Text style={styles.priceBubbleText}>₹{bookingFeeAmount}</Text>
              </View>
              <View style={styles.optionTopRow}>
                <View style={styles.radioOuter}>
                  <View style={styles.radioInner} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{bookingOption.title}</Text>
                  <Text style={styles.optionDescription}>{bookingOption.description}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 7. STICKY BOTTOM CTA & IS_BOOKABLE NOTICE */}
      {showBookBar && (
        <View style={[styles.bottomStickyBar]}>
          {!isBookable && (
            <View style={styles.unbookableNotice}>
              <Ionicons name="information-circle-outline" size={16} color="#D32F2F" />
              <Text style={styles.unbookableNoticeText}>
                Booking isn't available yet. Please check back soon.
              </Text>
            </View>
          )}

          <Pressable
            disabled={!isBookable || proceedDisabled || proceedLoading}
            onPress={onProceedBooking}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
              (!isBookable || proceedDisabled || proceedLoading) && styles.ctaButtonDisabled,
            ]}
          >
            {proceedLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* 8. EXPANDED FULL GALLERY MODAL VIEWER */}
      <Modal
        visible={isGalleryModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseGalleryModal}
      >
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={handleCloseGalleryModal} style={styles.modalCloseBtn} hitSlop={10}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.modalTitle}>
              Gallery ({currentImageIndex + 1}/{mediaItems.length})
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <FlatList
            data={mediaItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, index) => `modal-img-${index}`}
            initialScrollIndex={currentImageIndex}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            renderItem={({ item, index }) => (
              <Pressable
                style={[styles.modalSlide, { width }]}
                onPress={() => handleSelectModalImage(index)}
              >
                <Image source={{ uri: item }} style={styles.modalImage} resizeMode="contain" />
                <View style={styles.modalTapHint}>
                  <Text style={styles.modalTapHintText}>Tap image to select for hero</Text>
                </View>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* 9. BUSINESS HOURS MODAL */}
      <Modal
        visible={hoursModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHoursModalVisible(false)}
      >
        <View style={styles.hoursModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setHoursModalVisible(false)}
          />

          <View style={styles.hoursModalCard}>
            <View style={styles.hoursHeaderRow}>
              <View style={styles.clockCircle}>
                <Ionicons name="time-outline" size={30} color="#4A6585" />
              </View>
              <View style={styles.hoursHeaderTexts}>
                <Text style={styles.hoursTitle}>Business Hours</Text>
                <Text style={styles.hoursSubtitle}>
                  Plan your visit around the spa’s schedule.
                </Text>
              </View>
            </View>

            <View style={styles.hoursDivider} />

            <View style={styles.hoursRowsList}>
              {formattedHours.map((row, idx) => (
                <View key={`hours-${idx}`} style={styles.hoursRow}>
                  <Text style={styles.hoursDayLabel}>{row.day}</Text>
                  <Text style={styles.hoursTimeValue}>{row.timeText}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF7EE',
  },
  heroWrap: {
    position: 'relative',
    width: '100%',
    height: 330,
    backgroundColor: '#E5DCD3',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlayHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  heroBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(45, 43, 40, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(45, 43, 40, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryStrip: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  galleryThumb: {
    flex: 1,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#D9D0C7',
  },
  galleryThumbSelected: {
    borderColor: '#FFAA26',
    borderWidth: 2.5,
  },
  galleryThumbImg: {
    width: '100%',
    height: '100%',
  },
  galleryExtraThumb: {
    position: 'relative',
  },
  galleryExtraOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(45, 43, 40, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryExtraText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  bodyContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  spaHeaderBlock: {
    marginBottom: 12,
  },
  spaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spaName: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 22,
    color: '#2D2B28',
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontFamily: 'Sora-Medium',
    fontSize: 14,
    color: '#2D2B28',
    marginLeft: 4,
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  openNowBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  closedBadge: {
    backgroundColor: '#FFEBEE',
  },
  openNowText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    color: '#2E7D32',
  },
  closedText: {
    color: '#C62828',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#6C6258',
    marginLeft: 4,
    flex: 1,
  },
  trustChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE3D7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
  },
  trustChipText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    color: '#2D2B28',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: '#2D2B28',
  },
  handpickedBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBE3D7',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  handpickedCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  lotusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  handpickedText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 13,
    color: '#2D2B28',
    flex: 1,
    lineHeight: 18,
  },
  handpickedImage: {
    width: 72,
    height: 52,
    borderRadius: 10,
  },
  servicesList: {
    gap: 5,
  },
  treatmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBE3D7',
    padding: 14,
  },
  treatmentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  treatmentTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#2D2B28',
    flex: 1,
    marginRight: 8,
  },
  treatmentPrice: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 17,
    color: '#E8950F',
  },
  treatmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9A9084',
  },
  toggleTreatmentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 6,
    gap: 4,
  },
  toggleTreatmentsText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    color: '#FFAA26',
  },
  bookingSectionBlock: {
    marginTop: 24,
  },
  dateTabsRow: {
    flexDirection: 'row',
    gap: 8,
    // marginTop: 12,
    backgroundColor: '#FFB02E1a',
    borderRadius: 10
  },
  dateTab: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    // backgroundColor: '#F7EFE6',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTabActive: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    borderColor: '#FFAA26',
  },
  dateTabText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 11,
    color: '#6C6258',
    textAlign: 'center',
  },
  dateTabTextActive: {
    fontFamily: 'Sora-SemiBold',
    color: '#2D2B28',
  },
  nextAvailableBanner: {
    backgroundColor: '#FFF5E6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  nextAvailableText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#6C6258',
  },
  recommendedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  recommendedText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 11,
    color: '#E8950F',
  },
  otherSlotsTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: '#2D2B28',
    marginTop: 14,
    marginBottom: 8,
  },
  slotStateBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  slotStateTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: '#2D2B28',
  },
  slotStateText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9A9084',
    marginTop: 4,
  },
  slotGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotBtn: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBE3D7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  slotBtnSelected: {
    backgroundColor: '#FFAA26',
    borderColor: '#FFAA26',
  },
  slotBtnDisabled: {
    backgroundColor: '#F4EFEA',
    borderColor: 'transparent',
  },
  slotBtnText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 13,
    color: '#2D2B28',
  },
  slotBtnTextSelected: {
    fontFamily: 'Sora-SemiBold',
    color: '#FFFFFF',
  },
  slotBtnTextDisabled: {
    color: '#BDB3A6',
  },
  selectedSlotBadge: {
    position: 'absolute',
    right: 3,
    top: 3,
    backgroundColor: '#2D2B28',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  selectedSlotBadgeText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 6,
    color: '#FFFFFF',
  },
  arrivalTipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF7ED',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  arrivalTipText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 6,
    flex: 1,
  },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EBE3D7',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginTop: 16,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 0,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#2D2B28',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#2D2B28',
  },
  optionCopy: {
    flex: 1,
    paddingRight: 64,
  },
  optionTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: '#2D2B28',
  },
  optionDescription: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: '#6C6258',
    marginTop: 4,
  },
  priceBubble: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 70,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  priceBubbleText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#2D2B28',
  },
  bottomStickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    // borderTopWidth: 1,
    // borderTopColor: '#EBE3D7',
  },
  unbookableNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 6,
  },
  unbookableNoticeText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    color: '#D32F2F',
    flex: 1,
  },
  ctaButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFAA26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#BDB3A6',
  },
  ctaButtonText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#1E1C1A',
  },
  modalHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  modalSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  modalTapHint: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalTapHintText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
  hoursModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(25, 23, 20, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  hoursModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  hoursHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  clockCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF4F8',
    borderWidth: 1,
    borderColor: '#DFE7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursHeaderTexts: {
    flex: 1,
  },
  hoursTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 20,
    color: '#1F1D1B',
  },
  hoursSubtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#8C857B',
    marginTop: 2,
    lineHeight: 18,
  },
  hoursDivider: {
    height: 1,
    backgroundColor: '#EFEAE4',
    marginVertical: 16,
  },
  hoursRowsList: {
    gap: 12,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hoursDayLabel: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    color: '#8C857B',
  },
  hoursTimeValue: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    color: '#6C6258',
  },
});

export default SpaDetailsContent;
