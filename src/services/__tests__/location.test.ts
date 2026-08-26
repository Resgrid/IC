// Mock all dependencies first
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockLocationStoreState = {
  setLocation: jest.fn(),
};

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    getState: jest.fn(() => mockLocationStoreState),
  },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: {
    Balanced: 'balanced',
  },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
    currentState: 'active',
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios),
  },
}));

import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { logger } from '@/lib/logging';

// Import the service after mocks are set up
let locationService: any;

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockAppState = AppState as jest.Mocked<typeof AppState>;
const mockLocation = Location as jest.Mocked<typeof Location>;

const mockLocationObject: Location.LocationObject = {
  coords: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10.5,
    accuracy: 5.0,
    altitudeAccuracy: 2.0,
    heading: 90.0,
    speed: 15.5,
  },
  timestamp: 1700000000000,
};

describe('LocationService', () => {
  let mockLocationSubscription: jest.Mocked<Location.LocationSubscription>;

  beforeAll(() => {
    const { locationService: service } = require('../location');
    locationService = service;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockLocationStoreState.setLocation = jest.fn();

    mockLocationSubscription = {
      remove: jest.fn(),
    } as jest.Mocked<Location.LocationSubscription>;

    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      expires: 'never',
      granted: true,
      canAskAgain: true,
    });

    mockLocation.watchPositionAsync.mockResolvedValue(mockLocationSubscription);

    (AppState as any).currentState = 'active';

    // Reset internal state of the service
    (locationService as any).locationSubscription = null;
    (locationService as any).isTrackingRequested = false;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const LocationServiceClass = (locationService as any).constructor;
      const instance1 = LocationServiceClass.getInstance();
      const instance2 = LocationServiceClass.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Permission Requests', () => {
    it('should only request foreground permissions', async () => {
      const result = await locationService.requestPermissions();

      expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(result).toBe(true);
      // Background location was removed from the app — the service must not reach for the API at all
      expect((mockLocation as any).requestBackgroundPermissionsAsync).toBeUndefined();
    });

    it('should return false if foreground permission is denied', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      const result = await locationService.requestPermissions();
      expect(result).toBe(false);
    });

    it('should log the foreground permission status', async () => {
      await locationService.requestPermissions();

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Location permissions requested',
        context: { foregroundStatus: 'granted' },
      });
    });
  });

  describe('Location Updates', () => {
    it('should start foreground location updates successfully', async () => {
      await locationService.startLocationUpdates();

      expect(mockLocation.watchPositionAsync).toHaveBeenCalledWith(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
        },
        expect.any(Function)
      );

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Foreground location updates started',
      });
    });

    it('should throw error if foreground permissions are not granted', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      await expect(locationService.startLocationUpdates()).rejects.toThrow('Location permissions not granted');
    });

    it('should not create a duplicate subscription when already watching', async () => {
      await locationService.startLocationUpdates();
      await locationService.startLocationUpdates();

      expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Foreground location subscription already active, skipping duplicate subscription',
      });
    });

    it('should store location updates locally', async () => {
      await locationService.startLocationUpdates();

      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockLocationStoreState.setLocation).toHaveBeenCalledWith(mockLocationObject);
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Foreground location update received',
        context: {
          latitude: mockLocationObject.coords.latitude,
          longitude: mockLocationObject.coords.longitude,
          heading: mockLocationObject.coords.heading,
        },
      });
    });
  });

  describe('App State Handling', () => {
    const emitAppState = async (state: string) => {
      const handler = (locationService as any).handleAppStateChange;
      await handler(state);
    };

    it('should drop the subscription when the app is backgrounded', async () => {
      await locationService.startLocationUpdates();

      await emitAppState('background');

      expect(mockLocationSubscription.remove).toHaveBeenCalled();
      expect((locationService as any).locationSubscription).toBeNull();
    });

    it('should resume foreground tracking when the app becomes active again', async () => {
      await locationService.startLocationUpdates();
      await emitAppState('background');

      await emitAppState('active');

      expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(2);
    });

    it('should not start tracking on activation when tracking was never requested', async () => {
      await emitAppState('active');

      expect(mockLocation.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('should log and swallow errors raised while handling app state changes', async () => {
      const error = new Error('Location subscription failed');
      (locationService as any).isTrackingRequested = true;
      mockLocation.watchPositionAsync.mockRejectedValue(error);

      await expect(emitAppState('active')).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Location service failed to handle app state change',
        context: { error, nextAppState: 'active' },
      });
    });

    it('should register an app state listener on construction', () => {
      expect(mockAppState.addEventListener).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should stop location updates and clear the tracking flag', async () => {
      await locationService.startLocationUpdates();

      await locationService.stopLocationUpdates();

      expect(mockLocationSubscription.remove).toHaveBeenCalledTimes(1);
      expect((locationService as any).isTrackingRequested).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'All location updates stopped',
      });
    });

    it('should handle stop when no subscription exists', async () => {
      await expect(locationService.stopLocationUpdates()).resolves.not.toThrow();
    });

    it('should handle cleanup when no subscription exists', () => {
      (locationService as any).appStateSubscription = null;

      expect(() => locationService.cleanup()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle location subscription errors', async () => {
      const error = new Error('Location subscription failed');
      mockLocation.watchPositionAsync.mockRejectedValue(error);

      await expect(locationService.startLocationUpdates()).rejects.toThrow('Location subscription failed');
    });
  });
});
