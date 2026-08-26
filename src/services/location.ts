import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';

import { logger } from '@/lib/logging';
import { isWeb } from '@/lib/platform';
import { useLocationStore } from '@/stores/app/location-store';

// IC app has no unit context — location is only tracked locally (map centering,
// distance calculations); it is never reported to the unit AVL API.
//
// Location is foreground-only by design: the app never requests background location
// permission and never registers an OS location task. Do not reintroduce
// expo-task-manager / Location.startLocationUpdatesAsync here — incident command runs
// with the app open, and background location has no feature that justifies it.
const sendLocationToAPI = async (_location: Location.LocationObject): Promise<void> => {
  // Intentionally a no-op for the IC app.
};

class LocationService {
  private static instance: LocationService;
  private locationSubscription: Location.LocationSubscription | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private isTrackingRequested = false;
  // Bumped when tracking stops or the app backgrounds; invalidates in-flight starts
  private startGeneration = 0;
  // Serializes start attempts so concurrent calls cannot each create a watcher
  private startQueue: Promise<void> = Promise.resolve();

  private constructor() {
    this.initializeAppStateListener();
  }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  private initializeAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    logger.info({
      message: 'Location service handling app state change',
      context: { nextAppState, trackingRequested: this.isTrackingRequested },
    });

    // AppState event handlers don't handle promise rejections — catch everything
    try {
      if (nextAppState === 'background') {
        // Foreground-only tracking: drop the watcher while the app is backgrounded and
        // cancel any in-flight start; isTrackingRequested stays set so 'active' resumes.
        this.startGeneration++;
        await this.removeSubscription();
      } else if (nextAppState === 'active' && this.isTrackingRequested) {
        await this.startLocationUpdates();
      }
    } catch (error) {
      logger.error({
        message: 'Location service failed to handle app state change',
        context: { error, nextAppState },
      });
    }
  };

  private async removeSubscription(): Promise<void> {
    if (!this.locationSubscription) {
      return;
    }

    if (isWeb) {
      // On web the subscription is our own shim wrapping clearWatch
      (this.locationSubscription as unknown as { remove: () => void }).remove();
    } else {
      await this.locationSubscription.remove();
    }
    this.locationSubscription = null;
  }

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    logger.info({
      message: 'Location permissions requested',
      context: { foregroundStatus },
    });

    return foregroundStatus === 'granted';
  }

  async startLocationUpdates(): Promise<void> {
    // Record tracking intent up front so a start interrupted by backgrounding
    // (e.g. the OS permission dialog) is resumed on the next 'active' transition.
    // Failure paths inside doStartLocationUpdates clear it.
    this.isTrackingRequested = true;

    const attempt = this.startQueue.then(() => this.doStartLocationUpdates());
    this.startQueue = attempt.catch(() => {});
    return attempt;
  }

  private async doStartLocationUpdates(): Promise<void> {
    const generation = this.startGeneration;

    // On web, use a lightweight browser geolocation watcher instead of expo-location
    if (isWeb) {
      if (!('geolocation' in navigator)) {
        logger.warn({ message: 'Geolocation API not available in this browser' });
        this.isTrackingRequested = false;
        return;
      }

      if (!this.locationSubscription) {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const loc: Location.LocationObject = {
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude ?? 0,
                accuracy: pos.coords.accuracy ?? 0,
                altitudeAccuracy: pos.coords.altitudeAccuracy ?? 0,
                heading: pos.coords.heading ?? 0,
                speed: pos.coords.speed ?? 0,
              },
              timestamp: pos.timestamp,
            };
            useLocationStore.getState().setLocation(loc);
            void sendLocationToAPI(loc).catch((error) => {
              logger.error({
                message: 'Failed to send web location update to API',
                context: { error },
              });
            });
          },
          (err) => {
            logger.warn({ message: 'Web geolocation error', context: { code: err.code, msg: err.message } });
          },
          { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 }
        );
        // Store a compatible subscription object
        this.locationSubscription = { remove: () => navigator.geolocation.clearWatch(watchId) } as unknown as Location.LocationSubscription;
        logger.info({ message: 'Foreground location updates started' });
      }
      return;
    }

    let hasPermissions: boolean;
    try {
      hasPermissions = await this.requestPermissions();
    } catch (error) {
      this.isTrackingRequested = false;
      logger.error({
        message: 'Failed to request location permissions before starting updates',
        context: { operation: 'startLocationUpdates', error },
      });
      throw error;
    }
    if (!hasPermissions) {
      this.isTrackingRequested = false;
      throw new Error('Location permissions not granted');
    }

    if (generation !== this.startGeneration) {
      logger.info({ message: 'Location start cancelled while requesting permissions' });
      return;
    }

    // Start foreground updates (idempotent - check if already subscribed)
    if (!this.locationSubscription) {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
        },
        (location) => {
          logger.info({
            message: 'Foreground location update received',
            context: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading,
            },
          });
          useLocationStore.getState().setLocation(location);
          void sendLocationToAPI(location).catch((error) => {
            logger.error({
              message: 'Failed to send foreground location update to API',
              context: { error },
            });
          });
        }
      );
      if (generation !== this.startGeneration || this.locationSubscription) {
        // Tracking stopped or app backgrounded while the watcher was being created
        await subscription.remove();
        return;
      }
      this.locationSubscription = subscription;
    } else {
      logger.info({
        message: 'Foreground location subscription already active, skipping duplicate subscription',
      });
    }

    logger.info({
      message: 'Foreground location updates started',
    });
  }

  async stopLocationUpdates(): Promise<void> {
    this.isTrackingRequested = false;
    this.startGeneration++;
    await this.removeSubscription();

    logger.info({
      message: 'All location updates stopped',
    });
  }

  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const locationService = LocationService.getInstance();
