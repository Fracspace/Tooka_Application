import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { useLocation } from '../context/LocationContext';
import {
  searchLocationAddress,
  searchLocationAutocomplete,
  getLocationDetailsFromPlaceId,
  type LocationAutocompleteResult,
  type LocationSearchResult,
} from '../services/locationAddress';
import type { StoredLocation } from '../types/location';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LocationSelection'>;

export const POPULAR_CITIES = [
  { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  { name: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
];

const DEBOUNCE_MS = 350;

/**
 * Picking the area spas are shown for: GPS, a search, or a popular city. Each
 * choice is stored and the screen goes back. The old layout and the v4 layout
 * both read from here.
 */
export function useLocationSelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { location, refreshLocation, setSelectedLocation } = useLocation();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<LocationAutocompleteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectingPlaceId, setSelectingPlaceId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [resolvingCity, setResolvingCity] = useState<string | null>(null);

  const latestReqIdRef = useRef(0);

  const debouncedQueryRef = useRef('');
  const [searchFailed, setSearchFailed] = useState(false);

  // Debounce search query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      setAutocompleteResults([]);
      setSearching(false);
      return;
    }

    // Same text as the last search (e.g. a trailing space, or type-then-delete):
    // setDebouncedQuery would be a no-op, the search effect would not re-run, and
    // the spinner set here never cleared.
    if (trimmed === debouncedQueryRef.current) {
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // Execute autocomplete search when debouncedQuery changes
  useEffect(() => {
    debouncedQueryRef.current = debouncedQuery;
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setAutocompleteResults([]);
      setSearching(false);
      return;
    }

    const reqId = ++latestReqIdRef.current;
    setSearching(true);
    setSearchFailed(false);

    searchLocationAutocomplete(trimmed)
      .then((predictions) => {
        if (latestReqIdRef.current === reqId) {
          setAutocompleteResults(predictions);
        }
      })
      .catch(() => {
        if (latestReqIdRef.current === reqId) {
          setAutocompleteResults([]);
          setSearchFailed(true);
        }
      })
      .finally(() => {
        if (latestReqIdRef.current === reqId) {
          setSearching(false);
        }
      });
  }, [debouncedQuery]);

  const handleUseCurrentLocation = useCallback(async () => {
    setGpsLoading(true);
    setGpsError(null);

    try {
      const result = await refreshLocation(true);

      if (
        result?.permission === 'granted' &&
        result.latitude !== null &&
        result.longitude !== null
      ) {
        navigation.goBack();
        return;
      }

      if (
        result?.permission === 'denied' ||
        result?.permission === 'blocked' ||
        result?.permission === 'restricted' ||
        result?.permission === 'disabled'
      ) {
        setGpsError('Location permission is disabled. Please enable it in Settings.');
      } else {
        setGpsError('Unable to fetch current GPS location.');
      }
    } catch {
      setGpsError('An error occurred while getting location.');
    } finally {
      setGpsLoading(false);
    }
  }, [navigation, refreshLocation]);

  const handleOpenSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  // Tapping a suggestion whose lookups both failed used to do nothing at all.
  const showSelectFailed = useCallback(() => {
    Toast.show({
      type: 'error',
      text1: "Couldn't get that location",
      text2: 'Please try again or pick another result.',
    });
  }, []);

  const handleSelectAutocompleteItem = useCallback(
    async (item: LocationAutocompleteResult) => {
      setSelectingPlaceId(item.placeId);

      try {
        let locationData = await getLocationDetailsFromPlaceId(item.placeId);

        // Fallback to geocoding if place details returned null
        if (!locationData && item.description) {
          const fallbackResults = await searchLocationAddress(item.description);
          if (fallbackResults.length > 0) {
            locationData = fallbackResults[0];
          }
        }

        if (locationData) {
          const newLocation: StoredLocation = {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: null,
            timestamp: Date.now(),
            permission: 'granted',
            error: null,
            locality: locationData.locality,
            subLocality: locationData.subLocality,
            city: locationData.city ?? locationData.locality ?? item.mainText ?? 'Selected Location',
            state: locationData.state,
            country: locationData.country,
            isManualSelection: true,
          };

          await setSelectedLocation(newLocation);
          navigation.goBack();
          return;
        }
        showSelectFailed();
      } catch (err) {
        if (__DEV__) {
          console.warn('[LocationSelectionScreen] resolve prediction error:', err);
        }
        showSelectFailed();
      } finally {
        setSelectingPlaceId(null);
      }
    },
    [navigation, setSelectedLocation, showSelectFailed],
  );

  const handleSelectSearchResult = useCallback(
    async (item: LocationSearchResult) => {
      const newLocation: StoredLocation = {
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: null,
        timestamp: Date.now(),
        permission: 'granted',
        error: null,
        locality: item.locality,
        subLocality: item.subLocality,
        city: item.city ?? item.locality ?? 'Selected Location',
        state: item.state,
        country: item.country,
        isManualSelection: true,
      };

      await setSelectedLocation(newLocation);
      navigation.goBack();
    },
    [navigation, setSelectedLocation],
  );

  const handleSelectPopularCity = useCallback(
    async (cityObj: typeof POPULAR_CITIES[0]) => {
      setResolvingCity(cityObj.name);

      try {
        const searchResults = await searchLocationAddress(`${cityObj.name}, ${cityObj.state}, India`);
        if (searchResults.length > 0) {
          await handleSelectSearchResult(searchResults[0]);
          return;
        }
      } catch {
        // Fallback to pre-configured coordinates if search fails
      }

      const fallbackLocation: StoredLocation = {
        latitude: cityObj.lat,
        longitude: cityObj.lng,
        accuracy: null,
        timestamp: Date.now(),
        permission: 'granted',
        error: null,
        locality: cityObj.name,
        subLocality: null,
        city: cityObj.name,
        state: cityObj.state,
        country: 'India',
        isManualSelection: true,
      };

      await setSelectedLocation(fallbackLocation);
      setResolvingCity(null);
      navigation.goBack();
    },
    [handleSelectSearchResult, navigation, setSelectedLocation],
  );

  const currentSelectionLabel = useMemo(() => {
    if (!location) {
      return null;
    }
    const main = location.locality ?? location.subLocality ?? location.city ?? 'Current Location';
    const sub = location.city ?? location.state ?? location.country;
    return sub && sub !== main ? `${main}, ${sub}` : main;
  }, [location]);

  return {
    location,
    query,
    setQuery,
    autocompleteResults,
    searching,
    searchFailed,
    selectingPlaceId,
    gpsLoading,
    gpsError,
    resolvingCity,
    currentSelectionLabel,
    handleUseCurrentLocation,
    handleOpenSettings,
    handleSelectAutocompleteItem,
    handleSelectPopularCity,
    goBack: () => navigation.goBack(),
  };
}
