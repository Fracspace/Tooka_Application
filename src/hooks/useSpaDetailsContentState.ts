import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import type { SpaDetails } from '../types/spaDetails';
import type { TimeSlot } from '../screens/Booking/types';
import { formatPrice } from '../utils/number';

// Tooka's own generic cover. A stock photo of some other spa was shown here as if
// it were this spa's hero and "handpicked" image.
export const PLACEHOLDER_IMAGE = 'https://d2f15ematxpwp4.cloudfront.net/appImages/Spacover.jpg';

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

type Params = {
  spa: SpaDetails | null;
  slots: TimeSlot[];
  selectedSlotId: string;
};

// Derived data and local UI state for the spa details layout.
export function useSpaDetailsContentState({ spa, slots, selectedSlotId }: Params) {
  const { width } = useWindowDimensions();

  const isBookable = spa?.is_bookable ?? true;
  const spaName = spa?.name ?? 'Spa';

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGalleryModalVisible, setIsGalleryModalVisible] = useState(false);
  const [showAllTreatments, setShowAllTreatments] = useState(false);
  const [hoursModalVisible, setHoursModalVisible] = useState(false);
  // The image shown in the full-screen gallery, tracked while swiping so the
  // "Gallery (n/m)" counter follows along (it stayed on the opening image).
  const [galleryModalIndex, setGalleryModalIndex] = useState(0);

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
  const hasAnyHours = formattedHours.some((row) => row.timeText !== 'Hours unavailable');

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
  const hasRealPhotos = mediaItems[0] !== PLACEHOLDER_IMAGE;

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
    setGalleryModalIndex(currentImageIndex);
    setIsGalleryModalVisible(true);
  }, [currentImageIndex]);

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

  // Open/Closed Status: null when the API does not say (was assumed open).
  const isOpenNow = spa?.is_open_now ?? null;

  // Booking fee from the spa; null hides it rather than showing a guessed ₹199.
  // The amount actually charged always comes from the server at payment time.
  const bookingFeeText = useMemo(
    () => formatPrice(spa?.booking_fee ?? spa?.minimum_booking_amount),
    [spa?.booking_fee, spa?.minimum_booking_amount],
  );

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

  return {
    isBookable,
    spaName,
    selectedImageIndex,
    isGalleryModalVisible,
    showAllTreatments,
    setShowAllTreatments,
    hoursModalVisible,
    setHoursModalVisible,
    galleryModalIndex,
    setGalleryModalIndex,
    formattedHours,
    hasAnyHours,
    ratingDisplay,
    spaLocation,
    services,
    visibleServices,
    mediaItems,
    hasRealPhotos,
    currentImageIndex,
    currentHeroUrl,
    visibleThumbnails,
    remainingCount,
    handleSelectThumbnail,
    handleOpenGalleryModal,
    handleCloseGalleryModal,
    handleSelectModalImage,
    trustBadges,
    amenitiesList,
    isOpenNow,
    bookingFeeText,
    slotWidth,
    selectedSlot,
    firstAvailableSlot,
    ctaLabel,
  };
}
