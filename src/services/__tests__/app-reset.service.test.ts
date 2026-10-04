// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  storage: {
    getAllKeys: jest.fn(() => ['key1', 'IS_FIRST_TIME', 'baseUrl', 'SHARED_INSTALLATION', 'key2']),
    delete: jest.fn(),
  },
}));

// The real token store persists through @/lib/storage, which is mocked above without zustandStorage.
jest.mock('@/lib/mapbox-token', () => ({
  clearMapboxToken: jest.fn(),
}));

// Mock storage/app functions
jest.mock('@/lib/storage/app', () => ({
  BASE_API_URL_STORAGE_KEY: 'baseUrl',
  removeActiveCallId: jest.fn(),
  removeDeviceUuid: jest.fn(),
}));

// Mock all the store imports
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/app/livekit-store', () => ({
  useLiveKitStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/app/audio-stream-store', () => ({
  useAudioStreamStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/app/bluetooth-audio-store', () => ({
  INITIAL_STATE: {
    connectedDevice: null,
    isScanning: false,
    isConnecting: false,
    availableDevices: [],
    connectionError: null,
    isAudioRoutingActive: false,
  },
  useBluetoothAudioStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/app/loading-store', () => ({
  useLoadingStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/contacts/store', () => ({
  useContactsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/notes/store', () => ({
  useNotesStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/offline-queue/store', () => ({
  useOfflineQueueStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/protocols/store', () => ({
  useProtocolsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/push-notification/store', () => ({
  usePushNotificationModalStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/roles/store', () => ({
  useRolesStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/security/store', () => ({
  securityStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/feature-flags/store', () => ({
  featureFlagsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

// Read lazily inside getState, so it is initialised by the time a test calls it.
const mockClearLiveLocations = jest.fn();
const mockDisconnectUpdateHub = jest.fn();
const mockDisconnectGeolocationHub = jest.fn();
const mockDisconnectChatHub = jest.fn();
jest.mock('@/stores/signalr/signalr-store', () => ({
  useSignalRStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({
      clearLiveLocations: mockClearLiveLocations,
      disconnectUpdateHub: mockDisconnectUpdateHub,
      disconnectGeolocationHub: mockDisconnectGeolocationHub,
      disconnectChatHub: mockDisconnectChatHub,
    })),
  },
}));

// react-query client (its provider module pulls in a dev plugin Jest cannot parse)
jest.mock('@/api/common/api-provider', () => ({
  queryClient: { clear: jest.fn() },
}));

// The module registers clearAllAppData with the auth store's logout at import time.
jest.mock('@/lib/auth/session-cleanup', () => ({
  registerSessionCleanupHandler: jest.fn(),
}));

// Services torn down on every logout
jest.mock('@/services/location', () => ({
  locationService: { stopLocationUpdates: jest.fn() },
}));

jest.mock('@/services/push-notification', () => ({
  pushNotificationService: { unregisterFromPushNotifications: jest.fn() },
}));

jest.mock('@/services/signalr.service', () => ({
  signalRService: { disconnectAll: jest.fn() },
}));

// Stores with their own reset method
// Function declarations: jest.mock factories run at import time, before any const is initialised.
function mockStoreWithMethod(method: string) {
  const fn = jest.fn();
  return { getState: jest.fn(() => ({ [method]: fn })), setState: jest.fn(), __method: fn };
}

jest.mock('@/stores/chat/store', () => ({ useChatStore: mockStoreWithMethod('reset') }));
jest.mock('@/stores/check-in-timers/store', () => ({ useCheckInTimerStore: mockStoreWithMethod('reset') }));
jest.mock('@/stores/records/store', () => ({ useRecordsStore: mockStoreWithMethod('reset') }));
jest.mock('@/stores/records/deployments-store', () => ({ useDeploymentsStore: mockStoreWithMethod('reset') }));
jest.mock('@/stores/weather-alerts/store', () => ({ useWeatherAlertsStore: mockStoreWithMethod('reset') }));
jest.mock('@/stores/call-video-feeds/store', () => ({ useCallVideoFeedStore: mockStoreWithMethod('reset') }));
jest.mock('@/stores/command/board-store', () => ({ useCommandBoardStore: mockStoreWithMethod('clearBoard') }));
jest.mock('@/stores/command/incidents-store', () => ({ useIncidentsStore: mockStoreWithMethod('clear') }));

