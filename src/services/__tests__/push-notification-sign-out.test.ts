import * as Notifications from 'expo-notifications';

import { registerDevice } from '@/api/devices/push';
import { runSignOutHooks } from '@/lib/auth/sign-out-hooks';
import { logger } from '@/lib/logging';
import type { StoredNativePushRegistration } from '@/lib/storage/app';

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios ?? obj.default),
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ data: 'native-token' })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  setBadgeCountAsync: jest.fn(() => Promise.resolve(true)),
  dismissAllNotificationsAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(() => Promise.resolve()),
    setNotificationCategories: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
    cancelAllNotifications: jest.fn(() => Promise.resolve()),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidVisibility: { PUBLIC: 1 },
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2 },
}));

jest.mock('@/lib/auth', () => {
  const state = { status: 'signedIn', userId: 'user-1' };
  const store = Object.assign(
    jest.fn((selector?: (current: typeof state) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { useAuthStore: store };
});

jest.mock('@/stores/push-notification/store', () => ({
  isSafeRouteId: jest.fn(() => true),
  parseNotificationData: jest.fn(() => ({ type: 'unknown', id: '' })),
  usePushNotificationModalStore: { getState: jest.fn(() => ({ showNotificationModal: jest.fn() })) },
}));

jest.mock('@/lib/navigation', () => ({ routerPushWithRetry: jest.fn(() => Promise.resolve()) }));

jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

jest.mock('@/lib/mfa/client-app', () => ({ CLIENT_HEADER: 'X-Resgrid-Client', RESGRID_CLIENT: 'ic' }));

// The device's stored registration, as MMKV would keep it across a restart.
let mockStoredRegistration: StoredNativePushRegistration | null = null;
jest.mock('@/lib/storage/app', () => ({
  getDeviceUuid: jest.fn(() => 'device-uuid'),
  getBaseApiUrl: jest.fn(() => 'https://api.example/api/v4'),
  getNativePushRegistration: jest.fn(() => mockStoredRegistration),
  setNativePushRegistration: jest.fn((value: StoredNativePushRegistration) => {
    mockStoredRegistration = value;
    return Promise.resolve();
  }),
  removeNativePushRegistration: jest.fn(() => {
    mockStoredRegistration = null;
    return Promise.resolve();
  }),
}));

jest.mock('@/api/devices/push', () => ({
  registerDevice: jest.fn(() => Promise.resolve({ Status: 'queued' })),
}));

jest.mock('@/stores/security/store', () => ({ securityStore: jest.fn(() => ({})) }));
jest.mock('@/stores/app/core-store', () => ({ useCoreStore: { getState: jest.fn(() => ({ activeCall: null })) } }));
jest.mock('@/stores/app/location-store', () => ({ useLocationStore: { getState: jest.fn(() => ({ latitude: null, longitude: null })) } }));
jest.mock('@/stores/check-in-timers/store', () => ({ useCheckInTimerStore: { getState: jest.fn(() => ({ performCheckIn: jest.fn() })) } }));

describe('push notification sign-out', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let pushNotificationService: {
    registerForPushNotifications: (userId: string, code: string) => Promise<string | null>;
    unregisterFromPushNotifications: () => Promise<void>;
  };

  beforeAll(() => {
    // Required after the mocks are in place: the service registers its sign-out hook at module scope.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ pushNotificationService } = require('../push-notification'));
  });

  beforeEach(async () => {
    fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    // Start every test from a clean slate: nothing registered.
    await runSignOutHooks(null);
    fetchMock.mockClear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('takes the registered token off the IC subscriber as the signing-out session', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({ Token: 'native-token', Prefix: 'DEPT', Source: 'IC' }));

    await runSignOutHooks('access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example/api/v4/Devices/UnRegisterNativePush');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(expect.objectContaining({ 'Content-Type': 'application/json', Authorization: 'Bearer access-token', 'X-Resgrid-Client': 'ic' }));
    expect(JSON.parse(init.body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', Source: 'IC' });
  });

  it('does not call the server when the phone never registered', async () => {
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('unregisters only once per registration', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');

    await runSignOutHooks('access-token');
    await runSignOutHooks('access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call the server without an access token', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');

    await runSignOutHooks(null);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets sign-out carry on when the server refuses or is unreachable', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 400 }));
    await expect(runSignOutHooks('access-token')).resolves.toBeUndefined();

    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(runSignOutHooks('access-token')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('does not register a token when permission is refused, so there is nothing to unregister', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    await runSignOutHooks('access-token');

    expect(registerDevice).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('takes a registration made before the app restarted off the server, before this run has registered again', async () => {
    // A previous process registered; this one restored the session but has not registered yet (or could not).
    mockStoredRegistration = { UserId: 'user-1', Token: 'earlier-token', Prefix: 'DEPT', Source: 'IC' };

    await runSignOutHooks('access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Token: 'earlier-token', Prefix: 'DEPT', Source: 'IC' });
    expect(mockStoredRegistration).toBeNull();
  });

  it("leaves another user's registration to that user's session", async () => {
    mockStoredRegistration = { UserId: 'user-2', Token: 'other-token', Prefix: 'DEPT', Source: 'IC' };

    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockStoredRegistration).toBeNull();
  });

  it('removes a registration that finishes while sign-out is under way', async () => {
    let finishRegistration: () => void = () => undefined;
    (registerDevice as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRegistration = () => resolve({ Status: 'queued' });
        })
    );

    const registering = pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    // Let the registration reach the server call before sign-out starts.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const signingOut = runSignOutHooks('access-token');
    finishRegistration();
    await Promise.all([registering, signingOut]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', Source: 'IC' });
    expect(mockStoredRegistration).toBeNull();
  });

  it('records the token each overlapping registration actually sent', async () => {
    (Notifications.getDevicePushTokenAsync as jest.Mock).mockResolvedValueOnce({ data: 'first-token' }).mockResolvedValueOnce({ data: 'second-token' });
    let finishFirst: () => void = () => undefined;
    (registerDevice as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = () => resolve({ Status: 'queued' });
        })
    );

    const first = pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    const second = pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The second waits for the first, so it has not asked for a token yet.
    expect(Notifications.getDevicePushTokenAsync).toHaveBeenCalledTimes(1);
    finishFirst();

    await expect(first).resolves.toBe('first-token');
    await expect(second).resolves.toBe('second-token');
    expect(registerDevice).toHaveBeenNthCalledWith(1, expect.objectContaining({ Token: 'first-token' }));
    expect(registerDevice).toHaveBeenNthCalledWith(2, expect.objectContaining({ Token: 'second-token' }));
    expect(mockStoredRegistration).toEqual({ UserId: 'user-1', Token: 'second-token', Prefix: 'DEPT', Source: 'IC' });
  });

  it('forgets the registration when the local push state is cleared', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');

    await pushNotificationService.unregisterFromPushNotifications();
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
