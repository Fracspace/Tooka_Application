import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  getSavedLocation as readSavedLocation,
  hasLocationPermission as checkLocationPermission,
  refreshLocation as refreshDeviceLocation,
  saveSelectedLocation,
} from '../services/locationService';
import type {
  LocationContextValue,
  StoredLocation,
} from '../types/location';

const LocationContext =
  createContext<LocationContextValue | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const getSavedLocation = useCallback(async () => {
    const saved = await readSavedLocation();
    setLocation(saved);
    return saved;
  }, []);

  const refreshLocation = useCallback(
    async (forceRequestPermission = false) => {
      const nextLocation = await refreshDeviceLocation(forceRequestPermission);
      setLocation(nextLocation);
      return nextLocation;
    },
    [],
  );

  const setSelectedLocation = useCallback(
    async (nextLoc: StoredLocation) => {
      const saved = await saveSelectedLocation({
        ...nextLoc,
        isManualSelection: true,
      });
      setLocation(saved);
    },
    [],
  );

  const hasLocationPermission = useCallback(
    () => checkLocationPermission(),
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const initializeLocation = async () => {
      try {
        const saved = await readSavedLocation();
        if (saved?.isManualSelection) {
          if (isMounted) {
            setLocation(saved);
          }
          return;
        }

        const nextLocation = await refreshDeviceLocation(false);
        if (
          __DEV__ &&
          nextLocation?.permission === 'granted' &&
          nextLocation.latitude !== null &&
          nextLocation.longitude !== null
        ) {
          console.log('[LocationContext] startup location:', nextLocation);
        }

        if (isMounted) {
          setLocation(nextLocation);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[LocationContext] initializeLocation error:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeLocation();

    // Only a real return from the background refreshes. 'inactive' -> 'active' also
    // fires after a permission dialog or the notification shade, which started extra
    // GPS + Geocoding lookups racing each other.
    let previousAppState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const cameFromBackground = previousAppState === 'background';
      previousAppState = nextAppState;
      if (nextAppState === 'active' && cameFromBackground) {
        try {
          const saved = await readSavedLocation();
          if (saved?.isManualSelection) {
            if (isMounted) {
              setLocation(saved);
            }
            return;
          }

          const refreshed = await refreshDeviceLocation(false);
          if (isMounted) {
            setLocation(refreshed);
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('[LocationContext] app resume refresh error:', error);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      loading,
      refreshLocation,
      setSelectedLocation,
      getSavedLocation,
      hasLocationPermission,
    }),
    [
      location,
      loading,
      refreshLocation,
      setSelectedLocation,
      getSavedLocation,
      hasLocationPermission,
    ],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextValue => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }

  return context;
};
