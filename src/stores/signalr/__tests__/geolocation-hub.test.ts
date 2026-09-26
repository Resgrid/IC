/**
 * Realtime unit/personnel positions from the GeolocationHub.
 *
 * Group membership belongs to a connection id: the first start, SignalR's automatic reconnect and
 * the service's own rebuild after a close each produce a connection that is outside the department
 * group until `GeolocationConnect` (zero arguments) is invoked on it. Missing any one of them leaves
 * the socket open and the map silently frozen. These pin that, plus how pushes land in the store.
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
    isHubAvailable: jest.fn(() => true),
    removeAllListeners: jest.fn(),
    connectToHub: jest.fn().mockResolvedValue(undefined),
    disconnectAll: jest.fn().mockResolvedValue(undefined),
  };
  class MockSignalRService {
    static readonly HUB_DISCONNECTED_EVENT = '__hubDisconnected';
    static readonly HUB_RECONNECTING_EVENT = '__hubReconnecting';
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
  const state = { boards: {}, refreshBoard: jest.fn(() => Promise.resolve()), syncFromServer: jest.fn(() => Promise.resolve()) };
  return { useCommandStore: { getState: () => state } };
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

const GUID = '5A0B6E1C-9F3D-4C2B-8E7A-1D2C3B4A5F60';

const mockOn = signalRService.on as jest.Mock;
const mockInvoke = signalRService.invoke as jest.Mock;

/** The most recent listener registered for an event. */
const handlerFor = (event: string): ((...args: unknown[]) => void) => {
  const registration = mockOn.mock.calls.filter(([name]) => name === event).pop();
  if (!registration) {
    throw new Error(`${event} was never subscribed (store error: ${String(useSignalRStore.getState().error)})`);
  }
  return registration[1] as (...args: unknown[]) => void;
};

const geolocationJoins = () => mockInvoke.mock.calls.filter(([hub, method]) => hub === 'geolocationHub' && method === 'GeolocationConnect');

const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