// Stores reset to the state they were created with
function mockStoreWithInitialState(name: string) {
  return {
    getInitialState: jest.fn(() => ({ initialStateOf: name })),
    setState: jest.fn(),
  };
}

jest.mock('@/stores/command/store', () => ({ useCommandStore: mockStoreWithInitialState('command') }));
jest.mock('@/stores/command/assistant-store', () => ({ useIncidentAssistantStore: mockStoreWithInitialState('assistant') }));
jest.mock('@/stores/operations/store', () => ({ useOperationsStore: mockStoreWithInitialState('operations') }));
jest.mock('@/stores/maps/store', () => ({ useMapsStore: mockStoreWithInitialState('maps') }));
jest.mock('@/stores/pois/store', () => ({ usePoisStore: mockStoreWithInitialState('pois') }));
jest.mock('@/stores/data-protection/store', () => ({ dataProtectionStore: mockStoreWithInitialState('data-protection') }));

import {
  clearAllAppData,
  clearAppStorageItems,
  clearPersistedStorage,
  INITIAL_AUDIO_STREAM_STATE,
  INITIAL_BLUETOOTH_AUDIO_STATE,
  INITIAL_CALLS_STATE,
  INITIAL_CONTACTS_STATE,
  INITIAL_CORE_STATE,
  INITIAL_DISPATCH_STATE,
  INITIAL_FEATURE_FLAGS_STATE,
  INITIAL_LIVEKIT_STATE,
  INITIAL_LOCATION_STATE,
  INITIAL_NOTES_STATE,
  INITIAL_PROTOCOLS_STATE,
  INITIAL_PUSH_NOTIFICATION_MODAL_STATE,
  INITIAL_ROLES_STATE,
  INITIAL_SECURITY_STATE,
  INITIAL_UNITS_STATE,
  resetAllStores,
  teardownServices,
} from '../app-reset.service';

// Captured before beforeEach clears mock history: registration happens once, at import.
const registeredCleanupHandlers = [...jest.requireMock('@/lib/auth/session-cleanup').registerSessionCleanupHandler.mock.calls];

// Get mock references after imports
const mockStorage = jest.requireMock('@/lib/storage').storage;
const mockStorageApp = jest.requireMock('@/lib/storage/app');

// Mock function references for store methods
const mockOfflineQueueClear = jest.fn();
const mockLoadingReset = jest.fn();
const mockAudioCleanup = jest.fn().mockResolvedValue(undefined);
const mockLiveKitDisconnect = jest.fn().mockResolvedValue(undefined);

