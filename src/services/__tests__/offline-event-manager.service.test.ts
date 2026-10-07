import { AppState } from 'react-native';

import { saveCallImage } from '@/api/calls/callFiles';
import { closeCall } from '@/api/calls/calls';
import { closeCommand, getCommandBoard, saveObjective } from '@/api/incidentCommand/incidentCommand';
import { setUnitLocation } from '@/api/units/unitLocation';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { QueuedEventStatus, QueuedEventType } from '@/models/offline-queue/queued-event';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
}));

// Mock APIs
jest.mock('@/api/calls/callFiles', () => ({
  saveCallImage: jest.fn(),
}));

jest.mock('@/api/units/unitLocation', () => ({
  setUnitLocation: jest.fn(),
}));

jest.mock('@/api/units/unitStatuses', () => ({
  saveUnitStatus: jest.fn(),
}));

jest.mock('@/api/check-in-timers/check-in-timers', () => ({
  performCheckIn: jest.fn(),
}));

jest.mock('@/api/incidentCommand/incidentCommand', () => ({
  establishCommand: jest.fn(),
  closeCommand: jest.fn(),
  getCommandBoard: jest.fn(),
  saveObjective: jest.fn(),
}));

jest.mock('@/api/calls/calls', () => ({
  closeCall: jest.fn(),
}));

jest.mock('@/api/incidentCommand/incidentResources', () => ({
  createAdHocUnit: jest.fn(),
  releaseAdHocUnit: jest.fn(),
}));

jest.mock('@/api/incidentCommand/incidentRoles', () => ({
  assignIncidentRole: jest.fn(),
  removeIncidentRole: jest.fn(),
}));

const mockRefreshBoard = jest.fn();
jest.mock('@/stores/command/store', () => ({
  useCommandStore: {
    getState: jest.fn(() => ({ refreshBoard: mockRefreshBoard, syncFromServer: jest.fn() })),
  },
}));

// Mock the offline queue store
jest.mock('@/stores/offline-queue/store', () => ({
  useOfflineQueueStore: {
    getState: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
  },
}));

// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock models
jest.mock('@/models/v4/unitLocation/saveUnitLocationInput', () => ({
  SaveUnitLocationInput: jest.fn().mockImplementation(() => ({
    UnitId: '',
    Timestamp: '',
    Latitude: '',
    Longitude: '',
    Accuracy: '',
    Altitude: '',
    AltitudeAccuracy: '',
    Speed: '',
    Heading: '',
  })),
}));

jest.mock('@/models/v4/unitStatus/saveUnitStatusInput', () => ({
  SaveUnitStatusInput: jest.fn().mockImplementation(() => ({
    Id: '',
    Type: '',
    Note: '',
    RespondingTo: '',
    Timestamp: '',
    TimestampUtc: '',
    Roles: [],
  })),
  SaveUnitStatusRoleInput: jest.fn().mockImplementation(() => ({
    RoleId: '',
    UserId: '',
  })),
}));

const mockSaveCallImage = saveCallImage as jest.MockedFunction<typeof saveCallImage>;
const mockSetUnitLocation = setUnitLocation as jest.MockedFunction<typeof setUnitLocation>;
const mockSaveUnitStatus = saveUnitStatus as jest.MockedFunction<typeof saveUnitStatus>;
const mockUseOfflineQueueStore = useOfflineQueueStore as { getState: jest.MockedFunction<any> };
const mockAppState = AppState as jest.Mocked<typeof AppState>;

