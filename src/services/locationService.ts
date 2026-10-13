import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation, {
  type GeolocationError,
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import type {
  LocationPermissionStatus,
  StoredLocation,
} from '../types/location';
import {
  isAddressCacheFresh,
  resolveAddressForCoordinates,
} from './locationAddress';

const LOCATION_STORAGE_KEY = 'TOOKA_LOCATION_V1';
const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  locationProvider: Platform.OS === 'android' ? 'android' : 'auto',
});

const EMPTY_LOCATION: StoredLocation = {
  latitude: null,
  longitude: null,
  accuracy: null,
  timestamp: null,
  permission: 'unknown',
  error: null,
  locality: null,
  subLocality: null,
  city: null,
  state: null,
  country: null,
};

const STARTUP_FINAL_STATUSES: LocationPermissionStatus[] = [
  'denied',
  'blocked',
  'restricted',
  'disabled',
];

const LOCATION_PERMISSION_STATUSES: LocationPermissionStatus[] = [
  'unknown',
  'granted',
  'denied',
  'blocked',
  'restricted',
  'disabled',
  'unavailable',
];

const isValidStoredLocation = (value: unknown): value is StoredLocation => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Partial<StoredLocation>;
  return LOCATION_PERMISSION_STATUSES.includes(
    data.permission as LocationPermissionStatus,
  );
};

const persistLocation = async (
  location: StoredLocation,
): Promise<StoredLocation> => {
  try {
    await AsyncStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify(location),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('[locationService] persistLocation error:', error);
    }
  }

  return location;
};

const persistPermissionStatus = async (
  permission: LocationPermissionStatus,
  error: string | null = null,
): Promise<StoredLocation> => {
  return persistLocation({
    ...EMPTY_LOCATION,
    permission,
    error,
    timestamp: Date.now(),
  });
};

// const requestAndroidPermission =
//   async (): Promise<LocationPermissionStatus> => {
//     try {
//       const androidVersion = Number(Platform.Version);
//       if (androidVersion < 23) {
//         return 'granted';
//       }

//       const alreadyGranted = await PermissionsAndroid.check(
//         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//       );

//       if (alreadyGranted) {
//         return 'granted';
//       }

//       const result = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//       );

//       if (result === PermissionsAndroid.RESULTS.GRANTED) {
//         return 'granted';
//       }

//       if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
//         return 'blocked';
//       }

//       return 'denied';
//     } catch (error) {
//       if (__DEV__) {
//         console.warn('[locationService] requestAndroidPermission error:', error);
//       }
//       return 'unavailable';
//     }
//   };

const requestAndroidPermission = async (): Promise<LocationPermissionStatus> => {
  try {
    console.log('Android Version:', Platform.Version);

    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    console.log('alreadyGranted:', alreadyGranted);

    if (alreadyGranted) {
      return 'granted';
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    console.log('Permission Result:', result);

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }

    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return 'blocked';
    }

    return 'denied';
  } catch (e) {
    console.log('Permission Exception:', e);
    return 'unavailable';
  }
};

const requestLocationPermission =
  async (): Promise<LocationPermissionStatus> => {
    if (Platform.OS === 'android') {
      return requestAndroidPermission();
    }

    if (Platform.OS === 'ios') {
      return requestIOSPermission();
    }

    return 'unavailable';
  };

const requestIOSPermission = async (): Promise<LocationPermissionStatus> =>
  new Promise((resolve) => {
    let isSettled = false;

    // Safety timeout: On iOS, if permission is already granted,
    // requestAuthorization native callback may never fire.
    const timerId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve('granted');
      }
    }, 1500);

    try {
      Geolocation.requestAuthorization(
        () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timerId);
            resolve('granted');
          }
        },
        (error) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timerId);
            if (__DEV__) {
              console.warn('[locationService] requestAuthorization error:', error);
            }

            resolve(mapLocationError(error));
          }
        },
      );
    } catch (e) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timerId);
        resolve('granted');
      }
    }
  });

// const getPosition = (): Promise<GeolocationResponse> =>
//   new Promise((resolve, reject) => {
//     Geolocation.getCurrentPosition(
//       resolve,
//       reject,
//       {
//         // enableHighAccuracy: true,
//         enableHighAccuracy: false,
//         timeout: 10000,
//         maximumAge: 30000,
//         // timeout: 15000,
//         // maximumAge: 10000,
const LOCATION_OPTIONS_FAST = {
  enableHighAccuracy: true,
  timeout: 6000,
  maximumAge: 10000,
};

