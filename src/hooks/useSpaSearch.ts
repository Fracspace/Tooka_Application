import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios, { type CancelTokenSource } from 'axios';
import SpaApi from '../api/SpaApi';
import type { Spa } from '../types/spa';
import { formatRatingLabel, getSpaBadge, toRatingOrNull } from '../utils/number';

export interface SearchSpaItem {
  id: string;
  name: string;
  subtitle: string;
  /** Display label: "4.7", or "New" when unrated. */
  rating: string;
  reviewCount: number;
  badge: string;
  image: string;
  /** null when the spa has no pin (was 0, i.e. measured from 0,0 - thousands of km). */
  latitude: number | null;
  longitude: number | null;
  /** The backend's own distance from the user, preferred when present. */
  distance_m?: number | string | null;
  starting_price?: string | null;
}

/** Where the user is, so the backend can return the nearest spas first. */
export type SearchOrigin = { latitude?: number | null; longitude?: number | null } | null | undefined;

export interface UseSpaSearchResult {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  debouncedQuery: string;
  searchResults: SearchSpaItem[];
  /** The same results as the API returned them, for screens that map spas themselves. */
  searchSpas: Spa[];
  /** How many spas match in all, across every page. */
  searchTotal: number;
  searchHasMore: boolean;
  searchLoadingMore: boolean;
  loadMoreSearch: () => void;
  isSearching: boolean;
  searchLoading: boolean;
  searchError: string | null;
  searchHasSearched: boolean;
  normalizedQuery: string;
  clearSearch: () => void;
  retrySearch: () => void;
}

const DEBOUNCE_MS = 400;
const MIN_SEARCH_LENGTH = 2;
const PLACEHOLDER_IMAGE = 'https://d2f15ematxpwp4.cloudfront.net/appImages/Spacover.jpg';

export const normalizeSearchQuery = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

export const shouldSearchRequest = (value: string): boolean =>
  normalizeSearchQuery(value).length >= MIN_SEARCH_LENGTH;

const mapSpaToSearchItem = (spa: Spa): SearchSpaItem => {
  const locality = spa.locality_name ?? spa.city_name ?? 'Location unavailable';

  return {
    id: spa.id,
    name: spa.name ?? 'Untitled Spa',
    subtitle: locality,
    rating: formatRatingLabel(toRatingOrNull(spa.rating_google)),
    reviewCount: parseInt(String(spa.review_count_google ?? 0), 10) || 0,
    badge: getSpaBadge(spa),
    image: spa.cover_photo_url === "" ? PLACEHOLDER_IMAGE : spa.cover_photo_url ?? PLACEHOLDER_IMAGE,
    starting_price: spa.starting_price ?? null,
    latitude: Number.parseFloat(spa.lat) || null,
    longitude: Number.parseFloat(spa.lng) || null,
    distance_m: spa.distance_m ?? null,
  };
};

/** Appends a page, dropping spas already shown (pages can overlap as data changes). */
const mergeUnique = (current: Spa[], next: Spa[]): Spa[] => {
  const seen = new Set(current.map((spa) => spa.id));
  const merged = [...current];
  for (const spa of next) {
    if (!seen.has(spa.id)) {
      seen.add(spa.id);
      merged.push(spa);
    }
  }
  return merged;
};

