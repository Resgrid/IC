import { type AxiosResponse } from 'axios';

import { cacheManager } from '@/lib/cache/cache-manager';

import { createApiEndpoint } from './client';

interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  enabled?: boolean; // Whether to use cache for this endpoint
}

const buildCachedResponse = <T>(data: T, stale = false): AxiosResponse<T> =>
  ({
    data,
    status: 200,
    statusText: stale ? 'OK (stale cache)' : 'OK (cached)',
    headers: {},
    config: {},
  }) as AxiosResponse<T>;

export const createCachedApiEndpoint = (endpoint: string, cacheConfig: CacheConfig = { enabled: true }) => {
  const api = createApiEndpoint(endpoint);
  const defaultTTL = 5 * 60 * 1000; // 5 minutes

  return {
    get: async <T>(params?: Record<string, unknown>): Promise<AxiosResponse<T>> => {
      if (!cacheConfig.enabled) {
        return api.get<T>(params);
      }

      const cached = cacheManager.get<T>(endpoint, params);
      if (cached) {
        return buildCachedResponse(cached);
      }

      try {
        const response = await api.get<T>(params);
        cacheManager.set(endpoint, response.data, params, cacheConfig.ttl || defaultTTL);
        return response;
      } catch (error) {
        // Offline / request failed: fall back to the last cached value even if
        // its TTL has expired, so read paths keep working without a connection.
        const stale = cacheManager.getStale<T>(endpoint, params);
        if (stale !== null) {
          return buildCachedResponse(stale, true);
        }
        throw error;
      }
    },
    post: api.post,
    put: api.put,
    delete: api.delete,
  };
};
