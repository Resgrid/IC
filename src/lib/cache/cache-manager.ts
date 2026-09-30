import { storage } from '@/lib/storage';
import { getBaseApiUrl } from '@/lib/storage/app';

import { CACHE_SCOPE_KEY, getCacheScopeKey } from './cache-scope';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * The namespace entries are written under: server base URL plus signed-in identity. Scoping by server
   * keeps one environment's data from being served against another after a server-URL switch, and by
   * identity keeps a second user (or a department switch) on the same device from being served the
   * previous account's cached units, calls or contacts.
   */
  getScopeIdentity(): string {
    return `${getBaseApiUrl()}_${getCacheScopeKey()}`;
  }

  private getCacheKey(endpoint: string, params?: Record<string, unknown>): string {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return `api_cache_${this.getScopeIdentity()}_${endpoint}${queryString}`;
  }

  private isExpired(timestamp: number, expiresIn: number): boolean {
    return Date.now() - timestamp > expiresIn;
  }

  set<T>(endpoint: string, data: T, params?: Record<string, unknown>, ttl: number = this.defaultTTL): void {
    const key = this.getCacheKey(endpoint, params);
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresIn: ttl,
    };
    storage.set(key, JSON.stringify(cacheItem));
  }

  get<T>(endpoint: string, params?: Record<string, unknown>): T | null {
    const key = this.getCacheKey(endpoint, params);
    const cached = storage.getString(key);

    if (!cached) {
      return null;
    }

    let cacheItem: CacheItem<T>;
    try {
      cacheItem = JSON.parse(cached);
    } catch {
      storage.delete(key);
      return null;
    }

    if (this.isExpired(cacheItem.timestamp, cacheItem.expiresIn)) {
      // Keep the entry on disk — getStale() serves it as an offline fallback.
      return null;
    }

    return cacheItem.data;
  }

  /**
   * Returns the cached value even when its TTL has expired.
   * Used as a fallback when the device is offline or a request fails.
   */
  getStale<T>(endpoint: string, params?: Record<string, unknown>): T | null {
    const key = this.getCacheKey(endpoint, params);
    const cached = storage.getString(key);

    if (!cached) {
      return null;
    }

    try {
      const cacheItem: CacheItem<T> = JSON.parse(cached);
      return cacheItem.data;
    } catch {
      storage.delete(key);
      return null;
    }
  }

  remove(endpoint: string, params?: Record<string, unknown>): void {
    const key = this.getCacheKey(endpoint, params);
    storage.delete(key);
  }

  clear(): void {
    const allKeys = storage.getAllKeys();
    allKeys.forEach((key) => {
      // The scope record is not a cached response; dropping it would forget whose session this is.
      if (key.startsWith('api_cache_') && key !== CACHE_SCOPE_KEY) {
        storage.delete(key);
      }
    });
  }
}

export const cacheManager = CacheManager.getInstance();
