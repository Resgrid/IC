import { create } from 'zustand';

import { useAuthStore } from '@/lib';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { signalRService } from '@/services/signalr.service';

import { useCoreStore } from '../app/core-store';
import { useChatStore } from '../chat/store';
import { useCommandStore } from '../command/store';
import { securityStore, useSecurityStore } from '../security/store';
import { useWeatherAlertsStore } from '../weather-alerts/store';

/** Client-event method names raised by the chat SignalR hub. */
const CHAT_HUB_METHODS = [
  'chatMessageReceived',
  'chatMessageEdited',
  'chatMessageDeleted',
  'chatReactionUpdated',
  'chatReceiptUpdated',
  'chatChannelUpdated',
  'chatChannelProvisioned',
  'chatModerationApplied',
  'chatMessageAckRequired',
  'chatThreadUpdated',
  'chatbotMessageReceived',
  'chatbotTyping',
  'chatTyping',
  'chatPresenceChanged',
  'onChatConnected',
];

// Track registered chat handlers for cleanup and the heartbeat timer.
const chatHubHandlers: Record<string, ((data: unknown) => void) | null> = {};
let chatHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
const CHAT_HEARTBEAT_INTERVAL_MS = 45000;

function unregisterChatHubHandlers(): void {
  Object.keys(chatHubHandlers).forEach((event) => {
    const handler = chatHubHandlers[event];
    if (handler) {
      signalRService.off(event, handler);
      chatHubHandlers[event] = null;
    }
  });
}

function stopChatHeartbeat(): void {
  if (chatHeartbeatTimer) {
    clearInterval(chatHeartbeatTimer);
    chatHeartbeatTimer = null;
  }
}

/** Minimal shape of the SignalR weather alert payload. The server sends
 *  WeatherAlertId as the primary identifier, matching WeatherAlertResultData. */
interface WeatherAlertSignalRMessage {
  WeatherAlertId?: string;
  /** Fallback for servers that use a lower-camel field name. */
  alertId?: string;
}

function extractAlertId(message: unknown): string | undefined {
  if (message !== null && typeof message === 'object') {
    const m = message as WeatherAlertSignalRMessage;
    return m.WeatherAlertId ?? m.alertId;
  }
  return undefined;
}

/** Minimal shape of the incidentCommandUpdated payload — server identifies the
 *  affected incident by call (PascalCase or lower-camel). */
interface IncidentCommandSignalRMessage {
  CallId?: string;
  callId?: string;
}

function extractCommandCallId(message: unknown): string | undefined {
  if (message !== null && typeof message === 'object') {
    const m = message as IncidentCommandSignalRMessage;
    const id = m.CallId ?? m.callId;
    return id !== undefined && id !== null ? String(id) : undefined;
  }
  return undefined;
}

/** Per-callId board refresh coalescing: one refresh in flight at a time; an event arriving
 *  mid-refresh marks the entry dirty and triggers exactly one follow-up refresh. */
const boardRefreshState = new Map<string, { inFlight: boolean; dirty: boolean }>();

function coalescedRefreshBoard(callId: string): void {
  const state = boardRefreshState.get(callId) ?? { inFlight: false, dirty: false };
  if (state.inFlight) {
    state.dirty = true;
    boardRefreshState.set(callId, state);
    return;
  }
  state.inFlight = true;
  boardRefreshState.set(callId, state);
  useCommandStore
    .getState()
    .refreshBoard(callId)
    .catch((error) => {
      logger.warn({ message: 'incidentCommandUpdated: failed to refresh board', context: { callId, error } });
    })
    .finally(() => {
      const current = boardRefreshState.get(callId);
      if (current?.dirty) {
        boardRefreshState.set(callId, { inFlight: false, dirty: false });
        coalescedRefreshBoard(callId);
      } else {
        boardRefreshState.delete(callId);
      }
    });
}

