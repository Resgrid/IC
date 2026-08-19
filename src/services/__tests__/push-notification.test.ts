import type * as Notifications from 'expo-notifications';

import { usePushNotificationModalStore } from '@/stores/push-notification/store';

// Mock the store, but keep the REAL parseNotificationData — the service deep-links
// based on what the parser extracts, so the tests must exercise the real parsing.
jest.mock('@/stores/push-notification/store', () => ({
  ...jest.requireActual('@/stores/push-notification/store'),
  usePushNotificationModalStore: {
    getState: jest.fn(),
  },
}));

// The real store module (loaded via requireActual above) imports the sound service.
jest.mock('@/services/notification-sound.service', () => ({
  notificationSoundService: {
    playNotificationSound: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  osName: 'iOS',
  osVersion: '15.0',
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios ?? obj.default),
  },
}));

// Mock the navigation lib — the real module imports expo-router, whose import chain
// needs far more of react-native/expo than the minimal stubs above provide.
// Backed by a stable top-level fn so a module instance created inside
// jest.isolateModules (fresh module registry) still routes to the same mock.
const mockRouterPushWithRetry = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@/lib/navigation', () => ({
  routerPushWithRetry: mockRouterPushWithRetry,
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getDeviceUuid: jest.fn(() => 'test-device-uuid'),
}));

const mockRegisterDevice = jest.fn((..._args: unknown[]) => Promise.resolve({}));
jest.mock('@/api/devices/push', () => ({
  registerDevice: (...args: unknown[]) => mockRegisterDevice(...args),
}));

jest.mock('@/lib/auth', () => {
  // handleChatDeepLink gates the cold-start push on a hydrated session, so the mock has to
  // answer getState() as well as being callable as a selector hook.
  const state = { userId: 'test-user', status: 'signedIn' };
  const store: any = jest.fn((selector: any) => (selector ? selector(state) : state));
  store.getState = () => state;
  return { useAuthStore: store };
});

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: jest.fn(() => ({ activeCall: null })),
  },
}));

jest.mock('@/stores/security/store', () => ({
  securityStore: jest.fn((selector) => {
    const state = { rights: { DepartmentCode: 'TEST' } };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: {
    getState: jest.fn(() => ({
      performCheckIn: jest.fn(),
    })),
  },
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    getState: jest.fn(() => ({
      latitude: null,
      longitude: null,
    })),
  },
}));

// Mock expo-notifications (the push transport)
const mockReceivedRemove = jest.fn();
const mockResponseRemove = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationReceivedListener = jest.fn((_handler: unknown) => ({ remove: mockReceivedRemove }));
const mockAddNotificationResponseReceivedListener = jest.fn((_handler: unknown) => ({ remove: mockResponseRemove }));
const mockGetLastNotificationResponseAsync = jest.fn(() => Promise.resolve(null));
const mockGetPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockRequestPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockGetDevicePushTokenAsync = jest.fn(() => Promise.resolve({ data: 'test-device-token' }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: mockSetNotificationHandler,
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  getLastNotificationResponseAsync: mockGetLastNotificationResponseAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getDevicePushTokenAsync: mockGetDevicePushTokenAsync,
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

// Mock Notifee (channels, categories, foreground/background events)
const mockNotifeeForegroundUnsubscribe = jest.fn();
const mockCreateChannel = jest.fn(() => Promise.resolve());
const mockSetNotificationCategories = jest.fn(() => Promise.resolve());
const mockNotifeeRequestPermission = jest.fn(() =>
  Promise.resolve({
    authorizationStatus: 1, // AUTHORIZED
  })
);
const mockOnForegroundEvent = jest.fn((_handler: unknown) => mockNotifeeForegroundUnsubscribe);
const mockOnBackgroundEvent = jest.fn();

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: mockCreateChannel,
    setNotificationCategories: mockSetNotificationCategories,
    requestPermission: mockNotifeeRequestPermission,
    onForegroundEvent: mockOnForegroundEvent,
    onBackgroundEvent: mockOnBackgroundEvent,
  },
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
  },
  AndroidVisibility: {
    PUBLIC: 1,
  },
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
  EventType: {
    DISMISSED: 0,
    PRESS: 1,
    ACTION_PRESS: 2,
  },
}));

// Lazy require AFTER the mock consts above are initialized — the service calls
// Notifications.setNotificationHandler at module scope, and a hoisted ES import
// would evaluate it before the jest.mock factories can see their backing fns.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pushNotificationService, extractPushNotificationData, handleChatDeepLink, handleCallDeepLink } = require('../push-notification') as typeof import('../push-notification');

const mockShowNotificationModal = jest.fn(() => Promise.resolve());

