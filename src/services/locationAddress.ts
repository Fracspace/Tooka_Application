import axios from 'axios';

export interface ReverseGeocodeAddress {
  locality?: string | null;
  subLocality?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface LocationDisplayParts {
  primary: string;
  secondary: string;
  isLoading: boolean;
}

export const GOOGLE_GEOCODING_API_KEY = 'AIzaSyBfg626Ov6GA68lNdJp36I9r11dxEG0K4Q';
const LOCATION_CACHE_TTL_MS = 10 * 60 * 1000;

const normalizeValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const findAddressComponent = (
  components: Array<{ long_name?: string; short_name?: string; types?: string[] }> | undefined,
  types: string[],
): string | null => {
  const match = components?.find((component) =>
    component.types?.some((type) => types.includes(type)),
  );

  return normalizeValue(match?.long_name ?? match?.short_name);
};

export const getLocationDisplayParts = (
  address: ReverseGeocodeAddress | null | undefined,
  options?: { isLoading?: boolean },
): LocationDisplayParts => {
  const normalizedAddress = {
    locality: normalizeValue(address?.locality),
    subLocality: normalizeValue(address?.subLocality),
    city: normalizeValue(address?.city),
    state: normalizeValue(address?.state),
    country: normalizeValue(address?.country),
  };

  const primary =
    normalizedAddress.locality ??
    normalizedAddress.subLocality ??
    normalizedAddress.city ??
    'Unknown Location';

  const secondary =
    normalizedAddress.city ??
    normalizedAddress.state ??
    normalizedAddress.country ??
    (primary === 'Unknown Location' ? 'Unknown Location' : primary);

  return {
    primary,
    secondary,
    isLoading: Boolean(options?.isLoading),
  };
};

export const isAddressCacheFresh = (
  timestamp: number | null | undefined,
): boolean => {
  if (!timestamp) {
    return false;
  }

  return Date.now() - timestamp < LOCATION_CACHE_TTL_MS;
};

export const resolveAddressForCoordinates = async (
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeAddress> => {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng: `${latitude},${longitude}`,
          key: GOOGLE_GEOCODING_API_KEY,
          language: 'en',
        },
        timeout: 8000,
      },
    );

    const results = Array.isArray(response?.data?.results)
      ? response.data.results
      : [];

    const [firstResult] = results;
    if (!firstResult?.address_components) {
      return {};
    }

    const locality = findAddressComponent(firstResult.address_components, [
      'locality',
      'sublocality',
      'sublocality_level_1',
    ]);
    const subLocality = findAddressComponent(firstResult.address_components, [
      'sublocality',
      'sublocality_level_1',
      'neighborhood',
    ]);
    const city =
      findAddressComponent(firstResult.address_components, ['locality']) ??
      findAddressComponent(firstResult.address_components, [
        'administrative_area_level_2',
      ]);
    const state = findAddressComponent(firstResult.address_components, [
      'administrative_area_level_1',
    ]);
    const country = findAddressComponent(firstResult.address_components, [
      'country',
    ]);

    return {
      locality: locality ?? null,
      subLocality: subLocality ?? null,
      city: city ?? null,
      state: state ?? null,
      country: country ?? null,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[locationAddress] reverse geocoding failed', error);
    }
    return {};
  }
};

export interface LocationSearchResult {
  latitude: number;
  longitude: number;
  locality: string | null;
  subLocality: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  formattedAddress: string;
}

