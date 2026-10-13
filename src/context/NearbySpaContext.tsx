import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import SpaApi from '../api/SpaApi';
import { useLocation } from './LocationContext';
import type { Spa } from '../types/spa';

import { getSpaDistance } from '../utils/distance';

// Bump the version whenever MappedSpa changes shape so stale caches are dropped.
const CACHE_KEY = 'TOOKA_NEARBY_SPAS_CACHE_V2';
const LEGACY_CACHE_KEY = 'TOOKA_NEARBY_SPAS_CACHE';
const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80';

export interface MappedSpa {
  id: string;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  latitude: number;
  longitude: number;
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
  const lat = parseFloat(spa.lat) || 0;
  const lng = parseFloat(spa.lng) || 0;

  // Format rating and reviews safely
  const ratingVal = parseFloat(String(spa.rating_google)) || 4.5;
  const reviewsCount = parseInt(String(spa.review_count_google), 10) || 0;

  // Derive distance preferring backend distance_m
  const { distanceStr, distanceMeters } = getSpaDistance(spa, userLat, userLng);

  // Parse open status
  let isOpenVal: boolean | null = null;
  if ('isOpen' in spa) {
    isOpenVal = !!(spa as any).isOpen;
  }

  return {
    id: spa.id,
    name: spa.name ?? 'Untitled Spa',
    image: spa.cover_photo_url ?? PLACEHOLDER_IMAGE,
    rating: ratingVal,
    reviewCount: reviewsCount,
    latitude: lat,
    longitude: lng,
    isOpen: isOpenVal,
    distance: distanceStr,
    distanceMeters,
    description: spa.tagline ?? 'A premium relaxation experience offering therapies and massages.',
    address: spa.locality_name ?? spa.city_name ?? 'Location unavailable',
    subtitle: `${distanceStr} Away from you`,
    typeA: 'Massage',
    typeB: 'Spa',
    starting_price: spa.starting_price ?? null,
  };
}
// console.log("MappedAPi: ", mapApiSpaToMappedSpa);

export const NearbySpaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { location, refreshLocation } = useLocation();

  const [spas, setSpas] = useState<MappedSpa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  // Store the active cancel token source to prevent race conditions
  const cancelTokenRef = useRef<any>(null);

  // Load cached first page on startup
  useEffect(() => {
    const loadCache = async () => {
      try {
        AsyncStorage.removeItem(LEGACY_CACHE_KEY).catch(() => {});
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
    const nextPage = pagination ? pagination.page + 1 : 1;
    if (location && location.latitude !== null && location.longitude !== null) {
      fetchSpas(location.latitude, location.longitude, nextPage, nextPage === 1);
    }
  }, [location, pagination, fetchSpas]);

  // Debounced location change listener (500 ms)
  useEffect(() => {
    if (
      !location ||
      location.permission !== 'granted' ||
      location.latitude === null ||
      location.longitude === null
    ) {
      return;
    }

    const handler = setTimeout(() => {
      if (location.latitude !== null && location.longitude !== null) {
        fetchSpas(location.latitude, location.longitude, 1, false);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [location?.latitude, location?.longitude, location?.permission, fetchSpas]);

  // AppState foreground listener to refresh location
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        if (__DEV__) {
          console.log('[NearbySpaContext] App came to foreground. Checking location...');
        }
        await refreshLocation(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshLocation]);

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
