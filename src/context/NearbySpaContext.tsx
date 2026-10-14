import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import SpaApi from '../api/SpaApi';
import { useLocation } from './LocationContext';
import type { Spa } from '../types/spa';

import { getSpaDistance } from '../utils/distance';
import { toRatingOrNull } from '../utils/number';

// Bump the version whenever MappedSpa changes shape so stale caches are dropped.
const CACHE_KEY = 'TOOKA_NEARBY_SPAS_CACHE_V3';
const LEGACY_CACHE_KEYS = ['TOOKA_NEARBY_SPAS_CACHE', 'TOOKA_NEARBY_SPAS_CACHE_V2'];
const PLACEHOLDER_IMAGE = 'https://d2f15ematxpwp4.cloudfront.net/appImages/Spacover.jpg';

/** Amenity flags worth a tag on a card, in priority order. */
const FEATURE_TAGS: [keyof Spa, string][] = [
  ['has_jacuzzi', 'Jacuzzi'],
  ['has_sauna', 'Sauna'],
  ['has_steam_room', 'Steam room'],
  ['has_couple_room', 'Couple room'],
];

const toTitleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const parseCoordinate = (value: string | null | undefined): number | null => {
  const parsed = parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
};

export interface MappedSpa {
  id: string;
  name: string;
  image: string;
  /** null until the spa has been rated - shown as "New", never as a made-up 4.5. */
  rating: number | null;
  reviewCount: number;
  /** null when the spa has no map pin (lat/lng missing), so no marker is drawn. */
  latitude: number | null;
  longitude: number | null;
  isOpen: boolean | null;
  distance: string;
  distanceMeters?: number | null;
  description: string;
  address: string;
  subtitle: string;
  typeA: string;
  typeB: string;
  starting_price?: string | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalRecords: number;
  hasMore: boolean;
}

interface NearbySpaContextType {
  spas: MappedSpa[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  refresh: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  retry: () => void;
}

const NearbySpaContext = createContext<NearbySpaContextType | undefined>(undefined);

// Data mapper from API model to UI model
export function mapApiSpaToMappedSpa(
  spa: Spa,
  userLat: number,
  userLng: number,
): MappedSpa {
  const reviewsCount = parseInt(String(spa.review_count_google), 10) || 0;

  // Derive distance preferring backend distance_m
  const { distanceStr, distanceMeters } = getSpaDistance(spa, userLat, userLng);

  // The API reports "closed today" but not "open right now", so only a known
  // closure is shown; otherwise the status stays unknown (null).
  const isOpenVal: boolean | null = spa.is_closed_today === true ? false : null;

  // Card tags come from the spa itself. They were hardcoded 'Massage' / 'Spa'.
  const categoryTag = spa.category?.trim() ? toTitleCase(spa.category) : '';
  const featureTag = FEATURE_TAGS.find(([flag]) => spa[flag] === true)?.[1] ?? '';

  return {
    id: spa.id,
    name: spa.name ?? 'Untitled Spa',
    image: spa.cover_photo_url || spa.images?.find((img) => img?.url)?.url || PLACEHOLDER_IMAGE,
    rating: toRatingOrNull(spa.rating_google),
    reviewCount: reviewsCount,
    latitude: parseCoordinate(spa.lat),
    longitude: parseCoordinate(spa.lng),
    isOpen: isOpenVal,
    distance: distanceStr,
    distanceMeters,
    description: spa.tagline ?? '',
    address: spa.locality_name ?? spa.city_name ?? 'Location unavailable',
    // No distance known: show where it is instead of "-- Away from you".
    subtitle: distanceMeters != null ? `${distanceStr} Away from you` : spa.locality_name ?? spa.city_name ?? '',
    typeA: categoryTag,
    typeB: featureTag,
    starting_price: spa.starting_price ?? null,
  };
}
// console.log("MappedAPi: ", mapApiSpaToMappedSpa);

export const NearbySpaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { location } = useLocation();

  const [spas, setSpas] = useState<MappedSpa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  // Store the active cancel token source to prevent race conditions
  const cancelTokenRef = useRef<any>(null);
  // The page whose request failed, so Retry asks for that page again. Retry used
  // to request pagination.page + 1, which skipped ahead after a failed refresh.
  const failedPageRef = useRef<number | null>(null);

