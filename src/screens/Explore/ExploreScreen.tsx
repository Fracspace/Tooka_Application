import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import axios from 'axios';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapViewProps,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SpaApi from '../../api/SpaApi';
import BookingApi from '../../api/BookingApi';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { usePaymentContext } from '../../context/PaymentContext';
import { useLocation } from '../../context/LocationContext';
import { useNearbySpas } from '../../context/NearbySpaContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { ExploreSpa } from '../../types/explore';
import type { SpaDetails } from '../../types/spaDetails';
import type { BookingScheduleDate, BookingSlot } from '../../types/booking';
import type { TimeSlot } from '../Booking/types';
import { bookingOption } from '../Booking/bookingData';
import { buildBookingDateAndTime } from '../../utils/bookingDateTime';
import SpaDetailsContent from '../Home/SpaDetailsContent';

type ExploreNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_COORDINATE = {
  latitude: 17.4308,
  longitude: 78.4101,
};

const MAP_DELTA = {
  latitudeDelta: 0.018,
  longitudeDelta: 0.018,
};

const CARD_SPACING = 14;
const CARD_SIDE_PADDING = 24;

const CardSeparator: React.FC = () => <View style={styles.cardSeparator} />;

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatTabLabel = (date: Date, index: number): string => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return 'Day After';
};

const buildScheduleDates = (): BookingScheduleDate[] => {
  const today = new Date();
  return [0, 1, 2].map((offset) => {
    const date = addDays(today, offset);
    const dateKey = toDateKey(date);
    return {
      id: dateKey,
      label: formatTabLabel(date, offset),
      date: dateKey,
    };
  });
};