describe('PushNotificationService (expo-notifications transport)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePushNotificationModalStore.getState as jest.Mock).mockReturnValue({
      showNotificationModal: mockShowNotificationModal,
    });
  });

  afterEach(() => {
    pushNotificationService.cleanup();
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('registers expo-notifications listeners and notifee event handlers', async () => {
      await pushNotificationService.initialize();

      expect(mockAddNotificationReceivedListener).toHaveBeenCalledTimes(1);
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
      expect(mockOnForegroundEvent).toHaveBeenCalledTimes(1);
      // Background handler is registered at module scope (see test below), not in initialize()
      expect(mockOnBackgroundEvent).not.toHaveBeenCalled();
      // iOS platform mock: no Android channels, but categories set
      expect(mockSetNotificationCategories).toHaveBeenCalledTimes(1);
      expect(mockCreateChannel).not.toHaveBeenCalled();
    });

    it('shows the modal when a foreground notification carries an eventCode', async () => {
      await pushNotificationService.initialize();

      const receivedHandler = mockAddNotificationReceivedListener.mock.calls[0]?.[0] as unknown as (n: unknown) => void;
      receivedHandler({
        request: {
          content: {
            title: 'Assignment',
            body: 'You were assigned to Medical',
            data: { eventCode: 'C:123' },
          },
        },
      });

      expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'C:123', title: 'Assignment' }));
    });

    it('ignores foreground notifications without an eventCode', async () => {
      await pushNotificationService.initialize();

      const receivedHandler = mockAddNotificationReceivedListener.mock.calls[0]?.[0] as unknown as (n: unknown) => void;
      receivedHandler({
        request: {
          content: { title: 'Nothing', body: 'No code', data: {} },
        },
      });

      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('deep-links to the call detail screen when a call notification is tapped', async () => {
      jest.useFakeTimers();
      await pushNotificationService.initialize();

      const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0] as unknown as (r: unknown) => void;
      responseHandler({
        actionIdentifier: 'default',
        notification: {
          request: {
            identifier: 'tap-call-1',
            content: {
              title: 'New Call',
              body: 'Structure fire',
              data: { eventCode: 'C:55' },
            },
          },
        },
      });

      expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
      // The tap handler awaits its deep-link before deciding on the modal fallback, so the
      // routing lands a microtask after the timer — advanceTimersByTimeAsync flushes both.
      await jest.advanceTimersByTimeAsync(400);
      expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '55' } }, expect.objectContaining({ maxAttempts: 40 }));
      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('deep-links from an iOS tap where the eventCode only exists on the trigger payload', async () => {
      jest.useFakeTimers();
      await pushNotificationService.initialize();

      const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0] as unknown as (r: unknown) => void;
      responseHandler({
        actionIdentifier: 'default',
        notification: {
          request: {
            identifier: 'tap-ios-trigger',
            content: { title: 'New Call', body: 'MVA', data: undefined },
            trigger: { type: 'push', payload: { aps: { alert: {} }, eventCode: 'C:88' } },
          },
        },
      });

      // The tap handler awaits its deep-link before deciding on the modal fallback, so the
      // routing lands a microtask after the timer — advanceTimersByTimeAsync flushes both.
      await jest.advanceTimersByTimeAsync(400);
      expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '88' } }, expect.objectContaining({ maxAttempts: 40 }));
      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('shows the modal after a delay when a non-deep-linked notification is tapped', async () => {
      jest.useFakeTimers();
      await pushNotificationService.initialize();

      const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0] as unknown as (r: unknown) => void;
      responseHandler({
        actionIdentifier: 'default',
        notification: {
          request: {
            identifier: 'tap-modal-1',
            content: {
              title: 'Command Transferred',
              body: 'Command passed',
              data: { eventCode: 'M:12' },
            },
          },
        },
      });

      expect(mockShowNotificationModal).not.toHaveBeenCalled();
      // The tap handler awaits its deep-link before deciding on the modal fallback, so the
      // routing lands a microtask after the timer — advanceTimersByTimeAsync flushes both.
      await jest.advanceTimersByTimeAsync(400);
      expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'M:12' }));
      expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
    });

    it('handles the same cold-start tap only once across the listener and killed-state replay', async () => {
      jest.useFakeTimers();
      const launchResponse = {
        actionIdentifier: 'default',
        notification: {
          request: {
            identifier: 'launch-tap',
            content: { title: 'Assignment', body: 'Lane', data: { eventCode: 'C:77' } },
          },
        },
      };
      // Killed-state replay returns the same response the live listener already delivered
      mockGetLastNotificationResponseAsync.mockResolvedValueOnce(launchResponse as never);

      await pushNotificationService.initialize();

      const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0] as unknown as (r: unknown) => void;
      responseHandler(launchResponse);

      // Let the killed-state initial delay elapse and its promise resolve
      jest.advanceTimersByTime(1100);
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(1000);

      // A call tap deep-links (once) instead of surfacing the modal.
      expect(mockRouterPushWithRetry).toHaveBeenCalledTimes(1);
      expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '77' } }, expect.objectContaining({ maxAttempts: 40 }));
      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('still handles distinct notification taps separately', async () => {
      jest.useFakeTimers();
      await pushNotificationService.initialize();

      const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0] as unknown as (r: unknown) => void;
      const makeResponse = (id: string, eventCode: string) => ({
        actionIdentifier: 'default',
        notification: {
          request: { identifier: id, content: { title: 'T', body: 'B', data: { eventCode } } },
        },
      });

      responseHandler(makeResponse('tap-a', 'C:1'));
      responseHandler(makeResponse('tap-b', 'C:2'));
      // The tap handler awaits its deep-link before deciding on the modal fallback, so the
      // routing lands a microtask after the timer — advanceTimersByTimeAsync flushes both.
      await jest.advanceTimersByTimeAsync(400);

      expect(mockRouterPushWithRetry).toHaveBeenCalledTimes(2);
      expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '1' } }, expect.objectContaining({ maxAttempts: 40 }));
      expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '2' } }, expect.objectContaining({ maxAttempts: 40 }));
    });

    it('deep-links to the call from a notifee-displayed notification press', async () => {
      await pushNotificationService.initialize();

      const foregroundHandler = mockOnForegroundEvent.mock.calls[0]?.[0] as unknown as (e: unknown) => Promise<void>;
      await foregroundHandler({
        type: 1, // PRESS
        detail: {
          notification: { title: 'New Call', body: 'Structure fire', data: { eventCode: 'C:9' } },
        },
      });

      expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '9' } }, expect.objectContaining({ maxAttempts: 40 }));
      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('shows the modal from a notifee-displayed press without a deep-linkable code', async () => {
      await pushNotificationService.initialize();

      const foregroundHandler = mockOnForegroundEvent.mock.calls[0]?.[0] as unknown as (e: unknown) => Promise<void>;
      await foregroundHandler({
        type: 1, // PRESS
        detail: {
          notification: { title: 'Lane Lead Changed', body: 'New lead', data: { eventCode: 'M:31' } },
        },
      });

      expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'M:31' }));
      expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
    });
  });

  describe('registerForPushNotifications', () => {
    it('requests permissions, fetches the native token, and registers the device user-scoped', async () => {
      const token = await pushNotificationService.registerForPushNotifications('user-1', 'DEPT1');

      expect(token).toBe('test-device-token');
      expect(mockNotifeeRequestPermission).toHaveBeenCalledWith(expect.objectContaining({ criticalAlert: true }));
      expect(mockGetDevicePushTokenAsync).toHaveBeenCalledTimes(1);
      expect(mockRegisterDevice).toHaveBeenCalledWith({
        UserId: 'user-1',
        Token: 'test-device-token',
        Platform: 1,
        DeviceUuid: 'test-device-uuid',
        Prefix: 'DEPT1',
        Source: 'IC',
      });
    });

    it('requests OS permission with critical alerts when not yet granted', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' } as never);

      await pushNotificationService.registerForPushNotifications('user-1', 'DEPT1');

      expect(mockRequestPermissionsAsync).toHaveBeenCalledWith({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
        },
      });
    });

    it('returns null and does not register when permission is denied', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);

      const token = await pushNotificationService.registerForPushNotifications('user-1', 'DEPT1');

      expect(token).toBeNull();
      expect(mockRegisterDevice).not.toHaveBeenCalled();
    });

    it('returns null without a user id', async () => {
      const token = await pushNotificationService.registerForPushNotifications('', 'DEPT1');

      expect(token).toBeNull();
      expect(mockRegisterDevice).not.toHaveBeenCalled();
    });
  });

  describe('module scope', () => {
    it('registers the notifee background handler at module load (headless/killed state)', () => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../push-notification');
      });

      expect(mockOnBackgroundEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('removes all listeners', async () => {
      await pushNotificationService.initialize();
      pushNotificationService.cleanup();

      expect(mockReceivedRemove).toHaveBeenCalledTimes(1);
      expect(mockResponseRemove).toHaveBeenCalledTimes(1);
      expect(mockNotifeeForegroundUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

describe('handleChatDeepLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['t:channel-1', 'channel-1'],
    ['g:9101', '9101'],
    ['T:channel-1', 'channel-1'],
    ['G:9101', '9101'],
  ])('navigates to the chat conversation for %s', async (eventCode, channelId) => {
    await expect(handleChatDeepLink(eventCode)).resolves.toBe(true);
    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/chat/[channelId]', params: { channelId } }, expect.objectContaining({ maxAttempts: 40 }));
  });

  it.each(['t:a/b', 't:a\\b', 'g:a?x=1', 'g:a#fragment', 'x:123', 't:', 'notacode', ':missingprefix'])('rejects invalid payload %s', async (eventCode) => {
    await expect(handleChatDeepLink(eventCode)).resolves.toBe(false);
    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
  });

  // Resolving false is what tells the tap handler to fall back to the notification modal
  // instead of leaving the app on whatever screen it opened to.
  it('resolves false when the navigation never lands', async () => {
    mockRouterPushWithRetry.mockRejectedValueOnce(new Error('navigation never became ready'));

    await expect(handleChatDeepLink('t:channel-1')).resolves.toBe(false);
  });
});

describe('handleCallDeepLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['C:1234', '1234'],
    ['c:1234', '1234'],
    ['C1234', '1234'],
  ])('navigates to the call detail screen for %s', async (eventCode, id) => {
    await expect(handleCallDeepLink(eventCode)).resolves.toBe(true);
    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id } }, expect.objectContaining({ maxAttempts: 40 }));
  });

  it.each(['C:12/34', 'C:12?x=1', 'C:12#frag', 'M:1', 't:chan', 'C:', 'C', 'notacode'])('does not consume %s', async (eventCode) => {
    await expect(handleCallDeepLink(eventCode)).resolves.toBe(false);
    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
  });

  it('resolves false when the navigation never lands', async () => {
    mockRouterPushWithRetry.mockRejectedValueOnce(new Error('navigation never became ready'));

    await expect(handleCallDeepLink('C:1234')).resolves.toBe(false);
  });
});

