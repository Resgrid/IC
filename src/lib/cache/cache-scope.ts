import { storage } from '@/lib/storage';

/**
 * Identity the API cache is scoped to.
 *
 * Cache keys used to be built from the endpoint alone. On a shared command laptop that meant signing
 * out and signing back in as someone else served the previous account's units, calls and contacts
 * straight out of MMKV. Making the signed-in identity part of the key closes that.
 *
 * This lives in its own leaf module (storage is its only import) so the cache manager and the auth
 * store can both use it without the auth -> api client -> auth import cycle.
 */
export interface CacheScope {
  userId: string | null;
  departmentId: string | null;
}

/** Shares the api_cache_ prefix, so the cache manager's clear() must skip it. */
export const CACHE_SCOPE_KEY = 'api_cache_scope';

let cachedScope: CacheScope | null = null;

const readScope = (): CacheScope => {
  if (cachedScope) {
    return cachedScope;
  }

  try {
    const raw = storage.getString(CACHE_SCOPE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CacheScope>;
      cachedScope = {
        userId: typeof parsed.userId === 'string' ? parsed.userId : null,
        departmentId: typeof parsed.departmentId === 'string' ? parsed.departmentId : null,
      };
      return cachedScope;
    }
  } catch {
    // A corrupt scope must not break every cached request; fall through to anonymous.
  }

  cachedScope = { userId: null, departmentId: null };
  return cachedScope;
};

export const getCacheScope = (): CacheScope => readScope();

/**
 * Records who the cache belongs to. Call on login and whenever the department is resolved or changed.
 * Values are merged, so learning the department later does not erase the user.
 */
export const setCacheScope = (scope: Partial<CacheScope>): void => {
  const current = readScope();
  const next: CacheScope = {
    userId: scope.userId !== undefined ? scope.userId : current.userId,
    departmentId: scope.departmentId !== undefined ? scope.departmentId : current.departmentId,
  };

  cachedScope = next;

  try {
    storage.set(CACHE_SCOPE_KEY, JSON.stringify(next));
  } catch {
    // In-memory scope is still correct for this session.
  }
};

export const clearCacheScope = (): void => {
  cachedScope = { userId: null, departmentId: null };

  try {
    storage.delete(CACHE_SCOPE_KEY);
  } catch {
    // Nothing to do — the in-memory scope is already reset.
  }
};

/** Key fragment identifying the current scope. */
export const getCacheScopeKey = (): string => {
  const scope = readScope();
  return `${scope.departmentId ?? 'nodept'}_${scope.userId ?? 'anon'}`;
};

/** Test hook: forget the memoized scope so the next read comes from storage. */
export const _resetCacheScopeMemo = (): void => {
  cachedScope = null;
};