  // Load cached first page on startup
  useEffect(() => {
    const loadCache = async () => {
      try {
        LEGACY_CACHE_KEYS.forEach((key) => AsyncStorage.removeItem(key).catch(() => {}));
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as MappedSpa[];
          if (parsed && parsed.length > 0) {
            setSpas(parsed);
            setLoading(false);
          }
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[NearbySpaContext] Failed to load cache:', err);
        }
      }
    };
    loadCache();
  }, []);

  // Fetch function
  const fetchSpas = useCallback(
    async (
      lat: number,
      lng: number,
      targetPage: number,
      isRefresh: boolean,
    ) => {
      // Cancel any ongoing requests
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('Request cancelled due to a new request starting');
      }

      const cancelTokenSource = axios.CancelToken.source();
      cancelTokenRef.current = cancelTokenSource;

      if (isRefresh) {
        setRefreshing(true);
      } else if (targetPage > 1) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError(null);

      if (__DEV__) {
        console.log(
          `[NearbySpaContext] Requesting page ${targetPage} for lat: ${lat}, lng: ${lng}`,
        );
      }

      try {
        const response = await SpaApi.getNearbySpas(
          lat,
          lng,
          targetPage,
          20, // Page size
          cancelTokenSource.token,
        );

//         console.log(
//   '========== NEARBY PAGINATION DEBUG ==========',
// );
// console.log('Requested page:', targetPage);
// console.log('Full response:', JSON.stringify(response, null, 2));
// console.log('response.data:', response?.data);
// console.log('response.pagination:', response?.pagination);
// console.log('============================================');

        // const newSpasRaw: Spa[] = response?.data?.spas || [];
        const newSpasRaw: Spa[] = Array.isArray(response?.data)
          ? response.data
          : [];
        const meta = response?.meta;
        // const meta = null;
        // console.log("Nearby spas", response?.data.length);
        // console.log('========== API RESPONSE ==========');
        // console.log(JSON.stringify(response, null, 2));
        // console.log('==================================');

        // console.log('response.data:', response.data);

        // console.log(
        //   'response.data is array:',
        //   Array.isArray(response.data),
        // );

        // console.log(
        //   'response.data.data is array:',
        //   Array.isArray(response?.data?.data),
        // );

        // console.log(
        //   'response.data.spas:',
        //   response?.data?.spas,
        // );

        // console.log(
        //   'response.pagination:',
        //   response?.pagination,
        // );

        failedPageRef.current = null;
        const mappedNewSpas = newSpasRaw.map((spa) =>
          mapApiSpaToMappedSpa(spa, lat, lng),
        );
        // console.log("Updated spas: ", mappedNewSpas);

        if (__DEV__) {
          console.log(
            `[NearbySpaContext] Received ${mappedNewSpas.length} items. Total pages:`,
          );
        }

        setSpas((prev) => {
          let updatedSpas: MappedSpa[];
          if (isRefresh || targetPage === 1) {
            updatedSpas = mappedNewSpas;
            // Update cache only if data changed. Compare full items, not just ids,
            // so price / rating / distance updates for the same spas aren't dropped.
            const isDifferent =
              JSON.stringify(prev) !== JSON.stringify(mappedNewSpas);

            if (isDifferent) {
              AsyncStorage.setItem(CACHE_KEY, JSON.stringify(mappedNewSpas)).catch(
                (cacheErr) => {
                  if (__DEV__) {
                    console.warn('[NearbySpaContext] Cache save failed:', cacheErr);
                  }
                },
              );
            } else {
              if (__DEV__) {
                console.log('[NearbySpaContext] Data identical to cache, omitting state update.');
              }
              return prev; // No state change needed
            }
          } else {
            // Merge by ID to protect from duplicates
            const existingIds = new Set(prev.map((s) => s.id));
            const uniqueNewSpas = mappedNewSpas.filter((s) => !existingIds.has(s.id));
            updatedSpas = [...prev, ...uniqueNewSpas];
          }
          // console.log("Updated spas: ", updatedSpas);

          return updatedSpas;
        });

        if (meta) {
          // setPagination({
          //   page: meta.page || targetPage,
          //   totalPages: meta.total_pages || 1,
          //   totalRecords: meta.total_records || 0,
          // });
          setPagination({
            page: meta.page,
            limit: meta.limit,
            totalRecords: meta.total,
            hasMore: meta.hasMore,
          });
        }
      } catch (err: any) {
        if (axios.isCancel(err)) {
          if (__DEV__) {
            console.log('[NearbySpaContext] Request cancelled:', err.message);
          }
          return;
        }

        const errMsg = err?.message || 'Something went wrong';
        if (__DEV__) {
          console.error('[NearbySpaContext] API Error:', errMsg);
        }

        // For pagination failures, keep current data and set error
        failedPageRef.current = targetPage;
        setError(errMsg);
      } finally {
        // Only turn off loaders if this cancel token is still active
        if (cancelTokenRef.current === cancelTokenSource) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (
      !location ||
      location.permission !== 'granted' ||
      location.latitude === null ||
      location.longitude === null
    ) {
      setError('Location permission or coordinates unavailable');
      setLoading(false);
      return;
    }
    await fetchSpas(location.latitude, location.longitude, 1, true);
  }, [location, fetchSpas]);

  const loadNextPage = useCallback(async () => {
    if (
      loadingMore ||
      refreshing ||
      !pagination?.hasMore ||
      !location ||
      location.latitude === null ||
      location.longitude === null
    ) {
      return;
    }

    await fetchSpas(
      location.latitude,
      location.longitude,
      pagination.page + 1,
      false,
    );
  }, [loadingMore, refreshing, pagination, location, fetchSpas]);

  const retry = useCallback(() => {
    const page = failedPageRef.current ?? 1;
    if (location && location.latitude !== null && location.longitude !== null) {
      fetchSpas(location.latitude, location.longitude, page, page === 1);
    }
  }, [location, fetchSpas]);

  // Debounced location change listener (500 ms). Depends on the primitives, not
  // the location object, so unrelated location updates do not refetch.
  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;
  const permission = location?.permission;
  useEffect(() => {
    if (permission !== 'granted' || latitude === null || longitude === null) {
      return;
    }

    const handler = setTimeout(() => {
      fetchSpas(latitude, longitude, 1, false);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [latitude, longitude, permission, fetchSpas]);

  // No foreground listener here: LocationContext already refreshes location when
  // the app becomes active, and the debounced effect above refetches on change.
  // Doing both ran every location check twice.

  // Cleanup active request on unmount
  useEffect(() => {
    return () => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('Component unmounted');
      }
    };
  }, []);

  return (
    <NearbySpaContext.Provider
      value={{
        spas,
        loading: loading && spas.length === 0, // only show main loading when we don't even have cache
        refreshing,
        loadingMore,
        error,
        pagination,
        refresh,
        loadNextPage,
        retry,
      }}
    >
      {children}
    </NearbySpaContext.Provider>
  );
};

export const useNearbySpas = () => {
  const context = useContext(NearbySpaContext);
  if (context === undefined) {
    throw new Error('useNearbySpas must be used within a NearbySpaProvider');
  }
  return context;
};
