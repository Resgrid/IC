/**
 * Every way the IC app signs someone out must leave nothing of them behind: no stored refresh token,
 * no user id (the API cache scope), and the full app-data reset run exactly once. These drive the real
 * auth store through each logout path — Settings (the store's logout), a missing or rejected refresh
 * token, the axios 401 interceptor and the command-app access check — with only storage, the token API
 * and the cache mocked.
 */
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

const mockRefreshTokenSingleFlight = jest.fn();

jest.mock('@/lib/auth/api', () => ({
  loginRequest: jest.fn(),
  ssoExternalTokenRequest: jest.fn(),
  refreshTokenSingleFlight: (...args: unknown[]) => mockRefreshTokenSingleFlight(...args),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }));

// In-memory stand-in for MMKV. Built inside the factory (it runs at import time, before any const in
// this file exists) and reached through jest.requireMock.
jest.mock('@/lib/storage', () => {
  const values = new Map<string, string>();
  return {
    __values: values,
    getItem: jest.fn((key: string) => {
      const value = values.get(key);
      return value ? JSON.parse(value) : null;
    }),
    setItem: jest.fn(async (key: string, value: unknown) => {
      values.set(key, JSON.stringify(value));
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
    zustandStorage: {
      getItem: jest.fn((name: string) => values.get(name) ?? null),
      setItem: jest.fn((name: string, value: string) => {
        values.set(name, value);
      }),
      removeItem: jest.fn((name: string) => {
        values.delete(name);
      }),
    },
  };
});

jest.mock('@/lib/cache/cache-manager', () => ({
  cacheManager: { clear: jest.fn() },
}));

jest.mock('@/lib/cache/cache-scope', () => ({
  getCacheScope: jest.fn(() => ({ userId: null, departmentId: null })),
  setCacheScope: jest.fn(),
  clearCacheScope: jest.fn(),
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: () => 'https://api.example.test/api/v4',
}));

jest.mock('@/lib/data-protection/grant-provider', () => ({
  readProtectedGrantHeaders: () => ({}),
}));

let mockRights: { CanLoginToCommandApp?: boolean } | null = null;
jest.mock('@/stores/security/store', () => ({
  securityStore: { getState: () => ({ rights: mockRights }) },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: { getState: () => ({ showToast: jest.fn() }) },
}));

import { api } from '@/api/common/client';
import { enforceCommandAppAccess } from '@/lib/auth/command-app-access';
import { registerSessionCleanupHandler } from '@/lib/auth/session-cleanup';
import { _clearSignOutHooks, registerSignOutHook } from '@/lib/auth/sign-out-hooks';

import useAuthStore from '../store';

const storedValues = (): Map<string, string> => jest.requireMock('@/lib/storage').__values;
const { removeItem } = jest.requireMock('@/lib/storage');
const { cacheManager } = jest.requireMock('@/lib/cache/cache-manager');
const { setCacheScope, clearCacheScope } = jest.requireMock('@/lib/cache/cache-scope');

const mockCleanup = jest.fn();

const signIn = (userId = 'user-1') => {
  storedValues().set('authResponse', JSON.stringify({ access_token: 'access', refresh_token: 'refresh-token-secret', id_token: 'x.y.z' }));
  storedValues().set('token', JSON.stringify({ access: 'access', refresh: 'refresh-token-secret' }));
  useAuthStore.setState({
    accessToken: 'access',
    refreshToken: 'refresh-token-secret',
    refreshTokenExpiresOn: '9999999999999',
    status: 'signedIn',
    userId,
    profile: { sub: userId, name: 'Commander' } as never,
    refreshTimeoutId: null,
  });
};

const expectFullySignedOut = () => {
  const state = useAuthStore.getState();
  expect(state.status).toBe('signedOut');
  expect(state.accessToken).toBeNull();
  expect(state.refreshToken).toBeNull();
  expect(state.refreshTokenExpiresOn).toBeNull();
  expect(state.userId).toBeNull();
  expect(state.profile).toBeNull();
  // The token response outside the persisted store is what held the refresh token after logout.
  expect(storedValues().has('authResponse')).toBe(false);
  expect(storedValues().has('token')).toBe(false);
  expect(mockCleanup).toHaveBeenCalledTimes(1);
};

const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

describe('auth store logout paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storedValues().clear();
    mockRights = null;
    mockCleanup.mockReset().mockResolvedValue(undefined);
    registerSessionCleanupHandler(mockCleanup);
  });

  afterEach(() => {
    const { refreshTimeoutId } = useAuthStore.getState();
    if (refreshTimeoutId !== null) {
      clearTimeout(refreshTimeoutId);
    }
  });

  it('Settings / manual logout removes stored tokens, clears identity and runs the full reset', async () => {
    signIn();

    await useAuthStore.getState().logout();

    expectFullySignedOut();
    expect(removeItem).toHaveBeenCalledWith('authResponse');
  });

  it('runs the reset once for concurrent logouts, and again for a later one', async () => {
    signIn();

    await Promise.all([useAuthStore.getState().logout(), useAuthStore.getState().logout(), useAuthStore.getState().logout()]);
    expect(mockCleanup).toHaveBeenCalledTimes(1);

    signIn();
    await useAuthStore.getState().logout();
    expect(mockCleanup).toHaveBeenCalledTimes(2);
  });

  it('runs the sign-out hooks once, with the session still signed in, before anything is cleared', async () => {
    const seen: { token: string | null; status: string }[] = [];
    registerSignOutHook(async (token) => {
      seen.push({ token, status: useAuthStore.getState().status });
    });
    signIn();

    await Promise.all([useAuthStore.getState().logout(), useAuthStore.getState().logout()]);

    expect(seen).toEqual([{ token: 'access', status: 'signedIn' }]);
    expectFullySignedOut();
    _clearSignOutHooks();
  });

  it('still signs out fully when a sign-out hook fails', async () => {
    registerSignOutHook(async () => {
      throw new Error('server unreachable');
    });
    signIn();

    await useAuthStore.getState().logout();

    expectFullySignedOut();
    _clearSignOutHooks();
  });

  it('still removes the stored tokens and signs out when the reset itself fails', async () => {
    signIn();
    mockCleanup.mockRejectedValueOnce(new Error('reset failed'));

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();

    expectFullySignedOut();
  });

  it('a refresh with no refresh token goes through the full logout', async () => {
    signIn();
    useAuthStore.setState({ refreshToken: null });

    await useAuthStore.getState().refreshAccessToken();

    expectFullySignedOut();
    expect(mockRefreshTokenSingleFlight).not.toHaveBeenCalled();
  });

  it('a rejected refresh token goes through the full logout', async () => {
    signIn();
    mockRefreshTokenSingleFlight.mockRejectedValueOnce(new Error('Request failed with status code 400'));

    await useAuthStore.getState().refreshAccessToken();

    expectFullySignedOut();
  });

  it('a network failure during refresh keeps the session and its stored token', async () => {
    // The retry timer lands in persisted state; fake timers give a serializable handle, as on device.
    jest.useFakeTimers();
    signIn();
    mockRefreshTokenSingleFlight.mockRejectedValueOnce(new Error('Network Error'));

    await useAuthStore.getState().refreshAccessToken();

    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(storedValues().has('authResponse')).toBe(true);
    expect(mockCleanup).not.toHaveBeenCalled();

    jest.clearAllTimers();
    useAuthStore.setState({ refreshTimeoutId: null });
    jest.useRealTimers();
  });

  it('the axios 401 interceptor signs out through the full logout when the refresh is rejected', async () => {
    signIn();
    const unauthorized = (config: InternalAxiosRequestConfig) =>
      new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config,
      } as AxiosResponse);
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = (config) => Promise.reject(unauthorized(config as InternalAxiosRequestConfig));
    mockRefreshTokenSingleFlight.mockImplementationOnce(() => {
      const config = { headers: {} } as InternalAxiosRequestConfig;
      return Promise.reject(
        new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', config, null, { status: 400, statusText: 'Bad Request', data: {}, headers: {}, config } as AxiosResponse)
      );
    });

    try {
      await expect(api.get('/Calls/GetActiveCalls')).rejects.toBeDefined();
      await flush();
    } finally {
      api.defaults.adapter = originalAdapter;
    }

    expectFullySignedOut();
  });

  it('the command-app access denial signs out through the full logout', async () => {
    signIn();
    mockRights = { CanLoginToCommandApp: false };

    const denied = await enforceCommandAppAccess({ deniedMessage: 'Not authorized', userId: 'user-1' });

    expect(denied).toBe(true);
    expectFullySignedOut();
  });

  it('moves the API cache scope with the signed-in identity', async () => {
    signIn('user-1');
    expect(setCacheScope).toHaveBeenLastCalledWith({ userId: 'user-1' });

    cacheManager.clear.mockClear();
    await useAuthStore.getState().logout();

    // Signing out drops everything the previous user cached and returns the scope to anonymous.
    expect(cacheManager.clear).toHaveBeenCalled();
    expect(clearCacheScope).toHaveBeenCalled();

    signIn('user-2');
    expect(setCacheScope).toHaveBeenLastCalledWith({ userId: 'user-2' });
  });
});

