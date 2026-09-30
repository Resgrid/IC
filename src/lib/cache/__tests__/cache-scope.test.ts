/**
 * The API cache is keyed by server and signed-in identity, so a second person signing in on a shared
 * command laptop is never served the previous account's cached units, calls or contacts.
 */
jest.mock('@/lib/storage', () => {
  const values = new Map<string, string>();
  return {
    __values: values,
    storage: {
      getString: jest.fn((key: string) => values.get(key)),
      set: jest.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      delete: jest.fn((key: string) => {
        values.delete(key);
      }),
      getAllKeys: jest.fn(() => Array.from(values.keys())),
    },
  };
});

let mockBaseUrl = 'https://api.example.test/api/v4';
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: () => mockBaseUrl,
}));

import { cacheManager } from '../cache-manager';
import { _resetCacheScopeMemo, clearCacheScope, getCacheScope, getCacheScopeKey, setCacheScope } from '../cache-scope';

const values = (): Map<string, string> => jest.requireMock('@/lib/storage').__values;

describe('API cache scope', () => {
  beforeEach(() => {
    values().clear();
    _resetCacheScopeMemo();
    mockBaseUrl = 'https://api.example.test/api/v4';
  });

  it('starts anonymous', () => {
    expect(getCacheScope()).toEqual({ userId: null, departmentId: null });
    expect(getCacheScopeKey()).toBe('nodept_anon');
  });

  it('never serves one user the entries another user cached', () => {
    setCacheScope({ userId: 'user-a', departmentId: '10' });
    cacheManager.set('/Units/GetAllUnits', ['unit-of-a']);
    expect(cacheManager.get('/Units/GetAllUnits')).toEqual(['unit-of-a']);

    setCacheScope({ userId: 'user-b' });

    expect(cacheManager.get('/Units/GetAllUnits')).toBeNull();
    // Offline fallback must not leak either.
    expect(cacheManager.getStale('/Units/GetAllUnits')).toBeNull();
  });

  it('scopes by department and by server as well as by user', () => {
    setCacheScope({ userId: 'user-a', departmentId: '10' });
    cacheManager.set('/Calls/GetActiveCalls', ['call-in-10']);

    setCacheScope({ departmentId: '20' });
    expect(cacheManager.get('/Calls/GetActiveCalls')).toBeNull();

    setCacheScope({ departmentId: '10' });
    mockBaseUrl = 'https://self-hosted.example.test/api/v4';
    expect(cacheManager.get('/Calls/GetActiveCalls')).toBeNull();
  });

  it('merges partial updates so learning the department keeps the user', () => {
    setCacheScope({ userId: 'user-a' });
    setCacheScope({ departmentId: '10' });

    expect(getCacheScope()).toEqual({ userId: 'user-a', departmentId: '10' });
    expect(getCacheScopeKey()).toBe('10_user-a');
  });

  it('survives a restart through storage, and clearing returns to anonymous', () => {
    setCacheScope({ userId: 'user-a', departmentId: '10' });
    _resetCacheScopeMemo();
    expect(getCacheScope()).toEqual({ userId: 'user-a', departmentId: '10' });

    clearCacheScope();
    expect(getCacheScope()).toEqual({ userId: null, departmentId: null });
    expect(values().has('api_cache_scope')).toBe(false);
  });

  it('treats a corrupt stored scope as anonymous instead of failing requests', () => {
    values().set('api_cache_scope', '{not json');

    expect(getCacheScopeKey()).toBe('nodept_anon');
  });

  it('clear() drops every cached entry whatever scope wrote it', () => {
    setCacheScope({ userId: 'user-a' });
    cacheManager.set('/Contacts/GetAllContacts', ['c1']);
    setCacheScope({ userId: 'user-b' });
    cacheManager.set('/Contacts/GetAllContacts', ['c2']);

    cacheManager.clear();

    expect(Array.from(values().keys())).toEqual(['api_cache_scope']);
    // The scope record survives, so the session keeps its identity across a restart.
    _resetCacheScopeMemo();
    expect(getCacheScope().userId).toBe('user-b');
  });
});