const LOCATION_OPTIONS_BALANCED = {
  enableHighAccuracy: false,
  timeout: 6000,
  maximumAge: 10000,
};

const getPositionWithOptions = (options: typeof LOCATION_OPTIONS_FAST, label: string): Promise<GeolocationResponse> =>
  new Promise((resolve, reject) => {
    let isSettled = false;

    const timerId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error(`Geolocation ${label} JS timeout`));
      }
    }, options.timeout + 1000);

    Geolocation.getCurrentPosition(
      (pos) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timerId);
          resolve(pos);
        }
      },
      (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timerId);
          reject(err);
        }
      },
      options,
    );
  });

const getPosition = (): Promise<GeolocationResponse> =>
  getPositionWithOptions(LOCATION_OPTIONS_FAST, 'highAccuracy').catch((firstErr) => {
    if (__DEV__) {
      console.log('[LOCATION] getPosition highAccuracy failed, trying balanced fallback...', firstErr?.message);
    }
    return getPositionWithOptions(LOCATION_OPTIONS_BALANCED, 'balanced');
  });

const watchPositionUntilFound = (): Promise<GeolocationResponse> =>
  new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let isSettled = false;

    const cleanup = () => {
      if (watchId !== null) {
        try {
          Geolocation.clearWatch(watchId);
        } catch {}
        watchId = null;
      }
    };

    const timeoutId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error('watchPosition timeout'));
      }
    }, 6000);

    try {
      watchId = Geolocation.watchPosition(
        (position) => {
          if (
            !isSettled &&
            position?.coords?.latitude != null &&
            position?.coords?.longitude != null
          ) {
            isSettled = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve(position);
          }
        },
        (error) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            cleanup();
            reject(error);
          }
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 0,
          interval: 1000,
          fastestInterval: 500,
        },
      );
    } catch (err) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeoutId);
        cleanup();
        reject(err);
      }
    }
  });

const mapLocationError = (error: GeolocationError): LocationPermissionStatus => {
  switch (error.code) {
    case GEOLOCATION_PERMISSION_DENIED:
      return 'denied';
    case GEOLOCATION_POSITION_UNAVAILABLE:
      return 'unavailable';
    case GEOLOCATION_TIMEOUT:
    default:
      return 'unavailable';
  }
};

export async function getSavedLocation(): Promise<StoredLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isValidStoredLocation(parsed)) {
      return null;
    }

    return {
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      accuracy: parsed.accuracy ?? null,
      timestamp: parsed.timestamp ?? null,
      permission: parsed.permission,
      error: parsed.error ?? null,
      locality: parsed.locality ?? null,
      subLocality: parsed.subLocality ?? null,
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      country: parsed.country ?? null,
      isManualSelection: Boolean(parsed.isManualSelection),
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[locationService] getSavedLocation error:', error);
    }
    return null;
  }
}

export async function saveSelectedLocation(
  location: StoredLocation,
): Promise<StoredLocation> {
  const nextLocation: StoredLocation = {
    ...location,
    isManualSelection: location.isManualSelection ?? true,
    timestamp: location.timestamp || Date.now(),
  };
  return persistLocation(nextLocation);
}

export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      return PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
    } catch (error) {
      if (__DEV__) {
        console.warn('[locationService] hasLocationPermission error:', error);
      }
      return false;
    }
  }

  const saved = await getSavedLocation();
  return saved?.permission === 'granted';
}

let locationReqCount = 0;