const formatTimeLabel = (time: string): string => {
  const [hoursRaw, minutesRaw = '00'] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${pad(twelveHour)}:${pad(minutes)} ${period}`;
};

const getErrorMessage = (error: unknown): string => {
  if (axios.isCancel(error)) return '';
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (error.message.toLowerCase().includes('network')) {
      return 'You are offline. Please check your internet connection.';
    }
  }
  return 'Something went wrong. Please try again.';
};

type SpaMarkerProps = {
  spa: ExploreSpa;
  selected: boolean;
  onPress: (spa: ExploreSpa) => void;
};

const SpaMarker = memo<SpaMarkerProps>(
  ({ spa, selected, onPress }) => {
    const pressScale = useRef(new Animated.Value(1)).current;
    const selectedScale = useRef(
      new Animated.Value(selected ? 1 : 0),
    ).current;

    const [tracksViewChanges, setTracksViewChanges] = useState(true);
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const selectedScaleValue = isTablet
      ? 0.38
      : Platform.OS === 'android'
        ? 0.12
        : 0.18;

    useEffect(() => {
      // Allow Android to redraw marker when selected changes
      setTracksViewChanges(true);

      Animated.spring(selectedScale, {
        toValue: selected ? 1 : 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 8,
      }).start();

      const timer = setTimeout(() => {
        setTracksViewChanges(false);
      }, 250);

      return () => clearTimeout(timer);
    }, [selected, selectedScale]);

    const handlePress = useCallback(() => {
      Animated.sequence([
        Animated.timing(pressScale, {
          toValue: 0.92,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(pressScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 22,
          bounciness: 9,
        }),
      ]).start();

      onPress(spa);
    }, [onPress, pressScale, spa]);

    const animatedScale = Animated.add(
      pressScale,
      selectedScale.interpolate({
        inputRange: [0, 1],
        outputRange: [0, selectedScaleValue],
      }),
    );

    return (
      <Marker
        coordinate={{ latitude: spa.latitude, longitude: spa.longitude }}
        onPress={handlePress}
        tracksViewChanges={tracksViewChanges}
        zIndex={selected ? 999 : 1}
        anchor={{ x: 0.5, y: 0.9 }}>
        <Animated.View
          style={[
            styles.markerWrap,
            selected && styles.markerWrapSelected,
            { transform: [{ scale: animatedScale }] },
          ]}>
          <View style={styles.markerRating}>
            <Ionicons name="star" size={10} color="#D28A00" />
            <Text style={styles.markerRatingText}>{spa.rating.toFixed(1)}</Text>
          </View>
          <View style={[styles.markerImageRing, selected && styles.markedSelected]}>
            <Image
              source={{ uri: spa.image }}
              style={styles.markerImage}
              resizeMode="cover"
              onLoadStart={() => {
                setTracksViewChanges(true);
              }}
              onLoadEnd={() => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    setTracksViewChanges(false);
                  }, 200);
                });
              }}
            />
          </View>
          <View style={[styles.markerPointer, selected && styles.markedSelected]} />
        </Animated.View>
      </Marker>
    );
  });

const ExploreScreen: React.FC = () => {
  const navigation = useNavigation<ExploreNavigationProp>();
  const route = useRoute<any>();
  const paramDateId = route?.params?.selectedDateId;
  const paramSlotId = route?.params?.selectedSlotId;

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { location, loading } = useLocation();

  const mapRef = useRef<MapView | null>(null);
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

  const { spas: contextSpas, loadNextPage, loadingMore } = useNearbySpas();
  const spas = contextSpas as unknown as ExploreSpa[];
  // console.log("Spas in exploreScreen: ", spas);

  const [selectedSpaId, setSelectedSpaId] = useState<string | undefined>(spas[0]?.id);
  const [spaDetails, setSpaDetails] = useState<SpaDetails | null>(null);
  const [spaDetailsLoading, setSpaDetailsLoading] = useState(false);
  const [spaDetailsError, setSpaDetailsError] = useState<string | null>(null);

  const { isAuthenticated, user } = useAuth();
  const { profile } = useProfile();
  const { initiatePayment, setBookingSummary } = usePaymentContext();

  // Availability & Booking State
  const scheduleDates = useMemo(() => buildScheduleDates(), []);
  const [selectedDateId, setSelectedDateId] = useState(
    paramDateId && scheduleDates.some((d) => d.id === paramDateId)
      ? paramDateId
      : scheduleDates[0]?.id ?? '',
  );
  const [selectedSlotId, setSelectedSlotId] = useState(paramSlotId ?? '');
  const pendingSlotIdRef = useRef<string>(paramSlotId ?? '');
  const selectedSlotIdRef = useRef<string>(selectedSlotId);

  useEffect(() => {
    selectedSlotIdRef.current = selectedSlotId;
  }, [selectedSlotId]);

  useEffect(() => {
    if (paramDateId && scheduleDates.some((d) => d.id === paramDateId)) {
      setSelectedDateId(paramDateId);
    }
  }, [paramDateId, scheduleDates]);

  useEffect(() => {
    if (paramSlotId) {
      pendingSlotIdRef.current = paramSlotId;
      setSelectedSlotId(paramSlotId);
    }
  }, [paramSlotId]);

  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availabilityRequestIdRef = useRef(0);
  const availabilityControllerRef = useRef<AbortController | null>(null);

  const selectedDate = useMemo(
    () => scheduleDates.find((d) => d.id === selectedDateId) ?? scheduleDates[0],
    [scheduleDates, selectedDateId],
  );

  const timeSlots = useMemo<TimeSlot[]>(
    () =>
      slots.map((slot) => ({
        id: slot.slotId,
        label: formatTimeLabel(slot.startTime),
        status: slot.status,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    [slots],
  );

  const selectedSlot = useMemo(
    () => slots.find((s) => s.slotId === selectedSlotId && s.status === 'available'),
    [selectedSlotId, slots],
  );

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

  const loadSpaDetails = useCallback(async (spaId: string, options?: { force?: boolean }) => {
    const cachedSpa = detailsCacheRef.current[spaId];
    if (cachedSpa && !options?.force) {
      setSpaDetails(cachedSpa);
      setSpaDetailsError(null);
      setSpaDetailsLoading(false);
      return;
    }

    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

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

  const loadAvailability = useCallback(
    async (targetSpaId?: string, date?: string) => {
      if (!targetSpaId || !date) return;

      availabilityControllerRef.current?.abort();
      const controller = new AbortController();
      availabilityControllerRef.current = controller;
      const requestId = availabilityRequestIdRef.current + 1;
      availabilityRequestIdRef.current = requestId;

      setLoadingSlots(true);
      setAvailabilityError(null);
      if (!pendingSlotIdRef.current && !selectedSlotIdRef.current) {
        setSelectedSlotId('');
      }

      try {
        const nextSlots = await BookingApi.getAvailability({
          spaId: targetSpaId,
          date,
          signal: controller.signal,
        });

        if (availabilityRequestIdRef.current === requestId) {
          setSlots(nextSlots);
          const targetSlotId = pendingSlotIdRef.current || selectedSlotIdRef.current;
          if (
            targetSlotId &&
            nextSlots.some((s) => s.slotId === targetSlotId && s.status === 'available')
          ) {
            setSelectedSlotId(targetSlotId);
          } else if (!nextSlots.some((s) => s.slotId === selectedSlotIdRef.current)) {
            setSelectedSlotId('');
          }
        }
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        if (availabilityRequestIdRef.current === requestId) {
          setSlots([]);
          setAvailabilityError(getErrorMessage(err));
        }
      } finally {
        if (availabilityRequestIdRef.current === requestId) {
          setLoadingSlots(false);
          availabilityControllerRef.current = null;
        }
      }
    },
    [],
  );

  const handleRetryDetails = useCallback(() => {
    if (selectedSpa?.id) {
      loadSpaDetails(selectedSpa.id, { force: true });
    }
  }, [loadSpaDetails, selectedSpa?.id]);

  const handleSelectDate = useCallback((dateId: string) => {
    setSelectedDateId(dateId);
    setSelectedSlotId('');
    pendingSlotIdRef.current = '';
  }, []);

  const handleSelectSlot = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
    pendingSlotIdRef.current = slotId;
  }, []);

  const handleProceedBooking = useCallback(async () => {
    if (spaDetails && spaDetails.is_bookable === false) {
      return;
    }

    if (!selectedSpa?.id) return;

    if (!isAuthenticated) {
      navigation.navigate('Login', {
        spaId: selectedSpa.id,
        openBooking: true,
        selectedDateId,
        selectedSlotId: selectedSlotIdRef.current || selectedSlotId || undefined,
        fromScreen: 'Explore',
      });
      return;
    }

    if (!selectedSlot) {
      Alert.alert('Select Time Slot', 'Please select an available time slot to continue.');
      return;
    }

    const guestName =
      profile?.fullName ??
      profile?.displayName ??
      user?.fullName ??
      user?.userName ??
      'Guest';
    const guestPhone = profile?.phone ?? user?.phoneNumber ?? user?.phone ?? '';

    setSubmitting(true);
    let bookingId = '';
    let bookingReference: string | undefined;
    const appointmentAt = `${selectedSlot.date}T${selectedSlot.startTime}Z`;

    const bookingSummary = {
      spaName: spaDetails?.name ?? selectedSpa.name,
      spaImage: spaDetails?.cover_photo_url ?? selectedSpa.image ?? undefined,
      location: spaDetails?.locality_name ?? spaDetails?.city_name ?? selectedSpa.address ?? undefined,
      serviceName: spaDetails?.name ?? selectedSpa.name,
      serviceDurationMinutes: 60,
      appointmentDate: selectedSlot.date,
      appointmentTime: formatTimeLabel(selectedSlot.startTime),
      bookingDateAndTime: buildBookingDateAndTime({
        appointmentDate: selectedSlot.date,
        appointmentTime: formatTimeLabel(selectedSlot.startTime),
      }),
    };

    try {
      const response = await BookingApi.createDirectBooking({
        spa_id: selectedSpa.id,
        slot_id: selectedSlot.slotId,
        appointment_at: appointmentAt,
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_count: 1,
      });

      bookingId = response.id;
      if (!bookingId) {
        throw new Error('Booking response did not include a booking ID.');
      }
      bookingReference = response.booking_ref ?? undefined;
    } catch (err) {
      Alert.alert('Booking failed', getErrorMessage(err));
      setSubmitting(false);
      return;
    }

    try {
      setBookingSummary(bookingSummary);
      const paymentContext = await initiatePayment(
        bookingId,
        bookingReference,
        bookingSummary,
      );

      navigation.navigate('PaymentScreen', {
        paymentId: paymentContext.paymentId,
        bookingId: paymentContext.bookingId,
        bookingRef: paymentContext.bookingRef,
        paymentSessionId: paymentContext.paymentSessionId,
        cashfreeOrderId: paymentContext.cashfreeOrderId,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        spaName: paymentContext.spaName,
        spaImage: paymentContext.spaImage,
        location: paymentContext.location,
        serviceName: paymentContext.serviceName,
        serviceDurationMinutes: paymentContext.serviceDurationMinutes,
        appointmentDate: paymentContext.appointmentDate,
        appointmentTime: paymentContext.appointmentTime,
        bookingDateAndTime: paymentContext.bookingDateAndTime,
      });
    } catch (err) {
      Alert.alert('Payment initiation failed', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [
    spaDetails,
    selectedSpa,
    isAuthenticated,
    selectedSlot,
    profile,
    user,
    setBookingSummary,
    initiatePayment,
    navigation,
  ]);

  const animateToCoordinate = useCallback((spa: ExploreSpa) => {
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
      setSelectedSlotId('');
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

  useEffect(() => {
    if (!selectedSpa?.id || !isSheetOpen || !selectedDate?.date) {
      return;
    }

    loadAvailability(selectedSpa.id, selectedDate.date);

    return () => {
      availabilityControllerRef.current?.abort();
    };
  }, [isSheetOpen, loadAvailability, selectedDate?.date, selectedSpa?.id]);

  const handleMapReady: MapViewProps['onMapReady'] = useCallback(() => {
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

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderSpaCard = useCallback(
    ({ item }: ListRenderItemInfo<ExploreSpa>) => {
      const selected = item.id === selectedSpaId;

      return (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { width: cardWidth },
            selected && styles.cardSelected,
            pressed && styles.cardPressed,
          ]}
          onPress={() => selectSpa(item, { openSheet: true })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}>
          <Image source={{ uri: item.image }} style={styles.cardImage} />

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  item.isOpen === false && styles.statusPillClosed,
                  item.isOpen === null && { backgroundColor: '#F3EFE8' },
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    item.isOpen === false && styles.statusTextClosed,
                    item.isOpen === null && { color: '#8F8F8F' },
                  ]}>
                  {item.isOpen === null ? 'Unknown' : (item.isOpen ? 'Open now' : 'Closed')}
                </Text>
              </View>
            </View>

            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color="#A7A7A7" />
              <Text style={styles.addressText} numberOfLines={1}>
                {item.address}
              </Text>
            </View>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#F8C51D" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.reviewText}>({formatReviewCount(item.reviewCount)})</Text>
              <Text style={styles.distanceText}>{item.distance}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.bookButton,
                pressed && styles.bookButtonPressed,
              ]}
              onPress={() => handleBookSpa(item)}
              accessibilityRole="button"
              accessibilityLabel={`Book ${item.name}`}>
              <Text style={styles.bookButtonText}>Book Spa</Text>
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [cardWidth, handleBookSpa, selectSpa, selectedSpaId],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, height: 172 }}>
        <ActivityIndicator size="small" color="#FFB02E" />
      </View>
    );
  }, [loadingMore]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          ...origin,
          ...MAP_DELTA,
        }}
        onMapReady={handleMapReady}
        showsCompass
        showsMyLocationButton
        showsUserLocation={location?.permission === 'granted'}
        zoomEnabled
        rotateEnabled
        scrollEnabled
        pitchEnabled
      >
        {spas.map((spa) => (
          <SpaMarker
            key={spa.id}
            spa={spa}
            selected={spa.id === selectedSpaId}
            onPress={(nextSpa) =>
              selectSpa(nextSpa, { openSheet: true, syncCard: true })
            }
          />
        ))}
      </MapView>

      {sheetIndex < 2 && (
        <View style={[styles.topControls, { top: insets.top + 12 }]}>
          <Pressable
            style={styles.circleButton}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[styles.circleButton, styles.locationButton]}
            onPress={handleCurrentLocation}
            accessibilityRole="button"
            accessibilityLabel="Center on current location">
            <Ionicons name="locate" size={23} color="#1F1F1F" />
          </Pressable>
        </View>
      )}

      {loading && (
        <View style={[styles.locationLoading, { top: insets.top + 78 }]}>
          <ActivityIndicator size="small" color="#FFB02E" />
          <Text style={styles.locationLoadingText}>Finding location</Text>
        </View>
      )}
      {sheetIndex < 2 && (
        <FlatList<ExploreSpa>
          ref={listRef}
          data={spas}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={renderSpaCard}
          snapToInterval={snapInterval}
          decelerationRate="fast"
          disableIntervalMomentum
          onMomentumScrollEnd={handleMomentumEnd}
          contentContainerStyle={[
            styles.cardListContent,
            styles.cardListHorizontalPadding,
            Platform.OS === 'android' && styles.cardListAndroidPadding,
          ]}
          ItemSeparatorComponent={CardSeparator}
          getItemLayout={(_, index) => ({
            length: snapInterval,
            offset: snapInterval * index,
            index,
          })}
          style={[styles.cardList, { bottom: cardListBottom }]}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}

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
        animationConfigs={{
          duration: 320,
        }}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}>
        {selectedSpa && (
          <BottomSheetScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <SpaDetailsContent
              spa={spaDetails}
              loading={spaDetailsLoading}
              error={spaDetailsError}
              onRetry={handleRetryDetails}
              onBack={() => sheetRef.current?.close()}
              showBackButton={false}
              dates={scheduleDates}
              selectedDateId={selectedDateId}
              onSelectDate={handleSelectDate}
              slots={timeSlots}
              selectedSlotId={selectedSlotId}
              onSelectSlot={handleSelectSlot}
              loadingSlots={loadingSlots}
              availabilityError={availabilityError}
              bookingOption={bookingOption}
              onProceedBooking={handleProceedBooking}
              proceedLoading={submitting}
              proceedDisabled={!selectedSlot}
            />
          </BottomSheetScrollView>
        )}
      </BottomSheet>
    </View>
  );
};

const formatReviewCount = (count: number) => {
  if (count >= 1000) {
    return `${Number((count / 1000).toFixed(1))}K`;
  }

  return String(count);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE8',
  },
  topControls: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 74, 74, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  locationButton: {
    backgroundColor: '#FFFFFF',
  },
  locationLoading: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  locationLoadingText: {
    marginLeft: 8,
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 12,
    color: '#5B5B5B',
  },
  markerWrap: {
    alignItems: 'center',
  },
  markerWrapSelected: {
    zIndex: 20,
  },
  markerRating: {
    marginBottom: -2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    // shadowColor: '#000',
    // shadowOpacity: 0.16,
    // shadowRadius: 8,
    // shadowOffset: { width: 0, height: 3 },
    // elevation: 5,
  },
  markerRatingText: {
    marginLeft: 3,
    fontFamily: 'WorkSans-Bold',
    fontSize: 12,
    color: '#444444',
  },
  markerImageRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    borderColor: '#423d369e',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  markerImage: {
    width: '100%',
    height: '100%',
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 13,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#423d369e',
    marginTop: -2,
  },
  markedSelected: {
    borderColor: '#FFB02E',
    borderTopColor: '#FFB02E'
  },
  cardList: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cardListContent: {
    alignItems: 'flex-end',
  },
  cardListHorizontalPadding: {
    paddingHorizontal: CARD_SIDE_PADDING,
  },
  cardListAndroidPadding: {
    paddingBottom: 4,
  },
  cardSeparator: {
    width: CARD_SPACING,
  },
  card: {
    minHeight: 172,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardSelected: {
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 46, 0.5)',
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardImage: {
    width: 92,
    borderRadius: 13,
    backgroundColor: '#F1ECE4',
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    marginRight: 10,
    fontFamily: 'Sora-SemiBold',
    fontSize: 17,
    color: '#202020',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#21B84D',
  },
  statusPillClosed: {
    backgroundColor: '#F3EFE8',
  },
  statusText: {
    fontFamily: 'WorkSans-Bold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  statusTextClosed: {
    color: '#8F8F8F',
  },
  addressRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    flex: 1,
    marginLeft: 5,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9B9B9B',
  },
  ratingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 5,
    fontFamily: 'WorkSans-Bold',
    fontSize: 13,
    color: '#3C3C3C',
  },
  reviewText: {
    marginLeft: 4,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9A9A9A',
  },
  distanceText: {
    marginLeft: 10,
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 12,
    color: '#A5A5A5',
  },
  bookButton: {
    height: 38,
    marginTop: 15,
    borderRadius: 7,
    backgroundColor: '#FFB02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonPressed: {
    opacity: 0.82,
  },
  bookButtonText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFF8EF',
  },
  sheetHandle: {
    width: 72,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#858585',
  },
  sheetContent: {
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 50,
  },
});

export default ExploreScreen;