describe('geolocation hub', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    // Tear down whatever the previous test left registered so each test starts from a clean session.
    await useSignalRStore.getState().disconnectGeolocationHub();
    jest.clearAllMocks();
    mockInvoke.mockReset().mockResolvedValue(undefined);
    (signalRService.isHubAvailable as jest.Mock).mockReturnValue(true);
    useSignalRStore.setState({ isGeolocationHubConnected: false, liveLocations: {}, lastGeolocationJoinAt: 0, error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('connect', () => {
    it('opens /geolocationHub and joins the department group with zero arguments', async () => {
      await useSignalRStore.getState().connectGeolocationHub();

      expect(signalRService.connectToHubWithEventingUrl).toHaveBeenCalledWith({
        name: 'geolocationHub',
        eventingUrl: 'https://eventing.example.com/',
        hubName: 'geolocationHub',
        methods: ['onPersonnelLocationUpdated', 'onUnitLocationUpdated', 'onGeolocationConnect'],
      });
      // Exactly these arguments: a stray payload makes the server reject the call by arity.
      expect(geolocationJoins()).toEqual([['geolocationHub', 'GeolocationConnect']]);
    });

    it('listens for the push events and the join acknowledgement before joining', async () => {
      await useSignalRStore.getState().connectGeolocationHub();

      const joinOrder = mockInvoke.mock.invocationCallOrder[0];
      ['onPersonnelLocationUpdated', 'onUnitLocationUpdated', 'onGeolocationConnect'].forEach((event) => {
        const index = mockOn.mock.calls.findIndex(([name]) => name === event);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(mockOn.mock.invocationCallOrder[index]).toBeLessThan(joinOrder);
      });
    });

    it('is only connected once the server acknowledges the join', async () => {
      await useSignalRStore.getState().connectGeolocationHub();
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);

      handlerFor('onGeolocationConnect')('connection-1');

      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(true);
      expect(useSignalRStore.getState().lastGeolocationJoinAt).toBeGreaterThan(0);
    });

    it('does not reconnect while a working session exists', async () => {
      useSignalRStore.setState({ isGeolocationHubConnected: true });

      await useSignalRStore.getState().connectGeolocationHub();

      expect(signalRService.connectToHubWithEventingUrl).not.toHaveBeenCalled();
    });

    it('does not let a stale connected flag block the rebuild', async () => {
      // The flag says connected, but the service no longer holds the connection.
      useSignalRStore.setState({ isGeolocationHubConnected: true });
      (signalRService.isHubAvailable as jest.Mock).mockReturnValue(false);

      await useSignalRStore.getState().connectGeolocationHub();

      expect(signalRService.connectToHubWithEventingUrl).toHaveBeenCalledTimes(1);
      expect(geolocationJoins()).toHaveLength(1);
    });

    it('retries a failed join, then stops and leaves the session rebuildable', async () => {
      mockInvoke.mockRejectedValue(new Error('hub refused'));

      await useSignalRStore.getState().connectGeolocationHub();
      expect(geolocationJoins()).toHaveLength(1);

      for (let i = 0; i < 4; i += 1) {
        await jest.advanceTimersByTimeAsync(5000);
        await flush();
      }

      // Three attempts, then it stops rather than retrying forever.
      expect(geolocationJoins()).toHaveLength(3);
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);
    });
  });

  describe('reconnect paths', () => {
    beforeEach(async () => {
      await useSignalRStore.getState().connectGeolocationHub();
      handlerFor('onGeolocationConnect')('connection-1');
      mockInvoke.mockClear();
    });

    it('rejoins after SignalR reconnects automatically', async () => {
      handlerFor('__hubReconnecting:geolocationHub')();
      // A reconnecting socket has a new connection id and is outside the group.
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);

      handlerFor('__hubReconnected:geolocationHub')();
      await flush();

      expect(geolocationJoins()).toEqual([['geolocationHub', 'GeolocationConnect']]);

      handlerFor('onGeolocationConnect')('connection-2');
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(true);
    });

    it('rejoins after the service rebuilds the connection following a close (token expiry)', async () => {
      const joinedAt = useSignalRStore.getState().lastGeolocationJoinAt;

      handlerFor('__hubDisconnected:geolocationHub')();
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);

      // The service raises the reconnected event once its rebuild (with a fresh token) is up.
      handlerFor('__hubReconnected:geolocationHub')();
      await flush();
      expect(geolocationJoins()).toHaveLength(1);

      jest.advanceTimersByTime(1);
      handlerFor('onGeolocationConnect')('connection-3');
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(true);
      // A new join time is what tells mounted maps to backfill the gap.
      expect(useSignalRStore.getState().lastGeolocationJoinAt).toBeGreaterThan(joinedAt);
    });

    it('lets connectGeolocationHub rebuild after a close', async () => {
      handlerFor('__hubDisconnected:geolocationHub')();
      (signalRService.connectToHubWithEventingUrl as jest.Mock).mockClear();

      await useSignalRStore.getState().connectGeolocationHub();

      expect(signalRService.connectToHubWithEventingUrl).toHaveBeenCalledTimes(1);
      expect(geolocationJoins()).toHaveLength(1);
    });

    it('does not retry a join that failed against a connection that has since gone', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('connection closed'));
      handlerFor('__hubReconnected:geolocationHub')();
      handlerFor('__hubDisconnected:geolocationHub')();
      await flush();

      await jest.advanceTimersByTimeAsync(5000);
      await flush();

      expect(geolocationJoins()).toHaveLength(1);
    });
  });

  describe('live positions', () => {
    beforeEach(async () => {
      await useSignalRStore.getState().connectGeolocationHub();
    });

    it('stores the camelCase unit and personnel payloads per entity', () => {
      handlerFor('onUnitLocationUpdated')({ departmentId: 1, unitId: '12', latitude: 34.05, longitude: -118.24, recordId: 'r1', timestamp: '2026-09-25T14:03:11.123Z' });
      handlerFor('onPersonnelLocationUpdated')({ departmentId: 1, userId: GUID, latitude: 34.06, longitude: -118.25, recordId: 'r2', timestamp: null });

      const { liveLocations } = useSignalRStore.getState();
      expect(Object.keys(liveLocations).sort()).toEqual([`p${GUID.toLowerCase()}`, 'u12']);
      expect(liveLocations.u12).toEqual(expect.objectContaining({ latitude: 34.05, longitude: -118.24, timestamp: Date.parse('2026-09-25T14:03:11.123Z') }));
      expect(liveLocations[`p${GUID.toLowerCase()}`]).toEqual(expect.objectContaining({ latitude: 34.06, longitude: -118.25, timestamp: null }));
    });

    it('keeps every entity from a burst rather than only the last message', () => {
      handlerFor('onUnitLocationUpdated')({ unitId: '12', latitude: 1, longitude: 1 });
      handlerFor('onUnitLocationUpdated')({ unitId: '13', latitude: 2, longitude: 2 });
      handlerFor('onUnitLocationUpdated')(JSON.stringify({ UnitId: 14, Latitude: 3, Longitude: 3 }));

      expect(Object.keys(useSignalRStore.getState().liveLocations).sort()).toEqual(['u12', 'u13', 'u14']);
    });

    it('ignores a fix older than the one already held', () => {
      handlerFor('onUnitLocationUpdated')({ unitId: '12', latitude: 5, longitude: 5, timestamp: '2026-09-25T14:05:00Z' });
      const before = useSignalRStore.getState().liveLocations;

      handlerFor('onUnitLocationUpdated')({ unitId: '12', latitude: 1, longitude: 1, timestamp: '2026-09-25T14:04:00Z' });

      expect(useSignalRStore.getState().liveLocations).toBe(before);
      expect(useSignalRStore.getState().liveLocations.u12.latitude).toBe(5);
    });

    it('ignores unusable payloads', () => {
      handlerFor('onUnitLocationUpdated')({ unitId: '12', latitude: 0, longitude: 0 });
      handlerFor('onPersonnelLocationUpdated')({ UnitId: '12', latitude: 1, longitude: 1 });

      expect(useSignalRStore.getState().liveLocations).toEqual({});
    });

    it('clears live positions on reset', () => {
      handlerFor('onUnitLocationUpdated')({ unitId: '12', latitude: 1, longitude: 1 });

      useSignalRStore.getState().clearLiveLocations();

      expect(useSignalRStore.getState().liveLocations).toEqual({});
    });
  });

  describe('disconnect', () => {
    it('clears the flag and removes every listener it registered', async () => {
      await useSignalRStore.getState().connectGeolocationHub();
      handlerFor('onGeolocationConnect')('connection-1');
      const registered = mockOn.mock.calls.map(([event, handler]) => [event, handler]);

      await useSignalRStore.getState().disconnectGeolocationHub();

      expect(signalRService.disconnectFromHub).toHaveBeenCalledWith('geolocationHub');
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);
      registered.forEach(([event, handler]) => {
        expect(signalRService.off).toHaveBeenCalledWith(event, handler);
      });
    });
  });
});