export async function getCurrentLocation(): Promise<StoredLocation | null> {
  const reqId = ++locationReqCount;
  const startTime = Date.now();
  if (__DEV__) {
    console.log(`[LOCATION][req #${reqId}][t=0ms] getCurrentLocation START`);
  }

  try {
    if (__DEV__) {
      console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] requestLocationPermission START`);
    }
    const permission = await requestLocationPermission();
    if (__DEV__) {
      console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] requestLocationPermission RESULT:`, permission);
    }

    if (permission !== 'granted') {
      return await persistPermissionStatus(permission);
    }

    let position: GeolocationResponse | null = null;

    try {
      if (__DEV__) {
        console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] getPosition START`);
      }
      position = await getPosition();
      if (__DEV__) {
        console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] getPosition SUCCESS:`, position?.coords?.latitude, position?.coords?.longitude);
      }
    } catch (error) {
      if (__DEV__) {
        console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] getPosition FAILED:`, error);
        console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] watchPositionUntilFound START`);
      }

      try {
        position = await watchPositionUntilFound();
        if (__DEV__) {
          console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] watchPositionUntilFound SUCCESS:`, position?.coords?.latitude, position?.coords?.longitude);
        }
      } catch (watchError: any) {
        const geoError = watchError as GeolocationError;
        const permissionStatus = mapLocationError(geoError);

        if (__DEV__) {
          console.warn(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] GPS acquisition failed completely:`, watchError);
        }

        return await persistPermissionStatus(
          permissionStatus,
          watchError?.message ?? 'Unable to get current location.',
        );
      }
    }

    const nextLocation: StoredLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp || Date.now(),
      permission: 'granted',
      error: null,
      locality: null,
      subLocality: null,
      city: null,
      state: null,
      country: null,
      isManualSelection: false,
    };

    const cached = await getSavedLocation();
    const shouldResolveAddress =
      cached?.latitude === nextLocation.latitude &&
      cached?.longitude === nextLocation.longitude &&
      isAddressCacheFresh(cached?.timestamp);

    if (shouldResolveAddress && cached?.city) {
      if (__DEV__) {
        console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] Using fresh cached address:`, cached.city);
      }
      return await persistLocation({
        ...nextLocation,
        locality: cached.locality ?? null,
        subLocality: cached.subLocality ?? null,
        city: cached.city ?? null,
        state: cached.state ?? null,
        country: cached.country ?? null,
        isManualSelection: false,
      });
    }

    try {
      if (nextLocation.latitude === null || nextLocation.longitude === null) {
        throw new Error('Invalid coordinates');
      }

      if (__DEV__) {
        console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] resolveAddressForCoordinates START (${nextLocation.latitude}, ${nextLocation.longitude})`);
      }

      const resolvedAddress = await resolveAddressForCoordinates(
        nextLocation.latitude,
        nextLocation.longitude,
      );

      if (__DEV__) {
        console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] resolveAddressForCoordinates SUCCESS:`, resolvedAddress);
      }

      return await persistLocation({
        ...nextLocation,
        locality: resolvedAddress.locality ?? null,
        subLocality: resolvedAddress.subLocality ?? null,
        city: resolvedAddress.city ?? null,
        state: resolvedAddress.state ?? null,
        country: resolvedAddress.country ?? null,
        isManualSelection: false,
      });
    } catch (error) {
      if (__DEV__) {
        console.warn(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] failed to resolve address:`, error);
      }

      return await persistLocation({
        ...nextLocation,
        locality: cached?.locality ?? null,
        subLocality: cached?.subLocality ?? null,
        city: cached?.city ?? null,
        state: cached?.state ?? null,
        country: cached?.country ?? null,
        isManualSelection: false,
      });
    }
  } finally {
    if (__DEV__) {
      console.log(`[LOCATION][req #${reqId}][t=${Date.now() - startTime}ms] getCurrentLocation COMPLETED`);
    }
  }
}

export async function refreshLocation(
  forceRequestPermission = false,
): Promise<StoredLocation | null> {
  const saved = await getSavedLocation();

  if (__DEV__) {
    console.log(`[LOCATION] refreshLocation called (force=${forceRequestPermission}, savedManual=${saved?.isManualSelection}, savedCity=${saved?.city})`);
  }

  if (!forceRequestPermission && saved?.isManualSelection) {
    if (__DEV__) {
      console.log('[LOCATION] refreshLocation: Manual selection active, returning saved without GPS fetch.');
    }
    return saved;
  }

  if (
    !forceRequestPermission &&
    saved?.permission &&
    STARTUP_FINAL_STATUSES.includes(saved.permission)
  ) {
    // A saved denial used to be final: granting location in Settings and coming
    // back to the app changed nothing until a reinstall. Re-check without
    // prompting - this runs on every return to the foreground.
    if (saved.permission !== 'granted' && (await isPermissionGrantedNow())) {
      if (__DEV__) {
        console.log('[LOCATION] refreshLocation: permission granted since last check, fetching.');
      }
      return getCurrentLocation();
    }
    if (__DEV__) {
      console.log('[LOCATION] refreshLocation: Startup final status reached, returning saved.');
    }
    return saved;
  }

  return getCurrentLocation();
}

/**
 * Whether location access is granted right now, WITHOUT showing a prompt.
 * Android has a silent check. iOS has none in this library, but after a denial a
 * position request fails immediately instead of prompting, and succeeds once the
 * user has allowed access in Settings.
 */
async function isPermissionGrantedNow(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
    }
    await getPosition();
    return true;
  } catch {
    return false;
  }
}

export const locationService = {
  getCurrentLocation,
  getSavedLocation,
  refreshLocation,
  hasLocationPermission,
  saveSelectedLocation,
};
