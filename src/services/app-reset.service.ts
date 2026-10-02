/**
 * App Reset Service
 *
 * This service provides a centralized way to clear all app data,
 * reset stores, and clean up resources when the user logs out.
 * It's designed to be reusable and testable.
 */

import { queryClient } from '@/api/common/api-provider';
import { registerSessionCleanupHandler } from '@/lib/auth/session-cleanup';
import { logger } from '@/lib/logging';
import { SHARED_INSTALLATION_STORAGE_KEY } from '@/lib/mfa/shared-installation';
import { storage } from '@/lib/storage';
import { BASE_API_URL_STORAGE_KEY, removeActiveCallId, removeDeviceUuid } from '@/lib/storage/app';
import { locationService } from '@/services/location';
import { pushNotificationService } from '@/services/push-notification';
import { signalRService } from '@/services/signalr.service';
import { useAudioStreamStore } from '@/stores/app/audio-stream-store';
import { INITIAL_STATE as BLUETOOTH_INITIAL_STATE, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import { useCoreStore } from '@/stores/app/core-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';
import { useLoadingStore } from '@/stores/app/loading-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useCallVideoFeedStore } from '@/stores/call-video-feeds/store';
import { useCallsStore } from '@/stores/calls/store';
import { useChatStore } from '@/stores/chat/store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { useIncidentAssistantStore } from '@/stores/command/assistant-store';
import { useCommandBoardStore } from '@/stores/command/board-store';
import { useIncidentsStore } from '@/stores/command/incidents-store';
import { useCommandStore } from '@/stores/command/store';
import { useContactsStore } from '@/stores/contacts/store';
import { dataProtectionStore } from '@/stores/data-protection/store';
import { useDispatchStore } from '@/stores/dispatch/store';
import { featureFlagsStore } from '@/stores/feature-flags/store';
import { useMapsStore } from '@/stores/maps/store';
import { useNotesStore } from '@/stores/notes/store';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { useOperationsStore } from '@/stores/operations/store';
import { usePoisStore } from '@/stores/pois/store';
import { useProtocolsStore } from '@/stores/protocols/store';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';
import { useDeploymentsStore } from '@/stores/records/deployments-store';
import { useRecordsStore } from '@/stores/records/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';
import { useUnitsStore } from '@/stores/units/store';
import { useWeatherAlertsStore } from '@/stores/weather-alerts/store';

// ============================================================================
// Initial State Constants
// These can be imported and used by stores or tests
// ============================================================================

export const INITIAL_CORE_STATE = {
  activeCallId: null,
  activeCall: null,
  activePriority: null,
  config: null,
  isLoading: false,
  isInitialized: false,
  isInitializing: false,
  error: null,
};

export const INITIAL_CALLS_STATE = {
  calls: [] as never[],
  callPriorities: [] as never[],
  callTypes: [] as never[],
  isLoading: false,
  error: null,
};

export const INITIAL_UNITS_STATE = {
  units: [] as never[],
  unitStatuses: [] as never[],
  isLoading: false,
  error: null,
};

export const INITIAL_CONTACTS_STATE = {
  contacts: [] as never[],
  contactNotes: {},
  searchQuery: '',
  selectedContactId: null,
  isDetailsOpen: false,
  isLoading: false,
  isNotesLoading: false,
  error: null,
};

export const INITIAL_NOTES_STATE = {
  notes: [] as never[],
  searchQuery: '',
  selectedNoteId: null,
  isDetailsOpen: false,
  isLoading: false,
  error: null,
};

export const INITIAL_ROLES_STATE = {
  roles: [] as never[],
  unitRoleAssignments: [] as never[],
  users: [] as never[],
  isLoading: false,
  error: null,
};

export const INITIAL_PROTOCOLS_STATE = {
  protocols: [] as never[],
  searchQuery: '',
  selectedProtocolId: null,
  isDetailsOpen: false,
  isLoading: false,
  error: null,
};

export const INITIAL_DISPATCH_STATE = {
  data: {
    users: [] as never[],
    groups: [] as never[],
    roles: [] as never[],
    units: [] as never[],
  },
  selection: {
    everyone: false,
    users: [] as string[],
    groups: [] as string[],
    roles: [] as string[],
    units: [] as string[],
  },
  isLoading: false,
  error: null,
  searchQuery: '',
};

export const INITIAL_SECURITY_STATE = {
  error: null,
  rights: null,
};

// Logout clears MMKV but not in-memory zustand state; reset here so the next session starts
// unknown and fails closed until fetchFlags resolves, instead of gating on the old identity's flags.
export const INITIAL_FEATURE_FLAGS_STATE = {
  flags: {},
  isLoaded: false,
  error: null,
  identityKey: null,
};

export const INITIAL_LOCATION_STATE = {
  latitude: null,
  longitude: null,
  heading: null,
  accuracy: null,
  speed: null,
  altitude: null,
  timestamp: null,
};

export const INITIAL_LIVEKIT_STATE = {
  isConnected: false,
  isConnecting: false,
  currentRoom: null,
  currentRoomInfo: null,
  isTalking: false,
  availableRooms: [] as never[],
  isBottomSheetVisible: false,
};

export const INITIAL_AUDIO_STREAM_STATE = {
  availableStreams: [] as never[],
  currentStream: null,
  isPlaying: false,
  isLoading: false,
  isBuffering: false,
  isBottomSheetVisible: false,
};

export const INITIAL_BLUETOOTH_AUDIO_STATE = BLUETOOTH_INITIAL_STATE;

export const INITIAL_PUSH_NOTIFICATION_MODAL_STATE = {
  isOpen: false,
  notification: null,
};

// Keys to preserve during storage clear. The selected server URL is an install-level
// preference: wiping it on logout would silently send the next sign-in to the default server.
// A shared command device stays shared across operators: signing out is exactly when the next one signs in.
const STORAGE_KEYS_TO_PRESERVE = ['IS_FIRST_TIME', BASE_API_URL_STORAGE_KEY, SHARED_INSTALLATION_STORAGE_KEY];

/**
 * Clears all persisted storage items except those in the preserve list
 */
export const clearPersistedStorage = (): void => {
  const allKeys = storage.getAllKeys();
  allKeys.forEach((key) => {
    if (!STORAGE_KEYS_TO_PRESERVE.includes(key)) {
      storage.delete(key);
    }
  });
};

/**
 * Clears app-specific storage items (active call, device UUID)
 */
export const clearAppStorageItems = (): void => {
  removeActiveCallId();
  removeDeviceUuid();
};

/** Returns a store with no reset method of its own to the state it was created with. */
const resetToInitialState = <T>(store: { getInitialState: () => T; setState: (state: T, replace: true) => void }): void => {
  store.setState(store.getInitialState(), true);
};

/**
 * Resets all zustand stores to their initial states
 * Uses existing reset methods where available
 */
export const resetAllStores = async (): Promise<void> => {
  // Core stores - use setState with initial state constants
  useCoreStore.setState(INITIAL_CORE_STATE);
  useCallsStore.setState(INITIAL_CALLS_STATE);
  useUnitsStore.setState(INITIAL_UNITS_STATE);
  useContactsStore.setState(INITIAL_CONTACTS_STATE);
  useNotesStore.setState(INITIAL_NOTES_STATE);
  useRolesStore.setState(INITIAL_ROLES_STATE);
  useProtocolsStore.setState(INITIAL_PROTOCOLS_STATE);
  useDispatchStore.setState(INITIAL_DISPATCH_STATE);
  securityStore.setState(INITIAL_SECURITY_STATE);
  featureFlagsStore.setState(INITIAL_FEATURE_FLAGS_STATE);

  // Realtime map positions belong to the previous session's department.
  useSignalRStore.getState().clearLiveLocations();

  // Stores with existing reset/clear methods
  useOfflineQueueStore.getState().clearAllEvents();
  useLoadingStore.getState().resetLoading();

  // Location store - only reset location data, preserve settings
  useLocationStore.setState(INITIAL_LOCATION_STATE);

  // LiveKit store - await async disconnect, then reset
  const liveKitState = useLiveKitStore.getState();
  if (liveKitState.isConnected) {
    try {
      await liveKitState.disconnectFromRoom();
    } catch (error) {
      logger.error({
        message: 'Error disconnecting from LiveKit room during reset',
        context: { error },
      });
    }
  }
  useLiveKitStore.setState(INITIAL_LIVEKIT_STATE);

  // Audio stream store - await async cleanup, then reset
  const audioStreamState = useAudioStreamStore.getState();
  try {
    await audioStreamState.cleanup();
  } catch (error) {
    logger.error({
      message: 'Error cleaning up audio stream during reset',
      context: { error },
    });
  }
  useAudioStreamStore.setState(INITIAL_AUDIO_STREAM_STATE);

  // Bluetooth audio store - reset
  useBluetoothAudioStore.setState(INITIAL_BLUETOOTH_AUDIO_STATE);

  // Push notification modal store - reset
  usePushNotificationModalStore.setState(INITIAL_PUSH_NOTIFICATION_MODAL_STATE);

  // Stores with their own reset: clearPersistedStorage() wipes what they persisted, but the in-memory
  // copies would otherwise be written back on the next change under the next user's sign-in.
  // Check-in timers also stop the polling interval that would keep fetching the old call's timers.
  useChatStore.getState().reset();
  useCheckInTimerStore.getState().reset();
  useRecordsStore.getState().reset();
  useDeploymentsStore.getState().reset();
  useWeatherAlertsStore.getState().reset();
  useCallVideoFeedStore.getState().reset();
  useCommandBoardStore.getState().clearBoard();
  useIncidentsStore.getState().clear();

  // Stores with no reset of their own go back to the state they were created with (for persisted
  // stores, the pre-hydration state): the incident command board and its assistant history, time
  // reports, maps, POIs, and the ADP capability/grant (whose own sweep only runs from 'signedIn').
  resetToInitialState(useCommandStore);
  resetToInitialState(useIncidentAssistantStore);
  resetToInitialState(useOperationsStore);
  resetToInitialState(useMapsStore);
  resetToInitialState(usePoisStore);
  resetToInitialState(dataProtectionStore);
};

/**
 * Tears down live services and realtime connections. MUST run on every logout path — otherwise the
 * previous user's hub connections keep receiving events, location keeps reporting, and delivered
 * notifications for the previous user stay on the device.
 */
export const teardownServices = async (): Promise<void> => {
  // SignalR: the store-level disconnects also unregister handlers and stop heartbeat/rejoin timers.
  const signalR = useSignalRStore.getState();
  for (const disconnect of [signalR.disconnectUpdateHub, signalR.disconnectGeolocationHub, signalR.disconnectChatHub]) {
    try {
      await disconnect();
    } catch (error) {
      logger.error({
        message: 'Error disconnecting a SignalR hub during reset',
        context: { error },
      });
    }
  }

  // Backstop for any other hub the service still holds.
  try {
    await signalRService.disconnectAll();
  } catch (error) {
    logger.error({
      message: 'Error disconnecting SignalR hubs during reset',
      context: { error },
    });
  }
  useSignalRStore.setState({
    isUpdateHubConnected: false,
    isGeolocationHubConnected: false,
    isChatHubConnected: false,
    lastUpdateMessage: null,
    lastUpdateTimestamp: 0,
    lastGeolocationJoinAt: 0,
    liveLocations: {},
    error: null,
  });

  // Location tracking: stop updates (battery + privacy).
  try {
    await locationService.stopLocationUpdates();
  } catch (error) {
    logger.error({
      message: 'Error stopping location updates during reset',
      context: { error },
    });
  }

  // Push notifications: clear the local token, badge and delivered notifications. Only the native
  // service has the method; the web/Electron variants have no device state to clear.
  try {
    const unregister = (pushNotificationService as { unregisterFromPushNotifications?: () => Promise<void> }).unregisterFromPushNotifications;
    if (unregister) {
      await unregister.call(pushNotificationService);
    }
  } catch (error) {
    logger.error({
      message: 'Error clearing push notification state during reset',
      context: { error },
    });
  }
};

/**
 * Clears all app data, cached values, settings, and stores.
 * This runs on EVERY logout path through the session-cleanup registry.
 *
 * @returns Promise that resolves when all data has been cleared
 */
export const clearAllAppData = async (): Promise<void> => {
  logger.info({
    message: 'Clearing all app data on logout',
  });

  try {
    // Tear down realtime connections and background services first so nothing keeps writing into
    // stores while they are being reset.
    await teardownServices();

    // Clear persisted storage items
    clearAppStorageItems();

    // Clear all MMKV storage except preserved keys
    clearPersistedStorage();

    // Reset all zustand stores to their initial states
    await resetAllStores();

    // Drop all react-query cached data — query keys are not user-scoped.
    queryClient.clear();

    logger.info({
      message: 'Successfully cleared all app data',
    });
  } catch (error) {
    logger.error({
      message: 'Error clearing app data on logout',
      context: { error },
    });
    // Re-throw to allow calling code to handle if needed
    throw error;
  }
};

// Every logout path (the auth store's logout) runs clearAllAppData through this registration. The root
// layout imports this module for its side effect so the handler is in place before anyone can sign out.
registerSessionCleanupHandler(clearAllAppData);

export default {
  clearAllAppData,
  clearAppStorageItems,
  clearPersistedStorage,
  resetAllStores,
  teardownServices,
  // Export initial states for testing and external use
  INITIAL_CORE_STATE,
  INITIAL_CALLS_STATE,
  INITIAL_UNITS_STATE,
  INITIAL_CONTACTS_STATE,
  INITIAL_NOTES_STATE,
  INITIAL_ROLES_STATE,
  INITIAL_PROTOCOLS_STATE,
  INITIAL_DISPATCH_STATE,
  INITIAL_SECURITY_STATE,
  INITIAL_FEATURE_FLAGS_STATE,
  INITIAL_LOCATION_STATE,
  INITIAL_LIVEKIT_STATE,
  INITIAL_AUDIO_STREAM_STATE,
  INITIAL_BLUETOOTH_AUDIO_STATE,
  INITIAL_PUSH_NOTIFICATION_MODAL_STATE,
};