describe('app-reset.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store mocks with proper implementations
    const { useLiveKitStore } = jest.requireMock('@/stores/app/livekit-store');
    const { useAudioStreamStore } = jest.requireMock('@/stores/app/audio-stream-store');
    const { useLoadingStore } = jest.requireMock('@/stores/app/loading-store');
    const { useOfflineQueueStore } = jest.requireMock('@/stores/offline-queue/store');

    useLiveKitStore.getState.mockReturnValue({
      isConnected: false,
      disconnectFromRoom: mockLiveKitDisconnect,
    });

    useAudioStreamStore.getState.mockReturnValue({
      cleanup: mockAudioCleanup,
    });

    useLoadingStore.getState.mockReturnValue({
      resetLoading: mockLoadingReset,
    });

    useOfflineQueueStore.getState.mockReturnValue({
      clearAllEvents: mockOfflineQueueClear,
    });

  });

  describe('Initial State Constants', () => {
    it('should export INITIAL_CORE_STATE with correct shape', () => {
      expect(INITIAL_CORE_STATE).toEqual({
        activeCallId: null,
        activeCall: null,
        activePriority: null,
        config: null,
        isLoading: false,
        isInitialized: false,
        isInitializing: false,
        error: null,
      });
    });

    it('should export INITIAL_CALLS_STATE with correct shape', () => {
      expect(INITIAL_CALLS_STATE).toEqual({
        calls: [],
        callPriorities: [],
        callTypes: [],
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_UNITS_STATE with correct shape', () => {
      expect(INITIAL_UNITS_STATE).toEqual({
        units: [],
        unitStatuses: [],
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_CONTACTS_STATE with correct shape', () => {
      expect(INITIAL_CONTACTS_STATE).toEqual({
        contacts: [],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        isNotesLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_NOTES_STATE with correct shape', () => {
      expect(INITIAL_NOTES_STATE).toEqual({
        notes: [],
        searchQuery: '',
        selectedNoteId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_ROLES_STATE with correct shape', () => {
      expect(INITIAL_ROLES_STATE).toEqual({
        roles: [],
        unitRoleAssignments: [],
        users: [],
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_PROTOCOLS_STATE with correct shape', () => {
      expect(INITIAL_PROTOCOLS_STATE).toEqual({
        protocols: [],
        searchQuery: '',
        selectedProtocolId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_DISPATCH_STATE with correct shape', () => {
      expect(INITIAL_DISPATCH_STATE).toEqual({
        data: {
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
        selection: {
          everyone: false,
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
        isLoading: false,
        error: null,
        searchQuery: '',
      });
    });

    it('should export INITIAL_SECURITY_STATE with correct shape', () => {
      expect(INITIAL_SECURITY_STATE).toEqual({
        error: null,
        rights: null,
      });
    });

    it('should export INITIAL_FEATURE_FLAGS_STATE with correct shape', () => {
      expect(INITIAL_FEATURE_FLAGS_STATE).toEqual({
        flags: {},
        isLoaded: false,
        error: null,
        identityKey: null,
      });
    });

    it('should export INITIAL_LOCATION_STATE with correct shape', () => {
      expect(INITIAL_LOCATION_STATE).toEqual({
        latitude: null,
        longitude: null,
        heading: null,
        accuracy: null,
        speed: null,
        altitude: null,
        timestamp: null,
      });
    });

    it('should export INITIAL_LIVEKIT_STATE with correct shape', () => {
      expect(INITIAL_LIVEKIT_STATE).toEqual({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isTalking: false,
        availableRooms: [],
        isBottomSheetVisible: false,
      });
    });

    it('should export INITIAL_AUDIO_STREAM_STATE with correct shape', () => {
      expect(INITIAL_AUDIO_STREAM_STATE).toEqual({
        availableStreams: [],
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
        isBottomSheetVisible: false,
      });
    });

    it('should export INITIAL_BLUETOOTH_AUDIO_STATE with correct shape', () => {
      expect(INITIAL_BLUETOOTH_AUDIO_STATE).toEqual({
        connectedDevice: null,
        isScanning: false,
        isConnecting: false,
        availableDevices: [],
        connectionError: null,
        isAudioRoutingActive: false,
      });
    });

    it('should export INITIAL_PUSH_NOTIFICATION_MODAL_STATE with correct shape', () => {
      expect(INITIAL_PUSH_NOTIFICATION_MODAL_STATE).toEqual({
        isOpen: false,
        notification: null,
      });
    });
  });

  describe('clearAppStorageItems', () => {
    it('should call all remove functions', () => {
      clearAppStorageItems();

      expect(mockStorageApp.removeActiveCallId).toHaveBeenCalled();
      expect(mockStorageApp.removeDeviceUuid).toHaveBeenCalled();
    });
  });

  describe('clearPersistedStorage', () => {
    it('should clear all storage keys except preserved ones', () => {
      clearPersistedStorage();

      expect(mockStorage.getAllKeys).toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalledWith('key1');
      expect(mockStorage.delete).toHaveBeenCalledWith('key2');
      expect(mockStorage.delete).not.toHaveBeenCalledWith('IS_FIRST_TIME');
    });

    it('should preserve the selected server URL across logout', () => {
      clearPersistedStorage();

      expect(mockStorage.delete).not.toHaveBeenCalledWith('baseUrl');
    });

    it('keeps a shared device shared for the next operator', () => {
      clearPersistedStorage();

      expect(mockStorage.delete).not.toHaveBeenCalledWith('SHARED_INSTALLATION');
    });
  });

  describe('resetAllStores', () => {
    it('should reset all zustand stores', async () => {
      const { useCoreStore } = jest.requireMock('@/stores/app/core-store');
      const { useCallsStore } = jest.requireMock('@/stores/calls/store');
      const { useUnitsStore } = jest.requireMock('@/stores/units/store');
      const { featureFlagsStore } = jest.requireMock('@/stores/feature-flags/store');
      const { clearMapboxToken } = jest.requireMock('@/lib/mapbox-token');

      await resetAllStores();

      expect(useCoreStore.setState).toHaveBeenCalledWith(INITIAL_CORE_STATE);
      // The previous session's server-supplied Mapbox token must not outlive it.
      expect(clearMapboxToken).toHaveBeenCalled();
      expect(useCallsStore.setState).toHaveBeenCalledWith(INITIAL_CALLS_STATE);
      expect(useUnitsStore.setState).toHaveBeenCalledWith(INITIAL_UNITS_STATE);
      // Logout must clear in-memory flags and identity so the next session fails closed.
      expect(featureFlagsStore.setState).toHaveBeenCalledWith(INITIAL_FEATURE_FLAGS_STATE);
      // Realtime map positions from the previous session must not survive logout.
      expect(mockClearLiveLocations).toHaveBeenCalled();
      expect(mockOfflineQueueClear).toHaveBeenCalled();
      expect(mockLoadingReset).toHaveBeenCalled();
      expect(mockAudioCleanup).toHaveBeenCalled();
    });

    it('should disconnect from LiveKit room if connected', async () => {
      const { useLiveKitStore } = jest.requireMock('@/stores/app/livekit-store');

      useLiveKitStore.getState.mockReturnValue({
        isConnected: true,
        disconnectFromRoom: mockLiveKitDisconnect,
      });

      await resetAllStores();

      expect(mockLiveKitDisconnect).toHaveBeenCalled();
      expect(useLiveKitStore.setState).toHaveBeenCalledWith(INITIAL_LIVEKIT_STATE);
    });

    it('should not disconnect from LiveKit room if not connected', async () => {
      const { useLiveKitStore } = jest.requireMock('@/stores/app/livekit-store');
      const localMockDisconnect = jest.fn().mockResolvedValue(undefined);

      useLiveKitStore.getState.mockReturnValue({
        isConnected: false,
        disconnectFromRoom: localMockDisconnect,
      });

      await resetAllStores();

      expect(localMockDisconnect).not.toHaveBeenCalled();
      expect(useLiveKitStore.setState).toHaveBeenCalledWith(INITIAL_LIVEKIT_STATE);
    });
  });

  describe('clearAllAppData', () => {
    it('should call all clearing functions in sequence', async () => {
      await clearAllAppData();

      // Should clear app storage items
      expect(mockStorageApp.removeActiveCallId).toHaveBeenCalled();
      expect(mockStorageApp.removeDeviceUuid).toHaveBeenCalled();

      // Should clear persisted storage
      expect(mockStorage.getAllKeys).toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalled();
    });

    it('should throw error if clearing fails', async () => {
      const { useAudioStreamStore } = jest.requireMock('@/stores/app/audio-stream-store');
      const error = new Error('Cleanup failed');

      useAudioStreamStore.getState.mockReturnValue({
        cleanup: jest.fn().mockRejectedValue(error),
      });

      // The cleanup error is caught and logged within resetAllStores, 
      // so clearAllAppData should complete without throwing
      await expect(clearAllAppData()).resolves.toBeUndefined();
    });

    it('tears down live services before wiping storage, then drops the react-query cache', async () => {
      const { signalRService } = jest.requireMock('@/services/signalr.service');
      const { queryClient } = jest.requireMock('@/api/common/api-provider');

      await clearAllAppData();

      // Nothing may keep writing into storage while it is being cleared.
      expect(signalRService.disconnectAll.mock.invocationCallOrder[0]).toBeLessThan(mockStorage.getAllKeys.mock.invocationCallOrder[0]);
      expect(queryClient.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetAllStores (session-scoped stores)', () => {
    it.each([
      ['@/stores/chat/store', 'useChatStore'],
      ['@/stores/check-in-timers/store', 'useCheckInTimerStore'],
      ['@/stores/records/store', 'useRecordsStore'],
      ['@/stores/records/deployments-store', 'useDeploymentsStore'],
      ['@/stores/weather-alerts/store', 'useWeatherAlertsStore'],
      ['@/stores/call-video-feeds/store', 'useCallVideoFeedStore'],
      ['@/stores/command/board-store', 'useCommandBoardStore'],
      ['@/stores/command/incidents-store', 'useIncidentsStore'],
    ])('runs the reset of %s', async (modulePath, exportName) => {
      const store = jest.requireMock(modulePath)[exportName];

      await resetAllStores();

      expect(store.__method).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['@/stores/command/store', 'useCommandStore'],
      ['@/stores/command/assistant-store', 'useIncidentAssistantStore'],
      ['@/stores/operations/store', 'useOperationsStore'],
      ['@/stores/maps/store', 'useMapsStore'],
      ['@/stores/pois/store', 'usePoisStore'],
      ['@/stores/data-protection/store', 'dataProtectionStore'],
    ])('replaces %s with the state it was created with', async (modulePath, exportName) => {
      const store = jest.requireMock(modulePath)[exportName];

      await resetAllStores();

      expect(store.setState).toHaveBeenCalledWith(store.getInitialState(), true);
    });
  });

  describe('teardownServices', () => {
    it('disconnects every hub, stops location and clears local push state', async () => {
      const { signalRService } = jest.requireMock('@/services/signalr.service');
      const { locationService } = jest.requireMock('@/services/location');
      const { pushNotificationService } = jest.requireMock('@/services/push-notification');
      const { useSignalRStore } = jest.requireMock('@/stores/signalr/signalr-store');

      await teardownServices();

      expect(mockDisconnectUpdateHub).toHaveBeenCalledTimes(1);
      expect(mockDisconnectGeolocationHub).toHaveBeenCalledTimes(1);
      expect(mockDisconnectChatHub).toHaveBeenCalledTimes(1);
      expect(signalRService.disconnectAll).toHaveBeenCalledTimes(1);
      expect(useSignalRStore.setState).toHaveBeenCalledWith(expect.objectContaining({ isUpdateHubConnected: false, isGeolocationHubConnected: false, isChatHubConnected: false, liveLocations: {} }));
      expect(locationService.stopLocationUpdates).toHaveBeenCalledTimes(1);
      expect(pushNotificationService.unregisterFromPushNotifications).toHaveBeenCalledTimes(1);
    });

    it('keeps tearing down when one step fails', async () => {
      const { signalRService } = jest.requireMock('@/services/signalr.service');
      const { locationService } = jest.requireMock('@/services/location');
      const { pushNotificationService } = jest.requireMock('@/services/push-notification');
      mockDisconnectUpdateHub.mockRejectedValueOnce(new Error('hub gone'));
      signalRService.disconnectAll.mockRejectedValueOnce(new Error('socket error'));
      locationService.stopLocationUpdates.mockRejectedValueOnce(new Error('no permission'));

      await expect(teardownServices()).resolves.toBeUndefined();

      expect(mockDisconnectChatHub).toHaveBeenCalledTimes(1);
      expect(pushNotificationService.unregisterFromPushNotifications).toHaveBeenCalledTimes(1);
    });

    it('skips push cleanup on platforms whose push service has no local state', async () => {
      const { pushNotificationService } = jest.requireMock('@/services/push-notification');
      const unregister = pushNotificationService.unregisterFromPushNotifications;
      delete pushNotificationService.unregisterFromPushNotifications;

      try {
        await expect(teardownServices()).resolves.toBeUndefined();
      } finally {
        pushNotificationService.unregisterFromPushNotifications = unregister;
      }
    });
  });

  describe('session cleanup registration', () => {
    it('registers clearAllAppData as the handler every logout runs', () => {
      expect(registeredCleanupHandlers).toEqual([[clearAllAppData]]);
    });
  });
});
