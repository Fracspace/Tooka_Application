import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  useWindowDimensions,
  type FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type MapView from 'react-native-maps';
import type { MapViewProps } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SpaApi from '../api/SpaApi';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useNearbySpas } from '../context/NearbySpaContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { ExploreSpa } from '../types/explore';
import type { SpaDetails } from '../types/spaDetails';
import { bookingOption } from '../screens/Booking/bookingData';
import { useSlotBooking } from './useSlotBooking';
import { formatPrice } from '../utils/number';

type ExploreNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_COORDINATE = {
  latitude: 17.4308,
  longitude: 78.4101,
};

const CARD_SPACING = 14;
const CARD_SIDE_PADDING = 24;

// Data and actions for the Explore screen; the screen only lays them out.
export function useExploreScreen() {
  const navigation = useNavigation<ExploreNavigationProp>();
  const route = useRoute<any>();
  const paramDateId = route?.params?.selectedDateId;
  const paramSlotId = route?.params?.selectedSlotId;
  // Set when Login sends the user back here to finish booking a spa.
  const paramSpaId: string | undefined = route?.params?.spaId;
  const paramOpenBooking: boolean = Boolean(route?.params?.openBooking);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { location, loading } = useLocation();

  const mapRef = useRef<MapView | null>(null);
  // Android workaround (react-native-maps): on the first mount the MapView loses the
  // hidden container that keeps marker views attached, so marker <Image>s never load.
  // Un-flattening the wrapper once the map is ready moves the same MapView into a new
  // parent; that detach/re-attach makes the library rebuild the container.
  const [mapReattached, setMapReattached] = useState(false);
  const listRef = useRef<FlatList<ExploreSpa> | null>(null);
  const sheetRef = useRef<BottomSheet | null>(null);
  const [sheetIndex, setSheetIndex] = useState(-1);


  const origin = useMemo(
    () => ({
      latitude: location?.latitude ?? DEFAULT_COORDINATE.latitude,
      longitude: location?.longitude ?? DEFAULT_COORDINATE.longitude,
    }),
    [location?.latitude, location?.longitude],
  );

  const {
    spas: contextSpas,
    loadNextPage,
    loadingMore,
    loading: spasLoading,
    error: spasError,
    retry: retrySpas,
  } = useNearbySpas();
  const spas: ExploreSpa[] = contextSpas;
  // console.log("Spas in exploreScreen: ", spas);

  const [selectedSpaId, setSelectedSpaId] = useState<string | undefined>(
    paramSpaId ?? spas[0]?.id,
  );
  const [spaDetails, setSpaDetails] = useState<SpaDetails | null>(null);
  const [spaDetailsLoading, setSpaDetailsLoading] = useState(false);
  const [spaDetailsError, setSpaDetailsError] = useState<string | null>(null);

  const { isAuthenticated } = useAuth();

  const detailsCacheRef = useRef<Record<string, SpaDetails>>({});
  const activeRequestIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  const selectedSpa = useMemo(
    () => spas.find((spa) => spa.id === selectedSpaId) ?? spas[0],
    [selectedSpaId, spas],
  );

  const cardWidth = Math.min(width - CARD_SIDE_PADDING * 2, 430);
  const snapInterval = cardWidth + CARD_SPACING;
  const cardListBottom = Math.max(insets.bottom, 50);

  const snapPoints = useMemo(
    () => ['50%', '75%', '100%'],
    [],
  );

  const isSheetOpen = sheetIndex >= 0;

  // Slot selection, booking summary and booking - shared with SpaDetailsScreen.
  // A booking from Explore reserves a slot; no service is chosen here.
  const bookingDetails = useMemo(() => {
    // Only trust details that belong to the selected spa.
    const details = spaDetails && spaDetails.id === selectedSpa?.id ? spaDetails : null;
    return {
      spaName: details?.name ?? selectedSpa?.name,
      spaImage: details?.cover_photo_url ?? selectedSpa?.image ?? undefined,
      location: details?.locality_name ?? details?.city_name ?? selectedSpa?.address ?? undefined,
      serviceName: bookingOption.title,
      serviceDurationMinutes: null,
    };
  }, [spaDetails, selectedSpa]);

  const booking = useSlotBooking({
    spaId: selectedSpa?.id,
    enabled: isSheetOpen,
    initialDateId: paramDateId,
    initialSlotId: paramSlotId,
    // Back from Login: show the summary for the spa they were booking.
    autoOpenSummary: Boolean(
      paramOpenBooking &&
        isAuthenticated &&
        selectedSpa?.id === paramSpaId &&
        spaDetails?.id === paramSpaId,
    ),
    details: bookingDetails,
  });

  const bookingFeeText = useMemo(
    () => formatPrice(spaDetails?.booking_fee ?? spaDetails?.minimum_booking_amount),
    [spaDetails?.booking_fee, spaDetails?.minimum_booking_amount],
  );

  const loadSpaDetails = useCallback(async (spaId: string, options?: { force?: boolean }) => {
    // Cancel any in-flight request first - including when serving from cache - so
    // an older response for another spa cannot land on top of this one.
    activeControllerRef.current?.abort();
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    const cachedSpa = detailsCacheRef.current[spaId];
    if (cachedSpa && !options?.force) {
      setSpaDetails(cachedSpa);
      setSpaDetailsError(null);
      setSpaDetailsLoading(false);
      return;
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;

    // Clear the previous spa: the sheet showed its name, photos and services (and
    // the payment summary its name) while this spa was still loading.
    setSpaDetails(null);
    setSpaDetailsLoading(true);
    setSpaDetailsError(null);

    try {
      const details = await SpaApi.getSpaDetails(spaId, controller.signal);
      if (requestId !== activeRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      detailsCacheRef.current[spaId] = details;
      setSpaDetails(details);
    } catch {
      if (requestId !== activeRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      setSpaDetailsError('Unable to load spa details');
      setSpaDetails(null);
    } finally {
      if (requestId === activeRequestIdRef.current && !controller.signal.aborted) {
        setSpaDetailsLoading(false);
      }
    }
  }, []);

  const handleRetryDetails = useCallback(() => {
    if (selectedSpa?.id) {
      loadSpaDetails(selectedSpa.id, { force: true });
    }
  }, [loadSpaDetails, selectedSpa?.id]);

  const { openSummary, selectedDateId, selectedSlotId } = booking;

  // Book from the sheet: same flow as SpaDetails - log in if needed, then show the
  // booking summary (Explore used to create the booking immediately, no summary).
  const handleProceedBooking = useCallback(() => {
    if (spaDetails && spaDetails.is_bookable === false) {
      return;
    }

    if (!selectedSpa?.id) return;

    if (!isAuthenticated) {
      navigation.navigate('Login', {
        spaId: selectedSpa.id,
        openBooking: true,
        selectedDateId,
        selectedSlotId: selectedSlotId || undefined,
        fromScreen: 'Explore',
      });
      return;
    }

    openSummary();
  }, [
    spaDetails,
    selectedSpa,
    isAuthenticated,
    navigation,
    selectedDateId,
    selectedSlotId,
    openSummary,
  ]);

  const animateToCoordinate = useCallback((spa: ExploreSpa) => {
    if (spa.latitude == null || spa.longitude == null) {
      return;
    }
    mapRef.current?.animateCamera(
      {
        center: {
          latitude: spa.latitude,
          longitude: spa.longitude,
        },
        zoom: 16,
        pitch: 0,
        heading: 0,
      },
      { duration: 520 },
    );
  }, []);

  const scrollToSpa = useCallback(
    (spaId: string) => {
      const index = spas.findIndex((spa) => spa.id === spaId);
      if (index < 0) {
        return;
      }

      listRef.current?.scrollToOffset({
        offset: index * snapInterval,
        animated: true,
      });
    },
    [snapInterval, spas],
  );

  const selectSpa = useCallback(
    (spa: ExploreSpa, options?: { openSheet?: boolean; syncCard?: boolean }) => {
      setSelectedSpaId(spa.id);
      animateToCoordinate(spa);

      if (options?.syncCard !== false) {
        scrollToSpa(spa.id);
      }

      if (options?.openSheet) {
        sheetRef.current?.snapToIndex(0);
      }
    },
    [animateToCoordinate, scrollToSpa],
  );

  // Back from Login with a spa to book: reopen its sheet once it is in the list.
  const openedParamSpaRef = useRef(false);
  useEffect(() => {
    if (!paramSpaId || openedParamSpaRef.current) return;
    const spa = spas.find((item) => item.id === paramSpaId);
    if (!spa) return;
    openedParamSpaRef.current = true;
    // Next frame: the sheet and carousel need to be laid out first.
    requestAnimationFrame(() => selectSpa(spa, { openSheet: true }));
  }, [paramSpaId, spas, selectSpa]);

  useEffect(() => {
    mapRef.current?.animateCamera(
      {
        center: origin,
        zoom: 15,
        pitch: 0,
        heading: 0,
      },
      { duration: 720 },
    );
  }, [origin]);

  useEffect(() => {
    spas.forEach(spa => {
      if (spa.image) {
        Image.prefetch(spa.image);
      }
    });
  }, [spas]);

  useEffect(() => {
    if (!selectedSpaId && spas[0]) {
      setSelectedSpaId(spas[0].id);
    }
  }, [selectedSpaId, spas]);

  useEffect(() => {
    if (!selectedSpa?.id || !isSheetOpen) {
      return;
    }

    loadSpaDetails(selectedSpa.id);
  }, [isSheetOpen, loadSpaDetails, selectedSpa?.id]);

  const handleMapReady: MapViewProps['onMapReady'] = useCallback(() => {
    if (Platform.OS === 'android') {
      setMapReattached(true);
    }
    mapRef.current?.animateCamera(
      {
        center: origin,
        zoom: 15,
        pitch: 0,
        heading: 0,
      },
      { duration: 720 },
    );
  }, [origin]);

  const handleCurrentLocation = useCallback(() => {
    mapRef.current?.animateCamera(
      {
        center: origin,
        zoom: 16,
        pitch: 0,
        heading: 0,
      },
      { duration: 520 },
    );
  }, [origin]);

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  }, [navigation]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
      const nextSpa = spas[index];

      if (nextSpa && nextSpa.id !== selectedSpaId) {
        setSelectedSpaId(nextSpa.id);
        animateToCoordinate(nextSpa);
      }
    },
    [animateToCoordinate, selectedSpaId, snapInterval, spas],
  );

  const handleBookSpa = useCallback(
    (spa: ExploreSpa) => {
      navigation.navigate('SpaDetails', {
        spaId: spa.id,
        fromScreen: 'Explore',
      });
    },
    [navigation],
  );

  // Stable, so the memoized markers do not all re-render whenever Explore does
  // (an inline arrow here defeated SpaMarker's memo).
  const handleMarkerPress = useCallback(
    (spa: ExploreSpa) => selectSpa(spa, { openSheet: true, syncCard: true }),
    [selectSpa],
  );

  // What to show where the carousel goes when there are no spas to list. A bare map
  // with no cards and no message used to be all the user got.
  const hasLocationAccess = location?.permission === 'granted';
  const emptyState: { title: string; subtitle: string; action?: { label: string; onPress: () => void } } | null =
    spas.length > 0
      ? null
      : !loading && location && !hasLocationAccess
      ? {
          title: 'Location is off',
          subtitle: 'Allow location access to see spas near you.',
          action: { label: 'Open Settings', onPress: () => Linking.openSettings() },
        }
      : spasError
      ? {
          title: "Couldn't load spas",
          subtitle: spasError,
          action: { label: 'Try again', onPress: retrySpas },
        }
      : spasLoading || loading
      ? { title: 'Finding spas near you…', subtitle: '' }
      : { title: 'No spas found nearby', subtitle: 'Try again later or explore another area.' };

  return {
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
    selectedDateId,
    selectedSlotId,
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
  };
}
