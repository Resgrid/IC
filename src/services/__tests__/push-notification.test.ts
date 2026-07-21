import { usePushNotificationModalStore } from '@/stores/push-notification/store';

// Mock the store
jest.mock('@/stores/push-notification/store', () => ({
  usePushNotificationModalStore: {
    getState: jest.fn(),
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

jest.mock('@/lib/auth', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = { userId: 'test-user' };
    return selector ? selector(state) : state;
  }),
}));

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
const { pushNotificationService } = require('../push-notification') as typeof import('../push-notification');

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
      expect(mockOnBackgroundEvent).toHaveBeenCalledTimes(1);
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

    it('shows the modal after a delay when a notification is tapped', async () => {
      jest.useFakeTimers();
      await pushNotificationService.initialize();

      const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0] as unknown as (r: unknown) => void;
      responseHandler({
        actionIdentifier: 'default',
        notification: {
          request: {
            content: {
              title: 'Command Transferred',
              body: 'Command passed',
              data: { eventCode: 'C:55' },
            },
          },
        },
      });

      expect(mockShowNotificationModal).not.toHaveBeenCalled();
      jest.advanceTimersByTime(400);
      expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'C:55' }));
    });

    it('shows the modal from a notifee-displayed notification press', async () => {
      await pushNotificationService.initialize();

      const foregroundHandler = mockOnForegroundEvent.mock.calls[0]?.[0] as unknown as (e: unknown) => Promise<void>;
      await foregroundHandler({
        type: 1, // PRESS
        detail: {
          notification: { title: 'Lane Lead Changed', body: 'New lead', data: { eventCode: 'C:9' } },
        },
      });

      expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'C:9' }));
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