describe('extractPushNotificationData', () => {
  const makeRequest = (data: unknown, triggerPayload?: unknown): Notifications.NotificationRequest =>
    ({
      identifier: 'req-1',
      content: { title: 'T', body: 'B', data },
      trigger: triggerPayload === undefined ? { type: 'push' } : { type: 'push', payload: triggerPayload },
    }) as unknown as Notifications.NotificationRequest;

  it('reads eventCode from content.data (Android FCM path)', () => {
    const { eventCode, data } = extractPushNotificationData(makeRequest({ eventCode: 'g:123', other: 1 }));
    expect(eventCode).toBe('g:123');
    expect(data).toEqual({ eventCode: 'g:123', other: 1 });
  });

  it('falls back to a top-level trigger payload key (iOS APNs custom key)', () => {
    const { eventCode } = extractPushNotificationData(makeRequest(undefined, { aps: { alert: {} }, eventCode: 't:abc', type: '13' }));
    expect(eventCode).toBe('t:abc');
  });

  it('falls back to the trigger payload body dict (iOS expo-style body key)', () => {
    const { eventCode } = extractPushNotificationData(makeRequest(null, { aps: {}, body: { eventCode: 'C:55' } }));
    expect(eventCode).toBe('C:55');
  });

  it('falls back to an aps-nested eventCode (FCM-relayed APNs override)', () => {
    const { eventCode } = extractPushNotificationData(makeRequest({}, { aps: { category: 'chats', eventCode: 'g:77' } }));
    expect(eventCode).toBe('g:77');
  });

  it('returns undefined when no eventCode exists anywhere', () => {
    const { eventCode, data } = extractPushNotificationData(makeRequest({ foo: 'bar' }, { aps: {} }));
    expect(eventCode).toBeUndefined();
    expect(data).toEqual({ foo: 'bar' });
  });
});

