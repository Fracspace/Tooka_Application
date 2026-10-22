import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type MapView from 'react-native-maps';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { wellnessMoments as wellnessMomentsData, wellnessInsight as wellnessInsightData } from '../data/homeData';
import { useSpaDiscovery } from './useSpaDiscovery';
import { useLocation } from '../context/LocationContext';
import { useNearbySpas } from '../context/NearbySpaContext';
import { useSpaSearch } from './useSpaSearch';
import { useMyBookings } from './useMyBookings';
import { getOnboarding } from '../utils/onboardingStorage';
import { onboardingData } from '../screens/Onboarding/onboardingData';
import type { OnboardingAnswers } from '../screens/Onboarding/types';
import type { Spa } from '../types/spa';
import { getSpaDistance } from '../utils/distance';
import {
  formatPrice,
  formatRatingLabel,
  formatReviewsLabel,
  getSpaBadge,
  toRatingOrNull,
} from '../utils/number';
import { getLocationDisplayParts } from '../services/locationAddress';
import { useProfile } from '../context/ProfileContext';
import { Analytics, AnalyticsEvents } from '../services/firebase/analytics';
import { Crashlytics } from '../services/firebase/crashlytics';

// Onboarding goals matched against a spa's name, category and tagline. Spas
// that match go first in the spotlight; nothing is dropped.
const GOAL_MATCHERS: Record<string, { tag: string; test: (spa: Spa, text: string) => boolean }> = {
  relax_massage: { tag: 'Massage', test: (_, t) => /massage|swedish|relax/.test(t) },
  recovery_pain: { tag: 'Recovery', test: (_, t) => /deep tissue|sports|physio|therap|pain/.test(t) },
  beauty_skin: { tag: 'Beauty', test: (_, t) => /beauty|salon|skin|facial|glow/.test(t) },
  wellness_ayurveda: { tag: 'Ayurveda', test: (_, t) => /ayur|herbal|kerala/.test(t) },
  steam_spa: {
    tag: 'Steam',
    test: (s, t) => Boolean(s.has_steam_room || s.has_sauna || s.has_jacuzzi) || /steam|sauna/.test(t),
  },
  stress_relief: { tag: 'Calm', test: (_, t) => /massage|aroma|relax|stress/.test(t) },
};

const ONBOARDING_LABELS = new Map(
  onboardingData.flatMap((step) => step.options.map((o) => [o.id, o.label] as const)),
);

const toNumberOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return value != null && value !== '' && Number.isFinite(n) ? n : null;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export interface FeaturedSpaItem {
  id: string;
  name: string;
  location: string;
  distance: string;
  rating: string;
  reviews: string;
  price: string;
  oldPrice?: string;
  badge: string;
  image: string;
  favorite: boolean;
}

export interface NearbySpaItem {
  id: string;
  name: string;
  subtitle: string;
  typeA: string;
  typeB: string;
  rating: string;
  image: string;
  latitude: number | null;
  longitude: number | null;
  price: string | null;
}


/** A spotlight card: a curated spa plus what the v4 filters and tags need. */
export interface SpotlightSpaItem extends FeaturedSpaItem {
  /** "MATCHES AYURVEDA", "PREMIUM", "NEW ON TOOKA" or ''. */
  tag: string;
  priceValue: number | null;
  /** false only when the API says the spa is closed today. */
  openToday: boolean;
  coupleRoom: boolean;
}

export type SpotlightSort = 'recommended' | 'priceLow' | 'priceHigh';

export interface NearbyListItem extends NearbySpaItem {
  distance: string;
  distanceMeters: number | null;
  area: string;
}

export interface WellnessMomentItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  big?: boolean;
}

export interface WellnessInsightItem {
  id: string;
  title: string;
  description: string;
  image: string;
}

const PLACEHOLDER_IMAGE = 'https://d2f15ematxpwp4.cloudfront.net/appImages/Spacover.jpg';