/** Trailing debounce so a burst of department-wide incidentCommandUpdated events
 *  (unknown/untracked incidents) collapses into a single full sync. Syncs are
 *  serialized: an event arriving mid-sync marks dirty and runs one follow-up. */
let incidentCommandResyncTimer: ReturnType<typeof setTimeout> | null = null;
let fullSyncInFlight = false;
let fullSyncDirty = false;

function runFullSync(): void {
  fullSyncInFlight = true;
  useCommandStore
    .getState()
    .syncFromServer()
    .catch((error) => {
      logger.warn({ message: 'incidentCommandUpdated: failed to sync from server', context: { error } });
    })
    .finally(() => {
      fullSyncInFlight = false;
      if (fullSyncDirty) {
        fullSyncDirty = false;
        runFullSync();
      }
    });
}

function debouncedFullSync(): void {
  if (fullSyncInFlight) {
    fullSyncDirty = true;
    return;
  }
  if (incidentCommandResyncTimer) {
    clearTimeout(incidentCommandResyncTimer);
  }
  incidentCommandResyncTimer = setTimeout(() => {
    incidentCommandResyncTimer = null;
    if (fullSyncInFlight) {
      fullSyncDirty = true;
      return;
    }
    runFullSync();
  }, 2000);
}

interface SignalRState {
  isUpdateHubConnected: boolean;
  lastUpdateMessage: unknown;
  lastUpdateTimestamp: number;
  isGeolocationHubConnected: boolean;
  lastGeolocationMessage: unknown;
  lastGeolocationTimestamp: number;
  isChatHubConnected: boolean;
  error: Error | null;
  connectUpdateHub: () => Promise<void>;
  disconnectUpdateHub: () => Promise<void>;
  connectGeolocationHub: () => Promise<void>;
  disconnectGeolocationHub: () => Promise<void>;
  connectChatHub: () => Promise<void>;
  disconnectChatHub: () => Promise<void>;
}