describe('notifee background events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The background handler is registered at module scope, so load a fresh module
  // instance to capture it. The navigation mock is backed by a stable top-level fn,
  // so the isolated instance still routes to mockRouterPushWithRetry.
  const getBackgroundHandler = (): ((event: { type: number; detail: Record<string, unknown> }) => Promise<void>) => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../push-notification');
    });
    return mockOnBackgroundEvent.mock.calls[0]?.[0] as unknown as (event: { type: number; detail: Record<string, unknown> }) => Promise<void>;
  };

  it('deep-links to chat when a background notification press carries a chat eventCode', async () => {
    const backgroundHandler = getBackgroundHandler();

    await backgroundHandler({
      type: 1, // PRESS
      detail: { notification: { data: { eventCode: 't:chan-9' } } },
    });

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/chat/[channelId]', params: { channelId: 'chan-9' } }, expect.objectContaining({ maxAttempts: 40 }));
  });

  it('deep-links to the call when a background notification press carries a call eventCode', async () => {
    const backgroundHandler = getBackgroundHandler();

    await backgroundHandler({
      type: 1, // PRESS
      detail: { notification: { data: { eventCode: 'C:42' } } },
    });

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '42' } }, expect.objectContaining({ maxAttempts: 40 }));
  });

  it('does nothing for a background press without a deep-linkable eventCode', async () => {
    const backgroundHandler = getBackgroundHandler();

    await backgroundHandler({
      type: 1, // PRESS
      detail: { notification: { data: { eventCode: 'M:7' } } },
    });

    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
  });
});
