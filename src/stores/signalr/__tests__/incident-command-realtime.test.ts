/**
 * Board-to-board realtime: when any user on the incident (Staging, Ops, Dispatch) changes the board,
 * Core writes a command log entry, which pushes `incidentCommandUpdated` to the department group.
 *
 * The eventing worker sends the call id as a BARE STRING — `SendAsync("incidentCommandUpdated", id)`
 * with `ItemId = CallId.ToString()` — so the payload must be read as a string, not only as an object.
 * When it was read as an object only, every real event missed the targeted refresh and fell through to
 * the debounced full-bundle sync: the board still caught up, but seconds later and after re-fetching
 * every open incident. These pin the parsing and the routing that follows from it.
 *
 * Every factory below is self-contained — a factory that closes over a module-level const runs before
 * that const is initialised and silently yields undefined.
 */
jest.mock('@/services/signalr.service', () => {
  const mockInstance = {
    connectToHubWithEventingUrl: jest.fn().mockResolvedValue(undefined),
    disconnectFromHub: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    connectToHub: jest.fn().mockResolvedValue(undefined),
    disconnectAll: jest.fn().mockResolvedValue(undefined),
  };
  class MockSignalRService {
    static readonly HUB_DISCONNECTED_EVENT = '__hubDisconnected';
    static readonly HUB_RECONNECTED_EVENT = '__hubReconnected';
  }
  return { signalRService: mockInstance, SignalRService: MockSignalRService, default: mockInstance };
});

jest.mock('../../app/core-store', () => {
  const state = { config: { EventingUrl: 'https://eventing.example.com/' } };
  const store = () => state;
  store.getState = () => state;
  store.subscribe = jest.fn();
  store.setState = jest.fn();
  return { useCoreStore: store };
});

jest.mock('../../security/store', () => {
  const state = { rights: { DepartmentId: '123' } };
  const store = { getState: () => state };
  return { securityStore: store, useSecurityStore: store };
});

jest.mock('../../command/store', () => {
  const state = {
    boards: {} as Record<string, unknown>,
    refreshBoard: jest.fn(() => Promise.resolve()),
    syncFromServer: jest.fn(() => Promise.resolve()),
  };
  return { useCommandStore: { getState: () => state, __state: state } };
});

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() },
}));

jest.mock('@/lib/env', () => ({
  Env: { CHANNEL_HUB_NAME: 'eventingHub', REALTIME_GEO_HUB_NAME: 'geolocationHub' },
}));

jest.mock('@/lib', () => ({
  useAuthStore: { getState: jest.fn(() => ({ accessToken: 'mock-token' })) },
}));

import { signalRService } from '@/services/signalr.service';

import { useSignalRStore } from '../signalr-store';

interface CommandStoreMock {
  useCommandStore: {
    __state: {
      boards: Record<string, unknown>;
      refreshBoard: jest.Mock;
      syncFromServer: jest.Mock;
    };
  };
}

const commandState = (jest.requireMock('../../command/store') as CommandStoreMock).useCommandStore.__state;

/** Connects the update hub and hands back the registered incidentCommandUpdated listener. */
const captureIncidentCommandHandler = async (): Promise<(message: unknown) => void> => {
  await useSignalRStore.getState().connectUpdateHub();
  const registration = (signalRService.on as jest.Mock).mock.calls.find(([event]) => event === 'incidentCommandUpdated');
  if (!registration) {
    throw new Error(`incidentCommandUpdated was never subscribed (store error: ${String(useSignalRStore.getState().error)})`);
  }
  return registration[1] as (message: unknown) => void;
};

describe('incidentCommandUpdated realtime routing', () => {
  beforeEach(() => {
    (signalRService.on as jest.Mock).mockClear();
    (signalRService.invoke as jest.Mock).mockClear();
    commandState.refreshBoard.mockClear();
    commandState.syncFromServer.mockClear();
    commandState.boards = { '1001': { callId: '1001' } };
    // The store is a module singleton, and connectUpdateHub returns early when it believes it is
    // already connected — reset the flag so each test really re-subscribes.
    useSignalRStore.setState({ isUpdateHubConnected: false, error: null });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes the open board when Core sends the call id as a bare string', async () => {
    const handler = await captureIncidentCommandHandler();

    // The shape Core actually puts on the wire — this must hit the targeted refresh.
    handler('1001');

    expect(commandState.refreshBoard).toHaveBeenCalledWith('1001');
    expect(commandState.syncFromServer).not.toHaveBeenCalled();
  });

  it('accepts a numeric call id', async () => {
    const handler = await captureIncidentCommandHandler();

    handler(1001);

    expect(commandState.refreshBoard).toHaveBeenCalledWith('1001');
  });

  it('still accepts an object payload from a richer producer', async () => {
    const handler = await captureIncidentCommandHandler();

    handler({ CallId: '1001' });

    expect(commandState.refreshBoard).toHaveBeenCalledWith('1001');
    expect(commandState.syncFromServer).not.toHaveBeenCalled();
  });

  it('falls back to a debounced full sync for an incident this device has not opened', async () => {
    const handler = await captureIncidentCommandHandler();

    handler('2002');

    expect(commandState.refreshBoard).not.toHaveBeenCalled();
    expect(commandState.syncFromServer).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);

    expect(commandState.syncFromServer).toHaveBeenCalledTimes(1);
  });

  it('rejoins the department group after an automatic reconnect and backfills the gap', async () => {
    // A reconnect gets a new connection id, so the server-side group membership is gone. Without
    // re-announcing, the device stops receiving other users' board changes entirely — silently.
    await captureIncidentCommandHandler();
    (signalRService.invoke as jest.Mock).mockClear();

    const reconnect = (signalRService.on as jest.Mock).mock.calls.find(([event]) => event === '__hubReconnected:eventingHub');
    expect(reconnect).toBeDefined();

    (reconnect?.[1] as () => void)();
    await Promise.resolve();
    await Promise.resolve();

    expect(signalRService.invoke).toHaveBeenCalledWith('eventingHub', 'connect', 123);

    // The hub replays nothing from the outage, so the boards have to be resynced.
    jest.advanceTimersByTime(2000);
    expect(commandState.syncFromServer).toHaveBeenCalledTimes(1);
  });

  it('marks the update hub disconnected so it can be rebuilt later', async () => {
    await captureIncidentCommandHandler();

    const disconnect = (signalRService.on as jest.Mock).mock.calls.find(([event]) => event === '__hubDisconnected:eventingHub');
    expect(disconnect).toBeDefined();

    (disconnect?.[1] as () => void)();

    expect(useSignalRStore.getState().isUpdateHubConnected).toBe(false);
  });

  it('treats an unusable payload as "something changed" rather than a call id', async () => {
    const handler = await captureIncidentCommandHandler();

    handler('   ');
    jest.advanceTimersByTime(2000);

    expect(commandState.refreshBoard).not.toHaveBeenCalled();
    expect(commandState.syncFromServer).toHaveBeenCalledTimes(1);
  });
});