describe('auth store rehydration', () => {
  const persist = (state: Record<string, unknown>) => JSON.stringify({ state, version: 0 });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('drops a token response left on disk by a sign-out under an earlier build', async () => {
    await jest.isolateModulesAsync(async () => {
      const storage = jest.requireMock('@/lib/storage');
      storage.__values.clear();
      storage.__values.set('auth-storage', persist({ status: 'signedOut', accessToken: null, refreshToken: null }));
      storage.__values.set('authResponse', JSON.stringify({ refresh_token: 'left-behind' }));

      require('../store');
      await flush();

      expect(storage.__values.has('authResponse')).toBe(false);
    });
  });

  it('keeps the token response while a session is persisted', async () => {
    jest.useFakeTimers();
    await jest.isolateModulesAsync(async () => {
      const storage = jest.requireMock('@/lib/storage');
      storage.__values.clear();
      storage.__values.set('auth-storage', persist({ status: 'signedIn', accessToken: 'access', refreshToken: 'refresh', userId: 'user-1' }));
      storage.__values.set('authResponse', JSON.stringify({ refresh_token: 'refresh' }));

      require('../store');

      expect(storage.__values.has('authResponse')).toBe(true);
    });
  });

  it('scopes the API cache to the restored identity, which rehydrates before the identity subscription exists', async () => {
    jest.useFakeTimers();
    await jest.isolateModulesAsync(async () => {
      const storage = jest.requireMock('@/lib/storage');
      const cacheScope = jest.requireMock('@/lib/cache/cache-scope');
      storage.__values.clear();
      storage.__values.set('auth-storage', persist({ status: 'signedIn', accessToken: 'access', refreshToken: 'refresh', userId: 'user-1' }));
      cacheScope.getCacheScope.mockReturnValue({ userId: null, departmentId: null });
      cacheScope.setCacheScope.mockClear();

      require('../store');

      expect(cacheScope.setCacheScope).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  it('leaves a cache scope that already matches the restored identity alone', async () => {
    jest.useFakeTimers();
    await jest.isolateModulesAsync(async () => {
      const storage = jest.requireMock('@/lib/storage');
      const cacheScope = jest.requireMock('@/lib/cache/cache-scope');
      storage.__values.clear();
      storage.__values.set('auth-storage', persist({ status: 'signedIn', accessToken: 'access', refreshToken: 'refresh', userId: 'user-1' }));
      cacheScope.getCacheScope.mockReturnValue({ userId: 'user-1', departmentId: 'dept-1' });
      cacheScope.setCacheScope.mockClear();

      require('../store');

      expect(cacheScope.setCacheScope).not.toHaveBeenCalled();
    });
  });
});
