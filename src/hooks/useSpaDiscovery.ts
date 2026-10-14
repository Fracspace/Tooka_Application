import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SpaApi from '../api/SpaApi';
import type { Spa } from '../types/spa';

/**
 * Curated spas for a city. `null` means the city is not known yet (location still
 * loading, or none set): nothing is fetched. It used to default to 'Hyderabad',
 * so users anywhere else saw Hyderabad spas labelled "Curated for you".
 */
export function useSpaDiscovery(city: string | null) {
  const [spas, setSpas] = useState<Spa[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSpas = useCallback(
    async ({ refresh }: { refresh?: boolean } = {}) => {
      if (!city) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setSpas([]);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await SpaApi.getSpasByCity(city, controller.signal);
        const spaList = response.featuredSpas ?? [];
        setSpas(spaList);

        if (__DEV__) {
          console.log(`[useSpaDiscovery] fetched ${spaList.length} spas from ${city}`);
        }
      } catch (fetchError: any) {
        if (fetchError?.name === 'AbortError' || fetchError?.message === 'canceled') {
          return;
        }

        if (__DEV__) {
          console.log('[useSpaDiscovery] error fetching spas', fetchError);
        }

        setError('Something went wrong. Please try again.');
        setSpas([]);
      } finally {
        // Only the latest request settles the UI; it clears both flags because it
        // may have replaced a request of the other kind (the refresh spinner stuck).
        if (abortControllerRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
          abortControllerRef.current = null;
        }
      }
    },
    [city],
  );

  useEffect(() => {
    fetchSpas();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchSpas]);

  const refetch = useCallback(() => fetchSpas(), [fetchSpas]);

  const onRefresh = useCallback(() => fetchSpas({ refresh: true }), [fetchSpas]);

  return useMemo(
    () => ({
      spas,
      loading,
      error,
      refreshing,
      refetch,
      onRefresh,
    }),
    [spas, loading, error, refreshing, refetch, onRefresh],
  );
}
