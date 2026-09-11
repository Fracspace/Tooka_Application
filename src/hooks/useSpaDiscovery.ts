import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SpaApi from '../api/SpaApi';
import type { Spa } from '../types/spa';

const DEFAULT_CITY = 'Hyderabad';

export function useSpaDiscovery(city: string = DEFAULT_CITY) {
  const [spas, setSpas] = useState<Spa[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSpas = useCallback(
    async ({ refresh }: { refresh?: boolean } = {}) => {
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
        if (abortControllerRef.current === controller) {
          if (refresh) {
            setRefreshing(false);
          } else {
            setLoading(false);
          }
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
