import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';

import BookingApi from '../api/BookingApi';
import type { BackendBookingListItem } from '../types/booking';
import { getBookingErrorMessage } from '../utils/getBookingErrorMessage';
import { getBookingSection } from '../utils/getBookingSection';

type FetchOptions = {
  refresh?: boolean;
  silent?: boolean;
};

export function useMyBookings() {
  const [allBookings, setAllBookings] = useState<BackendBookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const fetchBookings = useCallback(async (options: FetchOptions = {}) => {
    const { refresh = false, silent = false } = options;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (refresh) {
      setRefreshing(true);
    } else if (!silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const result = await BookingApi.getMyBookings({
        signal: controller.signal,
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      setAllBookings(result.items);
    } catch (fetchError) {
      if (controller.signal.aborted || axios.isCancel(fetchError)) {
        return;
      }

      if (requestIdRef.current === requestId) {
        const message = getBookingErrorMessage(fetchError);
        if (message) {
          setError(message);
        }
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
        setHasFetchedOnce(true);
        requestControllerRef.current = null;
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const silent = hasLoadedOnceRef.current;
      void fetchBookings({ silent });
      hasLoadedOnceRef.current = true;

      return () => {
        requestControllerRef.current?.abort();
      };
    }, [fetchBookings]),
  );

  const refetch = useCallback(() => fetchBookings(), [fetchBookings]);

  const onRefresh = useCallback(
    () => fetchBookings({ refresh: true, silent: true }),
    [fetchBookings],
  );

  const upcomingBookings = useMemo(
    () =>
      allBookings.filter(
        booking => getBookingSection(booking.status) === 'upcoming',
      ),
    [allBookings],
  );

  const completedBookings = useMemo(
    () =>
      allBookings.filter(
        booking => getBookingSection(booking.status) === 'completed',
      ),
    [allBookings],
  );

  const cancelledBookings = useMemo(
    () =>
      allBookings.filter(
        booking => getBookingSection(booking.status) === 'cancelled',
      ),
    [allBookings],
  );

  return useMemo(
    () => ({
      allBookings,
      upcomingBookings,
      completedBookings,
      cancelledBookings,
      loading,
      refreshing,
      error,
      hasFetchedOnce,
      refetch,
      onRefresh,
    }),
    [
      allBookings,
      upcomingBookings,
      completedBookings,
      cancelledBookings,
      loading,
      refreshing,
      error,
      hasFetchedOnce,
      refetch,
      onRefresh,
    ],
  );
}
