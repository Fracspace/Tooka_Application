import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SpaApi from '../api/SpaApi';
import type { SpaDetails } from '../types/spaDetails';

export function useSpaDetails(spaId: string) {
  const [spa, setSpa] = useState<SpaDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // The in-flight request. A new fetch (or unmount) aborts the previous one, so a
  // slow response for an earlier spaId can no longer overwrite the current spa.
  const controllerRef = useRef<AbortController | null>(null);

  const fetchSpaDetails = useCallback(
    async ({ refresh }: { refresh?: boolean } = {}) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await SpaApi.getSpaDetails(spaId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setSpa(response ?? null);

        if (__DEV__) {
          console.log(`[useSpaDetails] fetched spa details for ${spaId}`, response);
        }
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        if (__DEV__) {
          console.log('[useSpaDetails] error fetching spa details', fetchError);
        }

        setError('Unable to load spa details.');
        setSpa(null);
      } finally {
        // Only the latest request settles the UI; it clears both flags because it
        // may have replaced a load of the other kind.
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [spaId],
  );

  useEffect(() => {
    fetchSpaDetails();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchSpaDetails]);

  const refetch = useCallback(() => fetchSpaDetails(), [fetchSpaDetails]);
  const onRefresh = useCallback(() => fetchSpaDetails({ refresh: true }), [fetchSpaDetails]);

  return useMemo(
    () => ({
      spa,
      loading,
      refreshing,
      error,
      refetch,
      onRefresh,
    }),
    [spa, loading, refreshing, error, refetch, onRefresh],
  );
}