export const useSpaSearch = (origin?: SearchOrigin): UseSpaSearchResult => {
  const [searchQuery, setSearchQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [rawResults, setRawResults] = useState<Spa[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHasSearched, setSearchHasSearched] = useState(false);

  const cancelSourceRef = useRef<CancelTokenSource | null>(null);
  const requestSequenceRef = useRef(0);
  const latestQueryRef = useRef('');
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  // Read at request time, so a location update does not rebuild the callbacks.
  const lat = origin?.latitude ?? null;
  const lng = origin?.longitude ?? null;
  const originRef = useRef({ lat, lng });
  originRef.current = { lat, lng };

  const resetResults = useCallback(() => {
    setRawResults([]);
    setSearchTotal(0);
    setSearchHasMore(false);
    pageRef.current = 1;
  }, []);

  const cancelActiveRequest = useCallback(() => {
    if (cancelSourceRef.current) {
      cancelSourceRef.current.cancel('Search request cancelled');
      cancelSourceRef.current = null;
    }
    requestSequenceRef.current += 1;
    loadingMoreRef.current = false;
    setSearchLoadingMore(false);
  }, []);

  const executeSearch = useCallback(
    async (query: string, { quiet = false }: { quiet?: boolean } = {}) => {
      const normalizedQuery = normalizeSearchQuery(query);

      if (!shouldSearchRequest(normalizedQuery)) {
        cancelActiveRequest();
        latestQueryRef.current = '';
        resetResults();
        setSearchLoading(false);
        setSearchError(null);
        setSearchHasSearched(false);
        return;
      }

      latestQueryRef.current = normalizedQuery;
      setSearchHasSearched(true);
      setSearchError(null);
      // A quiet refresh (the location moved) keeps the current list on screen.
      if (!quiet) {
        setSearchLoading(true);
      }

      cancelActiveRequest();

      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;

      const source = axios.CancelToken.source();
      cancelSourceRef.current = source;

      try {
        const result = await SpaApi.searchSpas(
          normalizedQuery,
          { lat: originRef.current.lat, lng: originRef.current.lng, page: 1 },
          source.token,
        );

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        pageRef.current = result.page;
        setRawResults(mergeUnique([], result.spas));
        setSearchTotal(result.total);
        setSearchHasMore(result.hasMore);
        setSearchError(null);
      } catch (error: any) {
        if (axios.isCancel(error) || requestId !== requestSequenceRef.current) {
          return;
        }

        if (!quiet) {
          setSearchError("Couldn't search spas.");
        }
      } finally {
        if (requestId === requestSequenceRef.current) {
          setSearchLoading(false);
        }
      }
    },
    [cancelActiveRequest, resetResults],
  );

  /** Fetches the next page of the current search and appends it. */
  const loadMoreSearch = useCallback(async () => {
    const query = latestQueryRef.current;
    if (!query || !searchHasMore || searchLoading || loadingMoreRef.current) {
      return;
    }

    loadingMoreRef.current = true;
    setSearchLoadingMore(true);
    const requestId = requestSequenceRef.current;
    const source = axios.CancelToken.source();
    cancelSourceRef.current = source;

    try {
      const result = await SpaApi.searchSpas(
        query,
        { lat: originRef.current.lat, lng: originRef.current.lng, page: pageRef.current + 1 },
        source.token,
      );
      // A new search started meanwhile: this page belongs to the old one.
      if (requestId !== requestSequenceRef.current || query !== latestQueryRef.current) {
        return;
      }
      pageRef.current = result.page;
      setRawResults((current) => mergeUnique(current, result.spas));
      setSearchTotal(result.total);
      setSearchHasMore(result.hasMore);
    } catch (error: any) {
      if (!axios.isCancel(error) && requestId === requestSequenceRef.current) {
        // Keep what is shown; the button stays so the user can try again.
        setSearchError(null);
      }
    } finally {
      if (requestId === requestSequenceRef.current) {
        loadingMoreRef.current = false;
        setSearchLoadingMore(false);
      }
    }
  }, [searchHasMore, searchLoading]);

  useEffect(() => {
    const normalized = normalizeSearchQuery(searchQuery);

    if (!normalized) {
      cancelActiveRequest();
      setDebouncedQuery('');
      resetResults();
      setSearchLoading(false);
      setSearchError(null);
      setSearchHasSearched(false);
      latestQueryRef.current = '';
      return;
    }

    if (!shouldSearchRequest(normalized)) {
      cancelActiveRequest();
      setDebouncedQuery('');
      setSearchLoading(false);
      setSearchError(null);
      setSearchHasSearched(false);
      resetResults();
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedQuery(normalized);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [cancelActiveRequest, resetResults, searchQuery]);

  useEffect(() => {
    if (!debouncedQuery) {
      return;
    }

    void executeSearch(debouncedQuery);
  }, [debouncedQuery, executeSearch]);

  // The location arrived (or really moved, ~1 km) after a search: refresh it
  // quietly so the order is nearest first. A location that is briefly cleared
  // while it refreshes is ignored, and so is GPS jitter.
  const originKey = lat != null && lng != null ? `${lat.toFixed(2)},${lng.toFixed(2)}` : '';
  const lastOriginKeyRef = useRef(originKey);
  useEffect(() => {
    if (!originKey || originKey === lastOriginKeyRef.current) {
      return;
    }
    lastOriginKeyRef.current = originKey;
    if (latestQueryRef.current) {
      executeSearch(latestQueryRef.current, { quiet: true });
    }
  }, [executeSearch, originKey]);

  useEffect(() => () => {
    cancelActiveRequest();
  }, [cancelActiveRequest]);

  const clearSearch = useCallback(() => {
    setSearchQueryState('');
    setDebouncedQuery('');
    latestQueryRef.current = '';
    resetResults();
    setSearchLoading(false);
    setSearchError(null);
    setSearchHasSearched(false);
    cancelActiveRequest();
  }, [cancelActiveRequest, resetResults]);

  const retrySearch = useCallback(() => {
    if (latestQueryRef.current) {
      void executeSearch(latestQueryRef.current);
    }
  }, [executeSearch]);

  const normalizedQuery = useMemo(() => normalizeSearchQuery(searchQuery), [searchQuery]);
  const searchResults = useMemo(() => rawResults.map(mapSpaToSearchItem), [rawResults]);

  return {
    searchQuery,
    setSearchQuery: setSearchQueryState,
    debouncedQuery,
    searchResults,
    searchSpas: rawResults,
    searchTotal,
    searchHasMore,
    searchLoadingMore,
    loadMoreSearch: () => {
      loadMoreSearch();
    },
    isSearching: searchLoading && searchHasSearched,
    searchLoading,
    searchError,
    searchHasSearched,
    normalizedQuery,
    clearSearch,
    retrySearch,
  };
};
