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

/** Spas per search page. */
export const SEARCH_PAGE_SIZE = 20;

export type SearchSpasOptions = { lat?: number | null; lng?: number | null; page?: number; limit?: number };
type SearchSpasMeta = { page: number; limit: number; total: number; hasMore: boolean };
export type SearchSpasPage = { spas: Spa[]; page: number; total: number; hasMore: boolean };

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
  /**
   * Text search (also used by the Home type tiles). With the user's location the
   * backend returns the spas nearest first; without it the same spas come back in
   * relevance order. One page at a time: read `total` / `hasMore` and ask for the
   * next page.
   */
  searchSpas: async (
    query: string,
    { lat, lng, page = 1, limit = SEARCH_PAGE_SIZE }: SearchSpasOptions = {},
    cancelToken?: any,
  ): Promise<SearchSpasPage> => {
    const response = await authAxiosClient.get<ApiResponse<Spa[]> & { meta?: Partial<SearchSpasMeta> }>(
      '/spas/search',
      {
        params: {
          q: query,
          ...(lat != null && lng != null ? { lat, lng } : {}),
          page,
          limit,
        },
        cancelToken,
      },
    );

    const raw = Array.isArray(response.data?.data) ? response.data.data : [];
    const meta = response.data?.meta ?? {};
    const total = typeof meta.total === 'number' ? meta.total : raw.length;
    const pageNo = typeof meta.page === 'number' ? meta.page : page;
    const pageLimit = typeof meta.limit === 'number' ? meta.limit : limit;
    return {
      spas: filterVisibleSpas(raw),
      page: pageNo,
      total,
      // Count what the server sent (hidden spas included) so paging never stalls.
      hasMore: typeof meta.hasMore === 'boolean' ? meta.hasMore : pageNo * pageLimit < total,
    };
  },
};

export default SpaApi;