// Data loading and actions for the Home screen; the screen only lays them out.
export function useHomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { profile } = useProfile();

  const { location, loading: locationLoading } = useLocation();
  // console.log("User locartionL ", location);
  const {
    spas: contextSpas,
    loading: contextLoading,
    refreshing: contextRefreshing,
    refresh: contextRefresh,
    error: contextError,
    loadNextPage,
    loadingMore,
    pagination,
    retry,
  } = useNearbySpas();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    searchError,
    normalizedQuery,
    retrySearch,
    clearSearch,
  } = useSpaSearch();
  // console.log("Context spa: ", contextSpas, "Search Results: ", searchResults);

  const nearbySpas = useMemo<NearbySpaItem[]>(
    () =>
      contextSpas.map((s) => ({
        id: s.id,
        name: s.name,
        subtitle: s.subtitle,
        typeA: s.typeA,
        typeB: s.typeB,
        rating: formatRatingLabel(s.rating),
        image: s.image,
        latitude: s.latitude,
        longitude: s.longitude,
        price: formatPrice(s.starting_price),
      })),
    [contextSpas],
  );

  //   const navigation = useNavigation();

  // const { spas } = useNearbySpa();
  // const { location } = useLocation();

  useEffect(() => {
    // Analytics.logScreen(AnalyticsScreens.Home);

    Analytics.logEvent(AnalyticsEvents.HOME_VIEWED);
  }, []);
  useEffect(() => {
    Crashlytics.log('Application Started');
  }, []);



  const wellnessMoments = wellnessMomentsData as WellnessMomentItem[];
  const wellnessInsight = wellnessInsightData as WellnessInsightItem;

  // null until a city is known: wait for location instead of fetching a default
  // ('Hyderabad' was fetched first, then aborted and refetched, and became the
  // "curated" city for users with no location at all).
  const resolvedCity = useMemo(() => {
    if (locationLoading) return null;
    const pCity = profile?.city?.trim();
    const lCity = location?.city?.trim();
    return lCity || pCity || null;
  }, [profile?.city, location?.city, locationLoading]);

  const { spas, loading, error, refreshing, refetch, onRefresh } = useSpaDiscovery(resolvedCity);

  const locationDisplay = useMemo(() => {
    const address = location ? {
      locality: location.locality ?? null,
      subLocality: location.subLocality ?? null,
      city: location.city ?? null,
      state: location.state ?? null,
      country: location.country ?? null,
    } : null;

    return getLocationDisplayParts(address, { isLoading: locationLoading });
  }, [location, locationLoading]);

  const handlePressLocation = useCallback(() => {
    navigation.navigate('LocationSelection');
  }, [navigation]);

  // console.log("Curated spas: ", spas);

  const featuredSpas = useMemo<FeaturedSpaItem[]>(
    () =>
      spas.map((spa) => {
        const { distanceStr } = getSpaDistance(
          spa,
          location?.latitude,
          location?.longitude,
        );
        return {
          id: spa.id,
          name: spa.name ?? 'Untitled Spa',
          location: spa.locality_name ?? spa.city_name ?? '',
          distance: distanceStr === '--' ? '' : distanceStr,
          rating: formatRatingLabel(toRatingOrNull(spa.rating_google)),
          reviews: formatReviewsLabel(spa.review_count_google),
          price: formatPrice(spa.starting_price) ?? '',
          oldPrice: '',
          badge: getSpaBadge(spa),
          image: spa.cover_photo_url ?? PLACEHOLDER_IMAGE,
          favorite: false,
        };
      }),
    [spas, location?.latitude, location?.longitude],
  );

  const mapRef = useRef<MapView | null>(null);

  const handleMapReady = useCallback(() => {
    if (location?.latitude != null && location?.longitude != null) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        300,
      );
    }
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    if (location?.latitude != null && location?.longitude != null) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        500,
      );
    }
  }, [location?.latitude, location?.longitude]);

  const previewSpas = useMemo(() => {
    if (nearbySpas.length > 0) {
      return nearbySpas
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          name: s.name,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
        }))
        .filter(
          (s) =>
            !isNaN(s.latitude) &&
            !isNaN(s.longitude) &&
            s.latitude !== 0 &&
            s.longitude !== 0,
        );
    }

    return spas
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.name,
        latitude: Number(s.lat),
        longitude: Number(s.lng),
      }))
      .filter(
        (s) =>
          !isNaN(s.latitude) &&
          !isNaN(s.longitude) &&
          s.latitude !== 0 &&
          s.longitude !== 0,
      );
  }, [nearbySpas, spas]);

  const isSearchActive = normalizedQuery.length >= 2;

  const mappedSearchResults = useMemo<FeaturedSpaItem[]>(() => {
    // console.log("Search Results: ", searchResults);
    return searchResults.map((spa) => {
      const { distanceStr } = getSpaDistance(
        { lat: spa.latitude, lng: spa.longitude, distance_m: spa.distance_m },
        location?.latitude,
        location?.longitude,
      );
      // console.log("Mapped Search Results: ", spa, distanceStr);
      return {
        id: spa.id,
        name: spa.name ?? 'Untitled Spa',
        location: spa.subtitle ?? '',
        distance: distanceStr === '--' ? '' : distanceStr,
        rating: spa.rating,
        reviews: formatReviewsLabel(spa.reviewCount),
        price: formatPrice(spa.starting_price) ?? '',
        oldPrice: '',
        badge: spa.badge,
        image: spa.image === "" ? PLACEHOLDER_IMAGE : spa.image ?? PLACEHOLDER_IMAGE,
        favorite: false,
      };
    });
  }, [searchResults, location?.latitude, location?.longitude]);

  const curatedList = useMemo<FeaturedSpaItem[]>(() => {
    if (isSearchActive) {
      return mappedSearchResults;
    }
    return featuredSpas;
  }, [featuredSpas, isSearchActive, mappedSearchResults]);

  const shouldShowSearchLoading = isSearchActive && searchLoading;
  const shouldShowSearchEmptyState = isSearchActive && !searchLoading && !searchError && curatedList.length === 0;
  const shouldShowSearchError = isSearchActive && Boolean(searchError) && curatedList.length === 0;
  // console.log("Preview Spa: ", previewSpas);

  const handlePressSpaCard = useCallback(
    (spaId: string) => {
      navigation.navigate('SpaDetails', { spaId });
    },
    [navigation],
  );

  const handleFavoritePress = useCallback(() => undefined, []);

  // v4 spotlight: open the tapped card as swipeable Spa Details cards.
  const handleOpenSpotlight = useCallback(
    (items: FeaturedSpaItem[], index: number) => {
      navigation.navigate('SpotlightDetails', {
        spas: items.map(({ id, name, image }) => ({ id, name, image })),
        index,
      });
    },
    [navigation],
  );

  // The wellness moment cards did nothing when tapped.
  const handleOpenExplore = useCallback(() => {
    navigation.navigate('Explore');
  }, [navigation]);


  const handleOpenArticle = useCallback(() => {
    navigation.navigate('wellnessArticle');
  }, [navigation]);

  const isRefreshing = refreshing || contextRefreshing;

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      onRefresh(),
      contextRefresh().catch(() => { }),
    ]);
  }, [onRefresh, contextRefresh]);

  const isInitialLoading = (loading && spas.length === 0) ||
    (contextLoading && contextSpas.length === 0 && location?.permission === 'granted');
  const shouldRenderEmptyState = !loading && !error && featuredSpas.length === 0;

  // v4 Home: next visit, spotlight ranked by the saved onboarding answers, and
  // the nearby list closest first.
  const { upcomingBookings } = useMyBookings();
  const nextVisit = upcomingBookings[0] ?? null;

  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers | null>(null);
  useEffect(() => {
    let active = true;
    getOnboarding()
      .then((data) => {
        if (active) setOnboardingAnswers(data?.answers ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const onboardingPicksLabel = useMemo(
    () =>
      (onboardingAnswers?.goals ?? [])
        .map((id) => ONBOARDING_LABELS.get(id))
        .filter(Boolean)
        .join(', '),
    [onboardingAnswers],
  );

  const [spotlightSort, setSpotlightSort] = useState<SpotlightSort>('recommended');
  const [openTodayOnly, setOpenTodayOnly] = useState(false);
  const [couplesOnly, setCouplesOnly] = useState(false);

  const rankedSpotlight = useMemo<SpotlightSpaItem[]>(() => {
    const goals = onboardingAnswers?.goals ?? [];
    const prefs = new Set(onboardingAnswers?.preferences ?? []);
    const scored = spas.map((spa, index) => {
      const item = featuredSpas[index];
      const text = `${spa.name ?? ''} ${spa.category ?? ''} ${spa.tagline ?? ''}`.toLowerCase();
      const matched = goals.map((g) => GOAL_MATCHERS[g]).filter((m) => m?.test(spa, text));
      const rating = toRatingOrNull(spa.rating_google) ?? 0;
      const priceValue = toNumberOrNull(spa.starting_price);
      const meters = toNumberOrNull(spa.distance_m);
      let score = matched.length * 100;
      if (prefs.has('top_rated')) score += rating * 4;
      if (prefs.has('nearby_spas') && meters != null) score += Math.max(0, 20 - meters / 1000);
      if (prefs.has('best_value') && priceValue != null) score += Math.max(0, 20 - priceValue / 250);
      if (prefs.has('premium') && spa.is_premium) score += 20;
      if (prefs.has('couple_friendly') && spa.has_couple_room) score += 20;
      if (prefs.has('authentic') && GOAL_MATCHERS.wellness_ayurveda.test(spa, text)) score += 20;
      const badge = item.badge || (item.rating === 'New' ? 'New on Tooka' : '');
      return {
        index,
        score,
        item: {
          ...item,
          tag: (matched[0] ? `Matches ${matched[0].tag}` : badge).toUpperCase(),
          priceValue,
          openToday: spa.is_closed_today !== true,
          coupleRoom: spa.has_couple_room === true,
        },
      };
    });
    return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.item);
  }, [spas, featuredSpas, onboardingAnswers]);

  const spotlightSpas = useMemo(() => {
    let list = rankedSpotlight.filter(
      (s) => (!openTodayOnly || s.openToday) && (!couplesOnly || s.coupleRoom),
    );
    if (spotlightSort !== 'recommended') {
      const dir = spotlightSort === 'priceLow' ? 1 : -1;
      list = list
        .slice()
        .sort((a, b) =>
          a.priceValue == null ? 1 : b.priceValue == null ? -1 : (a.priceValue - b.priceValue) * dir,
        );
    }
    return list;
  }, [rankedSpotlight, openTodayOnly, couplesOnly, spotlightSort]);

  const hasCoupleRooms = useMemo(() => rankedSpotlight.some((s) => s.coupleRoom), [rankedSpotlight]);

  const nearbyClosestFirst = useMemo<NearbyListItem[]>(
    () =>
      contextSpas
        .map((s, i) => ({
          ...nearbySpas[i],
          distance: s.distanceMeters != null ? s.distance : '',
          distanceMeters: s.distanceMeters ?? null,
          area: s.address,
        })),
    [contextSpas, nearbySpas],
  );

  return {
    isTablet,
    profile,
    location,
    locationLoading,
    locationDisplay,
    resolvedCity,
    spas,
    loading,
    error,
    refetch,
    contextError,
    loadNextPage,
    loadingMore,
    pagination,
    retry,
    searchQuery,
    setSearchQuery,
    retrySearch,
    clearSearch,
    isSearchActive,
    shouldShowSearchLoading,
    shouldShowSearchEmptyState,
    shouldShowSearchError,
    curatedList,
    featuredSpas,
    nearbySpas,
    previewSpas,
    mapRef,
    handleMapReady,
    wellnessMoments,
    wellnessInsight,
    handlePressLocation,
    handlePressSpaCard,
    handleOpenSpotlight,
    handleFavoritePress,
    handleOpenExplore,
    handleOpenArticle,
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
  };
}