describe('OfflineEventManager', () => {
  let mockStoreState: any;

  beforeAll(() => {
    // Use fake timers for the entire test suite
    jest.useFakeTimers();
  });

  afterAll(() => {
    // Clean up any remaining timers and restore real timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    mockStoreState = {
      isConnected: true,
      isNetworkReachable: true,
      addEvent: jest.fn().mockReturnValue('test-event-id'),
      updateEventStatus: jest.fn(),
      removeEvent: jest.fn(),
      getPendingEvents: jest.fn().mockReturnValue([]),
      getFailedEvents: jest.fn().mockReturnValue([]),
      initializeNetworkListener: jest.fn(),
      retryAllFailedEvents: jest.fn(),
      clearCompletedEvents: jest.fn(),
      _setProcessing: jest.fn(),
      totalEvents: 0,
      completedEvents: 0,
    };

    mockUseOfflineQueueStore.getState.mockReturnValue(mockStoreState);
    
    // Setup AppState mock
    mockAppState.addEventListener.mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    // Ensure processing is stopped after each test
    try {
      offlineEventManager.stopProcessing();
    } catch (e) {
      // Ignore any errors during cleanup
    }
    jest.clearAllTimers();
  });

  describe('queueUnitStatusEvent', () => {
    it('should queue a unit status event', () => {
      const eventId = offlineEventManager.queueUnitStatusEvent(
        'unit-1',
        'available',
        'Test note',
        'call-1',
        2,
        [{ roleId: 'role-1', userId: 'user-1' }]
      );

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.UNIT_STATUS,
        expect.objectContaining({
          unitId: 'unit-1',
          statusType: 'available',
          note: 'Test note',
          respondingTo: 'call-1',
          respondingToType: 2,
          roles: [{ roleId: 'role-1', userId: 'user-1' }],
          timestamp: expect.any(String),
          timestampUtc: expect.any(String),
        })
      );
    });

    it('should queue unit status event without optional parameters', () => {
      const eventId = offlineEventManager.queueUnitStatusEvent('unit-1', 'available');

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.UNIT_STATUS,
        expect.objectContaining({
          unitId: 'unit-1',
          statusType: 'available',
          note: undefined,
          respondingTo: undefined,
          respondingToType: undefined,
          roles: undefined,
        })
      );
    });
  });

  describe('queueLocationUpdateEvent', () => {
    it('should queue a location update event', () => {
      const eventId = offlineEventManager.queueLocationUpdateEvent(
        'unit-1',
        40.7128,
        -74.0060,
        10,
        45,
        25
      );

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.LOCATION_UPDATE,
        expect.objectContaining({
          unitId: 'unit-1',
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          heading: 45,
          speed: 25,
          timestamp: expect.any(String),
        })
      );
    });

    it('should queue location update event without optional parameters', () => {
      const eventId = offlineEventManager.queueLocationUpdateEvent('unit-1', 40.7128, -74.0060);

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.LOCATION_UPDATE,
        expect.objectContaining({
          unitId: 'unit-1',
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: undefined,
          heading: undefined,
          speed: undefined,
        })
      );
    });
  });

  describe('queueCallImageUploadEvent', () => {
    it('should queue a call image upload event', () => {
      const eventId = offlineEventManager.queueCallImageUploadEvent(
        'call-1',
        'user-1',
        'Test note',
        'image.jpg',
        '/path/to/image.jpg',
        40.7128,
        -74.0060
      );

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.CALL_IMAGE_UPLOAD,
        expect.objectContaining({
          callId: 'call-1',
          userId: 'user-1',
          note: 'Test note',
          name: 'image.jpg',
          filePath: '/path/to/image.jpg',
          latitude: 40.7128,
          longitude: -74.0060,
        })
      );
    });

    it('should queue call image upload event without optional parameters', () => {
      const eventId = offlineEventManager.queueCallImageUploadEvent(
        'call-1',
        'user-1',
        'Test note',
        'image.jpg',
        '/path/to/image.jpg'
      );

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.CALL_IMAGE_UPLOAD,
        expect.objectContaining({
          callId: 'call-1',
          userId: 'user-1',
          note: 'Test note',
          name: 'image.jpg',
          filePath: '/path/to/image.jpg',
          latitude: undefined,
          longitude: undefined,
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return processing statistics', () => {
      mockStoreState.totalEvents = 10;
      mockStoreState.completedEvents = 7;
      mockStoreState.getPendingEvents.mockReturnValue([{ id: '1' }, { id: '2' }]);
      mockStoreState.getFailedEvents.mockReturnValue([{ id: '3' }]);

      const stats = offlineEventManager.getStats();

      expect(stats).toEqual({
        isProcessing: false,
        totalEvents: 10,
        pendingEvents: 2,
        failedEvents: 1,
        completedEvents: 7,
      });
    });
  });

  describe('retryFailedEvents', () => {
    it('should retry all failed events', () => {
      offlineEventManager.retryFailedEvents();

      expect(mockStoreState.retryAllFailedEvents).toHaveBeenCalled();
    });
  });

  describe('clearCompletedEvents', () => {
    it('should clear completed events', () => {
      offlineEventManager.clearCompletedEvents();

      expect(mockStoreState.clearCompletedEvents).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should initialize network listener', () => {
      offlineEventManager.initialize();

      expect(mockStoreState.initializeNetworkListener).toHaveBeenCalled();
    });
  });

  describe('startProcessing', () => {
    it('should start processing interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      offlineEventManager.startProcessing();

      // Verify setInterval was called
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
      
      // Verify immediate processing call
      expect(mockStoreState.getPendingEvents).toHaveBeenCalled();
    });

    it('should not start multiple intervals', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      offlineEventManager.startProcessing();
      offlineEventManager.startProcessing();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopProcessing', () => {
    it('should stop processing interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      offlineEventManager.startProcessing();
      offlineEventManager.stopProcessing();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('event processing', () => {
    beforeEach(() => {
      mockSaveUnitStatus.mockResolvedValue({} as any);
      mockSetUnitLocation.mockResolvedValue({} as any);
      mockSaveCallImage.mockResolvedValue({} as any);
    });

    it('should set up processing interval but skip processing when offline', () => {
      mockStoreState.isConnected = false;
      mockStoreState.isNetworkReachable = false;
      
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      offlineEventManager.startProcessing();

      // The interval should still be set up, even if offline
      expect(setIntervalSpy).toHaveBeenCalled();
      
      // When offline, processQueuedEvents will return early and not call getPendingEvents
      // So we just verify the interval was set up
    });

    it('should set up processing interval when online', () => {
      const mockEvent = {
        id: 'test-event',
        type: QueuedEventType.UNIT_STATUS,
        status: QueuedEventStatus.PENDING,
        data: {
          unitId: 'unit-1',
          statusType: 'available',
          timestamp: '2023-01-01T00:00:00Z',
          timestampUtc: 'Sun, 01 Jan 2023 00:00:00 GMT',
        },
        retryCount: 0,
        maxRetries: 3,
        createdAt: Date.now(),
      };

      mockStoreState.getPendingEvents.mockReturnValue([mockEvent]);
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      // Trigger processing
      offlineEventManager.startProcessing();

      // The interval should be set up
      expect(setIntervalSpy).toHaveBeenCalled();
      
      // Verify that getPendingEvents is called immediately when online
      expect(mockStoreState.getPendingEvents).toHaveBeenCalled();
    });
  });

  describe('command board refresh ordering', () => {
    it('marks the event COMPLETED before refreshing the board (prevents duplicate local- rows)', async () => {
      // preserveQueuedLocalRows carries optimistic local- rows while a matching
      // non-completed queued event exists — refreshing before COMPLETED would duplicate
      // the row the replay just created on the server.
      const completedBeforeRefresh: boolean[] = [];
      mockRefreshBoard.mockImplementation(async () => {
        completedBeforeRefresh.push(mockStoreState.updateEventStatus.mock.calls.some((call: unknown[]) => call[0] === 'evt-1' && call[1] === QueuedEventStatus.COMPLETED));
      });
      (getCommandBoard as jest.Mock).mockResolvedValue({ Data: { Command: { IncidentCommandId: 'ic-1' } } });
      (saveObjective as jest.Mock).mockResolvedValue({});

      const event = {
        id: 'evt-1',
        type: QueuedEventType.SAVE_OBJECTIVE,
        status: QueuedEventStatus.PENDING,
        data: { callId: '42', name: 'Ventilate roof', objectiveType: 0 },
        retryCount: 0,
        maxRetries: 3,
        createdAt: Date.now(),
      };

      const processEventMethod = (offlineEventManager as any).processEvent.bind(offlineEventManager);
      await processEventMethod(event);

      expect(saveObjective).toHaveBeenCalled();
      expect(mockRefreshBoard).toHaveBeenCalledWith('42');
      expect(completedBeforeRefresh).toEqual([true]);
    });
  });

  describe('call close queued behind an offline End Command', () => {
    const axiosFailure = (response?: { status: number; data?: unknown }) => Object.assign(new Error(response ? `Request failed with status code ${response.status}` : 'Network Error'), { isAxiosError: true, response });

    const queuedEvent = (id: string, type: QueuedEventType, data: Record<string, unknown>) => ({ id, type, status: QueuedEventStatus.PENDING, data, retryCount: 0, maxRetries: 3, createdAt: Date.now() }) as any;

    let queue: any[];

    /** A working stand-in for the queue store: pending selection, status updates and retry bookkeeping. */
    const useQueue = (events: any[]) => {
      queue = events;
      mockStoreState.queuedEvents = queue;
      mockStoreState.getPendingEvents.mockImplementation(() =>
        queue.filter((e) => e.status === QueuedEventStatus.PENDING || (e.status === QueuedEventStatus.FAILED && e.retryCount < e.maxRetries && (!e.nextRetryAt || e.nextRetryAt <= Date.now())))
      );
      mockStoreState.updateEventStatus.mockImplementation((id: string, status: QueuedEventStatus, error?: string, options?: { permanent?: boolean }) => {
        const event = queue.find((e) => e.id === id);
        event.status = status;
        event.error = error;
        if (status === QueuedEventStatus.FAILED) {
          if (options?.permanent) {
            event.retryCount = event.maxRetries;
          } else {
            event.retryCount += 1;
            event.nextRetryAt = Date.now() + 60000;
          }
        }
      });
    };

    const closeCommandEvent = () => queuedEvent('cmd-evt', QueuedEventType.CLOSE_COMMAND, { callId: '101', incidentCommandId: 'cmd-101' });
    const closeCallEvent = () => queuedEvent('call-evt', QueuedEventType.CLOSE_CALL, { callId: '101', type: 3, notes: 'Nothing found', sendNotification: true });

    beforeEach(() => {
      (offlineEventManager as any).isProcessing = false;
      (closeCommand as jest.Mock).mockResolvedValue({});
      (closeCall as jest.Mock).mockResolvedValue({});
    });

    it('replays the call close only after the command close it was queued behind', async () => {
      useQueue([closeCommandEvent(), closeCallEvent()]);

      await (offlineEventManager as any).processQueuedEvents();

      expect(closeCommand).toHaveBeenCalledWith('cmd-101');
      expect(closeCall).toHaveBeenCalledWith({ callId: '101', type: 3, note: 'Nothing found', sendNotification: true });
      expect((closeCommand as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((closeCall as jest.Mock).mock.invocationCallOrder[0]);
      expect(queue.map((e) => e.status)).toEqual([QueuedEventStatus.COMPLETED, QueuedEventStatus.COMPLETED]);
    });

    it('holds the call close while the command close is waiting to retry', async () => {
      (closeCommand as jest.Mock).mockRejectedValue(axiosFailure({ status: 503 }));
      useQueue([closeCommandEvent(), closeCallEvent()]);

      await (offlineEventManager as any).processQueuedEvents();

      expect(closeCommand).toHaveBeenCalledTimes(1);
      expect(closeCall).not.toHaveBeenCalled();
      expect(queue[1].status).toBe(QueuedEventStatus.PENDING);
    });

    it('does not hold a call close for a command close on a different call', async () => {
      const otherCallCommand = queuedEvent('other-cmd', QueuedEventType.CLOSE_COMMAND, { callId: '202', incidentCommandId: 'cmd-202' });
      (closeCommand as jest.Mock).mockReturnValue(new Promise(() => undefined));
      useQueue([otherCallCommand, closeCallEvent()]);

      void (offlineEventManager as any).processQueuedEvents();
      await Promise.resolve();

      expect(closeCall).toHaveBeenCalledTimes(1);
      (offlineEventManager as any).isProcessing = false;
    });

    it('gives up on a call close the server refuses (400), keeping its reason', async () => {
      const reason = 'This call has an active incident command. Close the incident command first, then close the call.';
      (closeCall as jest.Mock).mockRejectedValue(axiosFailure({ status: 400, data: reason }));
      useQueue([closeCallEvent()]);

      await (offlineEventManager as any).processQueuedEvents();

      expect(mockStoreState.updateEventStatus).toHaveBeenCalledWith('call-evt', QueuedEventStatus.FAILED, reason, { permanent: true });
      expect(queue[0].retryCount).toBe(queue[0].maxRetries);
      expect(mockStoreState.getPendingEvents()).toEqual([]);
    });

    it('retries a call close that failed without a refusal (server error)', async () => {
      (closeCall as jest.Mock).mockRejectedValue(axiosFailure({ status: 502 }));
      useQueue([closeCallEvent()]);

      await (offlineEventManager as any).processQueuedEvents();

      expect(mockStoreState.updateEventStatus).toHaveBeenCalledWith('call-evt', QueuedEventStatus.FAILED, 'Request failed with status code 502');
      expect(queue[0].retryCount).toBe(1);
    });
  });

  describe('app state handling', () => {
    it('should have set up app state listener during initialization', () => {
      // The AppState listener should have been set up when the module was imported
      // Even if the mock wasn't capturing it initially, we can test the behavior
      // by directly calling the handler method that would be triggered
      
      // Create a spy to verify the method calls
      const startProcessingSpy = jest.spyOn(offlineEventManager, 'startProcessing');
      
      // Since we can't easily test the private method directly, let's test via initialize
      // which calls handleAppStateChange with current state
      offlineEventManager.initialize();
      
      // The initialize method calls handleAppStateChange with AppState.currentState ('active')
      // which should trigger startProcessing
      expect(startProcessingSpy).toHaveBeenCalled();
    });

    it('should be able to handle app state changes', () => {
      // Test that the service has the capability to handle state changes
      // by testing the initialize method which demonstrates the app state handling
      expect(() => {
        offlineEventManager.initialize();
      }).not.toThrow();
      
      // Verify the store initialization was called
      expect(mockStoreState.initializeNetworkListener).toHaveBeenCalled();
    });
  });
});