export const useSignalRStore = create<SignalRState>((set, get) => ({
  isUpdateHubConnected: false,
  lastUpdateMessage: null,
  lastUpdateTimestamp: 0,
  isGeolocationHubConnected: false,
  lastGeolocationMessage: null,
  lastGeolocationTimestamp: 0,
  isChatHubConnected: false,
  error: null,
  connectUpdateHub: async () => {
    try {
      if (get().isUpdateHubConnected) {
        return;
      }

      set({ isUpdateHubConnected: false, error: null });

      // Get the eventing URL from the core store config
      const coreState = useCoreStore.getState();
      const eventingUrl = coreState.config?.EventingUrl;

      if (!eventingUrl) {
        const errorMessage = 'EventingUrl not available in config. Please ensure config is loaded first.';
        logger.error({
          message: errorMessage,
        });
        set({ error: new Error(errorMessage) });
        return;
      }

      // Remove any previously registered handlers to prevent accumulation
      // across reconnections or repeated connectUpdateHub calls
      const updateEvents = [
        'personnelStatusUpdated',
        'personnelStaffingUpdated',
        'unitStatusUpdated',
        'callsUpdated',
        'callAdded',
        'callClosed',
        'weatherAlertReceived',
        'weatherAlertUpdated',
        'weatherAlertExpired',
        'incidentCommandUpdated',
        'onConnected',
      ];
      updateEvents.forEach((event) => signalRService.removeAllListeners(event));

      // Connect to the eventing hub
      await signalRService.connectToHubWithEventingUrl({
        name: Env.CHANNEL_HUB_NAME,
        eventingUrl: eventingUrl,
        hubName: Env.CHANNEL_HUB_NAME,
        methods: [
          'personnelStatusUpdated',
          'personnelStaffingUpdated',
          'unitStatusUpdated',
          'callsUpdated',
          'callAdded',
          'callClosed',
          'weatherAlertReceived',
          'weatherAlertUpdated',
          'weatherAlertExpired',
          'incidentCommandUpdated',
          'onConnected',
        ],
      });

      await signalRService.invoke(Env.CHANNEL_HUB_NAME, 'connect', parseInt(securityStore.getState().rights?.DepartmentId ?? '0'));

      signalRService.on('personnelStatusUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('personnelStaffingUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('unitStatusUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('callsUpdated', (message) => {
        const now = Date.now();
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: now });
      });

      signalRService.on('callAdded', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('callClosed', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('weatherAlertReceived', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
        const alertId = extractAlertId(message);
        if (alertId) {
          useWeatherAlertsStore.getState().handleAlertReceived(alertId);
        } else {
          logger.warn({ message: 'weatherAlertReceived: could not extract alertId from message', context: { message } });
        }
      });

      signalRService.on('weatherAlertUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
        const alertId = extractAlertId(message);
        if (alertId) {
          useWeatherAlertsStore.getState().handleAlertUpdated(alertId);
        } else {
          logger.warn({ message: 'weatherAlertUpdated: could not extract alertId from message', context: { message } });
        }
      });

      signalRService.on('weatherAlertExpired', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
        const alertId = extractAlertId(message);
        if (alertId) {
          useWeatherAlertsStore.getState().handleAlertExpired(alertId);
        } else {
          logger.warn({ message: 'weatherAlertExpired: could not extract alertId from message', context: { message } });
        }
      });

      signalRService.on('incidentCommandUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
        const callId = extractCommandCallId(message);
        const commandState = useCommandStore.getState();
        if (callId && commandState.boards[callId]) {
          coalescedRefreshBoard(callId);
        } else {
          // Unknown or untracked incident — resync the full bundle (debounced).
          debouncedFullSync();
        }
      });

      signalRService.on('onConnected', () => {
        logger.info({
          message: 'Connected to update SignalR hub',
        });
        set({ isUpdateHubConnected: true, error: null });
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.warn({
        message: 'Failed to connect to SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  disconnectUpdateHub: async () => {
    try {
      await signalRService.disconnectFromHub(Env.CHANNEL_HUB_NAME);
      set({ isUpdateHubConnected: false, lastUpdateMessage: null });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.warn({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  connectGeolocationHub: async () => {
    try {
      if (get().isGeolocationHubConnected) {
        return;
      }

      set({ isGeolocationHubConnected: false, error: null });

      // Get the eventing URL from the core store config
      const coreState = useCoreStore.getState();
      const eventingUrl = coreState.config?.EventingUrl;

      if (!eventingUrl) {
        const errorMessage = 'EventingUrl not available in config. Please ensure config is loaded first.';
        logger.error({
          message: errorMessage,
        });
        set({ error: new Error(errorMessage) });
        return;
      }

      // Remove any previously registered handlers to prevent accumulation
      const geoEvents = ['onPersonnelLocationUpdated', 'onUnitLocationUpdated', 'onGeolocationConnect'];
      geoEvents.forEach((event) => signalRService.removeAllListeners(event));

      // Connect to the geolocation hub
      await signalRService.connectToHubWithEventingUrl({
        name: Env.REALTIME_GEO_HUB_NAME,
        eventingUrl: eventingUrl,
        hubName: Env.REALTIME_GEO_HUB_NAME,
        methods: ['onPersonnelLocationUpdated', 'onUnitLocationUpdated', 'onGeolocationConnect'],
      });

      // Set up message handler
      signalRService.on('onPersonnelLocationUpdated', (message) => {
        set({ lastGeolocationMessage: JSON.stringify(message), lastGeolocationTimestamp: Date.now() });
      });

      signalRService.on('onUnitLocationUpdated', (message) => {
        set({ lastGeolocationMessage: JSON.stringify(message), lastGeolocationTimestamp: Date.now() });
      });

      signalRService.on('onGeolocationConnect', () => {
        logger.info({
          message: 'Connected to geolocation SignalR hub',
        });
        set({ isGeolocationHubConnected: true, error: null });
      });

      // Join the department group — without this the server never sends
      // onUnitLocationUpdated / onPersonnelLocationUpdated to this client.
      try {
        await signalRService.invoke(Env.REALTIME_GEO_HUB_NAME, 'GeolocationConnect');
      } catch (invokeError) {
        logger.warn({
          message: 'Failed to join geolocation department group',
          context: { error: invokeError },
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.warn({
        message: 'Failed to connect to SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  disconnectGeolocationHub: async () => {
    try {
      await signalRService.disconnectFromHub(Env.REALTIME_GEO_HUB_NAME);
      set({ isGeolocationHubConnected: false, lastGeolocationMessage: null });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.warn({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  connectChatHub: async () => {
    try {
      if (get().isChatHubConnected) {
        return;
      }

      const eventingUrl = useCoreStore.getState().config?.EventingUrl;
      if (!eventingUrl) {
        logger.warn({ message: 'EventingUrl not available for chat hub, skipping connection' });
        return;
      }

      // Ensure any previous handlers are cleaned up before registering new ones.
      unregisterChatHubHandlers();

      await signalRService.connectToHubWithEventingUrl({
        name: Env.CHAT_HUB_NAME,
        eventingUrl: eventingUrl,
        hubName: Env.CHAT_HUB_NAME,
        methods: CHAT_HUB_METHODS,
      });

      const chat = useChatStore.getState();
      const handlerMap: Record<string, (raw: unknown) => void> = {
        chatMessageReceived: chat.handleMessageReceived,
        chatMessageEdited: chat.handleMessageEdited,
        chatMessageDeleted: chat.handleMessageDeleted,
        chatReactionUpdated: chat.handleReactionUpdated,
        chatReceiptUpdated: chat.handleReceiptUpdated,
        chatChannelUpdated: chat.handleChannelUpdated,
        chatChannelProvisioned: chat.handleChannelProvisioned,
        chatModerationApplied: chat.handleModerationApplied,
        chatMessageAckRequired: chat.handleAckRequired,
        chatThreadUpdated: chat.handleThreadUpdated,
        chatbotMessageReceived: chat.handleChatbotMessageReceived,
        chatbotTyping: chat.handleChatbotTyping,
        chatTyping: chat.handleTyping,
        chatPresenceChanged: chat.handlePresenceChanged,
      };

      Object.entries(handlerMap).forEach(([event, handler]) => {
        const wrapped = (data: unknown) => handler(data);
        chatHubHandlers[event] = wrapped;
        signalRService.on(event, wrapped);
      });

      const onChatConnected = () => {
        logger.info({ message: 'Connected to chat SignalR hub' });
        set({ isChatHubConnected: true, error: null });
        useChatStore.getState().handleChatConnected();
      };
      chatHubHandlers.onChatConnected = onChatConnected;
      signalRService.on('onChatConnected', onChatConnected);

      // Announce chat presence to the hub, then begin the periodic heartbeat.
      await signalRService.invoke(Env.CHAT_HUB_NAME, 'Connect');
      set({ isChatHubConnected: true });

      stopChatHeartbeat();
      chatHeartbeatTimer = setInterval(() => {
        signalRService.invoke(Env.CHAT_HUB_NAME, 'Heartbeat').catch(() => {
          // Heartbeat is best-effort; ignore transient failures.
        });
      }, CHAT_HEARTBEAT_INTERVAL_MS);

      logger.info({ message: 'Chat hub handlers registered successfully' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({ message: 'Failed to connect to chat SignalR hub', context: { error: err } });
      set({ error: err });
    }
  },
  disconnectChatHub: async () => {
    try {
      stopChatHeartbeat();
      unregisterChatHubHandlers();
      await signalRService.disconnectFromHub(Env.CHAT_HUB_NAME);
      set({ isChatHubConnected: false });
      logger.info({ message: 'Chat hub disconnected and handlers cleaned up' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({ message: 'Failed to disconnect from chat SignalR hub', context: { error: err } });
      set({ error: err });
    }
  },
}));
