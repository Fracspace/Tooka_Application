import type { Spa } from '../types/spa';
import type { SpaDetails } from '../types/spaDetails';
import authAxiosClient from './authAxiosClient';

export interface DiscoverSpaParams {
  city: string;
}

export interface NearbySpaParams {
  lat: number;
  lng: number;
}

export interface DiscoverResponse {
  featuredSpas: Spa[];
}

interface DiscoverRawResponse {
  success?: boolean;
  data?: Spa[];
  curated?: Spa[];
}

interface ApiResponse<T> {
  data: T;
}

const filterVisibleSpas = (spas?: Spa[] | null): Spa[] => {
  if (!Array.isArray(spas)) {
    return [];
  }
  return spas.filter((spa) => spa && spa.is_hidden !== true);
};

export const SpaApi = {
  /**
   * Get spas by city
   */
  getSpasByCity: async (city: string, signal?: AbortSignal): Promise<DiscoverResponse> => {
    const response = await authAxiosClient.get<DiscoverRawResponse>(
      '/spas/discover',
      {
        params: {
          city,
        },
        signal,
      },
    );

    const curated = filterVisibleSpas(response.data?.curated);
    const data = filterVisibleSpas(response.data?.data);
    const featuredSpas = curated.length > 0 ? curated : data;

    return { featuredSpas };
  },

  /**
   * Get spa details
   */
  getSpaDetails: async (spaId: string, signal?: AbortSignal): Promise<SpaDetails> => {
    const response = await authAxiosClient.get<ApiResponse<SpaDetails>>(
      `/spas/${spaId}`,
      {
        signal,
      },
    );

    // An empty body used to come back as `{}`: a blank page with no error, booking
    // not blocked (is_bookable undefined), and Explore caching it for the session.
    const spa = response.data?.data;
    if (!spa?.id) {
      throw new Error('Spa details are unavailable.');
    }
    return spa;
  },

  /**
   * Get nearby spas
   */
  getNearbySpas: async (
    lat: number,
    lng: number,
    page?: number,
    limit?: number,
    cancelToken?: any,
  ) => {
    const response = await authAxiosClient.get(
      '/spas/discover',
      {
        params: {
          lat,
          lng,
          page,
          limit,
        },
        cancelToken,
      },
    );

    const resBody = response.data;
    if (!resBody) {
      return resBody;
    }

    if (Array.isArray(resBody)) {
      return filterVisibleSpas(resBody);
    }

    if (typeof resBody === 'object') {
      const updatedObj = { ...resBody };
      if (Array.isArray(updatedObj.data)) {
        updatedObj.data = filterVisibleSpas(updatedObj.data);
      }
      if (Array.isArray(updatedObj.curated)) {
        updatedObj.curated = filterVisibleSpas(updatedObj.curated);
      }
      return updatedObj;
    }

    return resBody;
  },

  /**
   * Search spas by query and city
   */
  searchSpas: async (query: string, cancelToken?: any): Promise<Spa[]> => {
    const response = await authAxiosClient.get<ApiResponse<Spa[]>>(
      '/spas/search',
      {
        params: {
          q: query,
          // city_id: query,
        },
        cancelToken,
      },
    );

    return filterVisibleSpas(response.data?.data);
  },
};

export default SpaApi;