export const searchLocationAddress = async (
  query: string,
): Promise<LocationSearchResult[]> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: normalizedQuery,
          key: GOOGLE_GEOCODING_API_KEY,
          language: 'en',
        },
        timeout: 8000,
      },
    );

    assertGoogleStatus(response?.data);
    const results = Array.isArray(response?.data?.results)
      ? response.data.results
      : [];

    return results
      .map((item: any) => {
        const lat = item.geometry?.location?.lat;
        const lng = item.geometry?.location?.lng;
        if (lat == null || lng == null) {
          return null;
        }

        const components = item.address_components;
        const locality = findAddressComponent(components, [
          'locality',
          'sublocality',
          'sublocality_level_1',
        ]);
        const subLocality = findAddressComponent(components, [
          'sublocality',
          'sublocality_level_1',
          'neighborhood',
        ]);
        const city =
          findAddressComponent(components, ['locality']) ??
          findAddressComponent(components, [
            'administrative_area_level_2',
          ]);
        const state = findAddressComponent(components, [
          'administrative_area_level_1',
        ]);
        const country = findAddressComponent(components, ['country']);

        return {
          latitude: Number(lat),
          longitude: Number(lng),
          locality: locality ?? null,
          subLocality: subLocality ?? null,
          city: city ?? null,
          state: state ?? null,
          country: country ?? null,
          formattedAddress: item.formatted_address ?? '',
        };
      })
      .filter((res: LocationSearchResult | null): res is LocationSearchResult => res !== null);
  } catch (error) {
    if (__DEV__) {
      console.warn('[locationAddress] search location failed', error);
    }
    return [];
  }
};

/**
 * Google reports quota, billing and key problems (OVER_QUERY_LIMIT,
 * REQUEST_DENIED, INVALID_REQUEST...) as HTTP 200 with an error `status`, which
 * the app used to read as "no results".
 */
export class GooglePlacesError extends Error {}

const assertGoogleStatus = (data: any): void => {
  const status = data?.status;
  if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
    throw new GooglePlacesError(`Google Places request failed: ${status}`);
  }
};

export interface LocationAutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export const searchLocationAutocomplete = async (
  query: string,
  signal?: AbortSignal,
): Promise<LocationAutocompleteResult[]> => {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return [];
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          input: normalizedQuery,
          key: GOOGLE_GEOCODING_API_KEY,
          language: 'en',
          components: 'country:in',
        },
        timeout: 8000,
        signal,
      },
    );

    assertGoogleStatus(response?.data);
    const predictions = Array.isArray(response?.data?.predictions)
      ? response.data.predictions
      : [];

    return predictions
      .map((item: any) => {
        if (!item?.place_id) {
          return null;
        }

        return {
          placeId: item.place_id,
          description: item.description ?? '',
          mainText: item.structured_formatting?.main_text ?? item.description ?? '',
          secondaryText: item.structured_formatting?.secondary_text ?? '',
        };
      })
      .filter((res: LocationAutocompleteResult | null): res is LocationAutocompleteResult => res !== null);
  } catch (error) {
    if (axios.isCancel(error)) {
      return [];
    }
    if (__DEV__) {
      console.warn('[locationAddress] autocomplete failed', error);
    }
    // Let the screen tell the user the search failed, instead of "No locations found".
    throw error;
  }
};

export const getLocationDetailsFromPlaceId = async (
  placeId: string,
): Promise<LocationSearchResult | null> => {
  if (!placeId) {
    return null;
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          key: GOOGLE_GEOCODING_API_KEY,
          language: 'en',
          fields: 'geometry,address_components,formatted_address',
        },
        timeout: 8000,
      },
    );

    assertGoogleStatus(response?.data);
    const result = response?.data?.result;
    if (!result) {
      return null;
    }

    const lat = result.geometry?.location?.lat;
    const lng = result.geometry?.location?.lng;
    if (lat == null || lng == null) {
      return null;
    }

    const components = result.address_components;
    const locality = findAddressComponent(components, [
      'locality',
      'sublocality',
      'sublocality_level_1',
    ]);
    const subLocality = findAddressComponent(components, [
      'sublocality',
      'sublocality_level_1',
      'neighborhood',
    ]);
    const city =
      findAddressComponent(components, ['locality']) ??
      findAddressComponent(components, [
        'administrative_area_level_2',
      ]);
    const state = findAddressComponent(components, [
      'administrative_area_level_1',
    ]);
    const country = findAddressComponent(components, ['country']);

    return {
      latitude: Number(lat),
      longitude: Number(lng),
      locality: locality ?? null,
      subLocality: subLocality ?? null,
      city: city ?? null,
      state: state ?? null,
      country: country ?? null,
      formattedAddress: result.formatted_address ?? '',
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[locationAddress] place details failed', error);
    }
    return null;
  }
};
