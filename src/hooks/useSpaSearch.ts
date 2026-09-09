import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios, { type CancelTokenSource } from 'axios';
import SpaApi from '../api/SpaApi';
import type { Spa } from '../types/spa';

export interface SearchSpaItem {
  id: string;
  name: string;
  subtitle: string;
  typeA: string;
  typeB: string;
  rating: string;
  image: string;
  latitude: number;
  longitude: number;
  starting_price?: string | null;
}

export interface UseSpaSearchResult {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  debouncedQuery: string;
  searchResults: SearchSpaItem[];
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
  const rating = Number(spa.rating_google ?? 0);
  const safeRating = Number.isFinite(rating) ? rating.toFixed(1) : '0.0';

  return {
    id: spa.id,
    name: spa.name ?? 'Untitled Spa',
    subtitle: locality,
    typeA: 'Massage',
    typeB: 'Spa',
    rating: safeRating,
    image: spa.cover_photo_url === "" ? PLACEHOLDER_IMAGE : spa.cover_photo_url ?? PLACEHOLDER_IMAGE,
    starting_price: spa.starting_price ?? null,
    latitude: Number.parseFloat(spa.lat) || 0,
    longitude: Number.parseFloat(spa.lng) || 0,
  };
};

export const useSpaSearch = (): UseSpaSearchResult => {
  const [searchQuery, setSearchQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchSpaItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHasSearched, setSearchHasSearched] = useState(false);

  const cancelSourceRef = useRef<CancelTokenSource | null>(null);
  const requestSequenceRef = useRef(0);
  const latestQueryRef = useRef('');

  const cancelActiveRequest = useCallback(() => {
    if (cancelSourceRef.current) {
      cancelSourceRef.current.cancel('Search request cancelled');
      cancelSourceRef.current = null;
    }
    requestSequenceRef.current += 1;
  }, []);

  const executeSearch = useCallback(
    async (query: string) => {
      const normalizedQuery = normalizeSearchQuery(query);

      if (!shouldSearchRequest(normalizedQuery)) {
        cancelActiveRequest();
        latestQueryRef.current = '';
        setSearchResults([]);
        setSearchLoading(false);
        setSearchError(null);
        setSearchHasSearched(false);
        return;
      }

      latestQueryRef.current = normalizedQuery;
      setSearchHasSearched(true);
      setSearchError(null);
      setSearchLoading(true);

      cancelActiveRequest();

      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;

      const source = axios.CancelToken.source();
      cancelSourceRef.current = source;

      try {
        const data = await SpaApi.searchSpas(normalizedQuery, source.token);

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        const nextResults = Array.isArray(data)
          ? data.map(mapSpaToSearchItem)
          : [];

        const uniqueResults = nextResults.filter(
          (item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index,
        );

        setSearchResults(uniqueResults);
        setSearchError(null);
      } catch (error: any) {
        if (axios.isCancel(error) || requestId !== requestSequenceRef.current) {
          return;
        }

        setSearchResults((current) => current);
        setSearchError("Couldn't search spas.");
      } finally {
        if (requestId === requestSequenceRef.current) {
          setSearchLoading(false);
        }
      }
    },
    [cancelActiveRequest],
  );

  useEffect(() => {
    const normalized = normalizeSearchQuery(searchQuery);

    if (!normalized) {
      cancelActiveRequest();
      setDebouncedQuery('');
      setSearchResults([]);
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
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedQuery(normalized);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [cancelActiveRequest, searchQuery]);

  useEffect(() => {
    if (!debouncedQuery) {
      return;
    }

    void executeSearch(debouncedQuery);
  }, [debouncedQuery, executeSearch]);

  useEffect(() => () => {
    cancelActiveRequest();
  }, [cancelActiveRequest]);

  const clearSearch = useCallback(() => {
    setSearchQueryState('');
    setDebouncedQuery('');
    latestQueryRef.current = '';
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
    setSearchHasSearched(false);
    cancelActiveRequest();
  }, [cancelActiveRequest]);

  const retrySearch = useCallback(() => {
    if (latestQueryRef.current) {
      void executeSearch(latestQueryRef.current);
    }
  }, [executeSearch]);

  const normalizedQuery = useMemo(() => normalizeSearchQuery(searchQuery), [searchQuery]);

  return {
    searchQuery,
    setSearchQuery: setSearchQueryState,
    debouncedQuery,
    searchResults,
    isSearching: searchLoading && searchHasSearched,
    searchLoading,
    searchError,
    searchHasSearched,
    normalizedQuery,
    clearSearch,
    retrySearch,
  };
};
