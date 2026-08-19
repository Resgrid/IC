import notifee, { AndroidImportance, AndroidVisibility, AuthorizationStatus, EventType } from '@notifee/react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerDevice } from '@/api/devices/push';
import { useAuthStore } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { type RouterPushRetryOptions, routerPushWithRetry } from '@/lib/navigation';
import { getDeviceUuid } from '@/lib/storage/app';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { isSafeRouteId, parseNotificationData, usePushNotificationModalStore } from '@/stores/push-notification/store';
import { securityStore } from '@/stores/security/store';

// Numeric value for the CheckInType field expected by the API. IC users always
// check in as personnel (the IC app has no active-unit context).
const CHECK_IN_TYPE_PERSONNEL = 0;

// Delays (ms) before showing the modal on a notification tap, so the React tree
// is mounted and the store is ready.
const TAP_BACKGROUND_DELAY_MS = 300;
const TAP_KILLED_INITIAL_DELAY_MS = 1000;
const TAP_KILLED_MODAL_DELAY_MS = 500;

// Define notification response types
export interface PushNotificationData {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Pulls the Resgrid eventCode (and the data record that carried it) out of a
 * notification request. On Android the FCM data payload is surfaced as
 * content.data, but on iOS expo-notifications only maps the APNs custom key
 * "body" to content.data — Core sends eventCode as a top-level custom key (or
 * nested under aps for FCM-relayed APNs), so content.data is empty there and we
 * must fall back to the raw push payload exposed on the trigger.
 */
export function extractPushNotificationData(request: Notifications.NotificationRequest): { eventCode: string | undefined; data: Record<string, unknown> } {
  const contentData = request.content.data;
  if (contentData && typeof contentData === 'object' && typeof (contentData as Record<string, unknown>).eventCode === 'string') {
    return { eventCode: (contentData as Record<string, unknown>).eventCode as string, data: contentData as Record<string, unknown> };
  }

  const trigger = request.trigger as { payload?: Record<string, unknown> } | null | undefined;
  const payload = trigger && typeof trigger === 'object' ? trigger.payload : undefined;
  if (payload && typeof payload === 'object') {
    const candidates = [payload, payload.body, payload.aps];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && typeof (candidate as Record<string, unknown>).eventCode === 'string') {
        return { eventCode: (candidate as Record<string, unknown>).eventCode as string, data: candidate as Record<string, unknown> };
      }
    }
  }

  return {
    eventCode: undefined,
    data: contentData && typeof contentData === 'object' ? (contentData as Record<string, unknown>) : {},
  };
}

/**
 * Recognises chat push deep-links. Chat notifications carry an eventCode of
 * "t:{channelId}" (direct message) or "g:{channelId}" (group/channel); both
 * navigate to the chat conversation route. Case-insensitive so the legacy
 * uppercase prefixes deep-link too. Returns the channel id, or null when the
 * eventCode is not a chat deep-link.
 */
export function parseChatDeepLink(eventCode: string): string | null {
  const match = /^([tg]):(.+)$/i.exec(eventCode);
  if (!match) return null;
  const channelId = match[2];
  if (!isSafeRouteId(channelId)) return null;
  return channelId;
}

/**
 * Retry budget for every push deep-link: 40 x 250ms gives a cold start ~10s to mount the
 * root layout and hydrate the session before the push is given up on.
 *
 * On a cold start the session is still hydrating. Pushing a protected route before
 * it settles gets the route replaced by the auth guard, which is indistinguishable
 * from the tap doing nothing at all.
 */
const DEEP_LINK_RETRY_OPTIONS: RouterPushRetryOptions = {
  maxAttempts: 40,
  retryDelayMs: 250,
  waitUntil: () => useAuthStore.getState().status === 'signedIn',
};

/**
 * Resolves true when the push landed on its route, false once the retry budget is spent so
 * the caller can fall back to the modal.
 */
async function deepLinkWithRetry(href: Href, failureMessage: string, eventCode: string): Promise<boolean> {
  try {
    await routerPushWithRetry(href, DEEP_LINK_RETRY_OPTIONS);
    return true;
  } catch (error) {
    logger.error({ message: failureMessage, context: { error, eventCode } });
    return false;
  }
}

export async function handleChatDeepLink(eventCode: string): Promise<boolean> {
  const channelId = parseChatDeepLink(eventCode);
  if (!channelId) return false;
  return deepLinkWithRetry({ pathname: '/chat/[channelId]', params: { channelId } }, 'Failed to deep-link to chat channel', eventCode);
}

/**
 * Recognises call push deep-links. Call notifications carry an eventCode of
 * "C:{callId}" (or legacy "C{callId}"); tapping one navigates straight to the
 * call detail screen. Returns the call id, or null when the eventCode is not a
 * call deep-link.
 */
export function parseCallDeepLink(eventCode: string): string | null {
  const parsed = parseNotificationData({ eventCode });
  if (parsed.type !== 'call' || !isSafeRouteId(parsed.id)) return null;
  return parsed.id;
}

/**
 * Resolves true when the tap was navigated, false when it was not a call deep-link or the
 * navigation never landed. A false result means the caller still owes the user a fallback —
 * silently giving up leaves the app sitting on whatever screen it opened to.
 */
export async function handleCallDeepLink(eventCode: string): Promise<boolean> {
  const callId = parseCallDeepLink(eventCode);
  if (!callId) return false;
  return deepLinkWithRetry({ pathname: '/call/[id]', params: { id: callId } }, 'Failed to deep-link to call from push notification', eventCode);
}

// Configure how notifications are presented while the app is in the foreground.
// expo-notifications owns the UNUserNotificationCenter delegate (Firebase used to),
// so this controls the native banner/sound/badge presentation.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class PushNotificationService {
  private static instance: PushNotificationService;
  private pushToken: string | null = null;
  private notificationListener: { remove: () => void } | null = null;
  private responseListener: { remove: () => void } | null = null;
  private notifeeForegroundUnsubscribe: (() => void) | null = null;
  /**
   * Request identifiers of taps already routed to the modal. On a cold start the SAME
   * launch tap can arrive through both addNotificationResponseReceivedListener and
   * getLastNotificationResponseAsync — dedupe by identifier so it shows once while
   * distinct notifications still each get handled.
   */
  private handledResponseIds = new Set<string>();

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private async createNotificationChannel(id: string, name: string, description: string, sound?: string, vibration: boolean = true): Promise<void> {
    await notifee.createChannel({
      id,
      name,
      description,
      importance: AndroidImportance.HIGH,
      vibration: vibration,
      vibrationPattern: vibration ? [300, 500] : undefined,
      sound,
      lights: true,
      lightColor: '#FF231F7C',
      visibility: AndroidVisibility.PUBLIC,
    });
  }

  private async setupAndroidNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      // Standard call channels
      await this.createNotificationChannel('calls', 'Generic Call', 'Generic Call');
      await this.createNotificationChannel('0', 'Emergency Call', 'Emergency Call', 'callemergency');
      await this.createNotificationChannel('1', 'High Call', 'High Call', 'callhigh');
      await this.createNotificationChannel('2', 'Medium Call', 'Medium Call', 'callmedium');
      await this.createNotificationChannel('3', 'Low Call', 'Low Call', 'calllow');

      // Message and notification channels
      await this.createNotificationChannel('notif', 'Notification', 'Notifications', undefined, false);
      await this.createNotificationChannel('message', 'Message', 'Messages', undefined, false);

      // Custom call channels (c1-c25)
      for (let i = 1; i <= 25; i++) {
        const channelId = `c${i}`;
        await this.createNotificationChannel(channelId, `Custom Call ${i}`, `Custom Call Tone ${i}`, channelId);
      }

      logger.info({
        message: 'Android notification channels setup completed',
      });
    } catch (error) {
      logger.error({
        message: 'Error setting up Android notification channels',
        context: { error },
      });
    }
  }

  private async setupIOSNotificationCategories(): Promise<void> {
    if (Platform.OS === 'ios') {
      try {
        // Set up notification categories for iOS
        // Note: This does NOT request permissions, just sets up the categories
        await notifee.setNotificationCategories([
          {
            id: 'calls',
            actions: [
              {
                id: 'view',
                title: 'View Call',
                foreground: true,
              },
            ],
          },
        ]);

        logger.info({
          message: 'iOS notification categories setup completed',
        });
      } catch (error) {
        logger.error({
          message: 'Error setting up iOS notification categories',
          context: { error },
        });
      }
    }
  }

  // Shared helper: show the in-app modal when a notification carries an eventCode.
  private showModalForData(data: Record<string, unknown> | undefined, title?: string | null, body?: string | null): void {
    const eventCode = data?.eventCode;
    if (!eventCode || typeof eventCode !== 'string') {
      return;
    }

    const notificationData: PushNotificationData & { eventCode: string } = {
      eventCode,
      data,
    };
    if (title) {
      notificationData.title = title;
    }
    if (body) {
      notificationData.body = body;
    }

    void usePushNotificationModalStore.getState().showNotificationModal(notificationData);
  }

  // Foreground push received via expo-notifications. The extractor handles the iOS
  // case where the eventCode only exists on the raw trigger payload.
  private handleNotificationReceived = (notification: Notifications.Notification): void => {
    const { eventCode, data } = extractPushNotificationData(notification.request);

    logger.info({
      message: 'Notification received',
      context: { eventCode, data },
    });

    this.showModalForData(data, notification.request.content.title, notification.request.content.body);
  };

  /**
   * Deep-links a tapped notification, falling back to the generic modal when the eventCode
   * routes nowhere or the navigation never lands — a cold start where the session never
   * hydrates must still surface the notification instead of opening the app to nothing.
   */
  private async routeTapOrFallBack(eventCode: string | undefined, data: Record<string, unknown> | undefined, title?: string | null, body?: string | null): Promise<void> {
    if (typeof eventCode === 'string' && ((await handleChatDeepLink(eventCode)) || (await handleCallDeepLink(eventCode)))) {
      return;
    }
    this.showModalForData(data, title, body);
  }

  /**
   * Single path for tap responses from expo-notifications (live listener AND the
   * cold-start replay). Skips responses whose request identifier was already routed.
   */
  private handleResponseOnce(response: Notifications.NotificationResponse, delayMs: number, source: string): void {
    const request = response.notification.request;
    const identifier = request.identifier;

    if (identifier && this.handledResponseIds.has(identifier)) {
      logger.debug({
        message: 'Skipping already-handled notification response',
        context: { identifier, source },
      });
      return;
    }
    if (identifier) {
      this.handledResponseIds.add(identifier);
    }

    const content = request.content;
    const { eventCode, data } = extractPushNotificationData(request);

    logger.info({
      message: 'Notification response received (tap)',
      context: { eventCode, data, actionIdentifier: response.actionIdentifier, source },
    });

    // Delay so the React tree is mounted and the modal store is ready.
    setTimeout(() => {
      // Chat ("t:{channelId}" / "g:{channelId}") and call ("C:{callId}") notifications
      // deep-link straight to their screens instead of surfacing the generic modal. A
      // deep-link that never lands falls through to the modal rather than doing nothing.
      void this.routeTapOrFallBack(eventCode, data, content.title, content.body);
    }, delayMs);
  }

  // Notification tap (background → foreground) via expo-notifications.
  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    this.handleResponseOnce(response, TAP_BACKGROUND_DELAY_MS, 'listener');
  };

  // Notifee events handle taps/actions on notifee-displayed notifications,
  // including the check-in action surfaced by the check-in timer feature.
  private setupNotifeeEvents(): void {
    this.notifeeForegroundUnsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      logger.info({
        message: 'Notifee foreground event',
        context: { type, detail: { id: detail.notification?.id, data: detail.notification?.data } },
      });

      // Handle check-in action press
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'check-in') {
        await this.handleCheckInAction();
      }

      // Handle notification press → chat/call deep-link or modal
      if (type === EventType.PRESS && detail.notification) {
        const eventCode = detail.notification.data?.eventCode;
        await this.routeTapOrFallBack(typeof eventCode === 'string' ? eventCode : undefined, detail.notification.data, detail.notification.title, detail.notification.body);
      }
    });
  }

  public async handleCheckInAction(): Promise<void> {
    await handleCheckInActionFromEvent();
  }

  async initialize(): Promise<void> {
    // Push notifications are native-only; skip on web
    if (Platform.OS === 'web') {
      logger.debug({ message: 'Push notification service skipped on web' });
      return;
    }

    // Register expo-notifications listeners synchronously so taps/receipts that
    // arrive during startup are not missed.
    this.notificationListener = Notifications.addNotificationReceivedListener(this.handleNotificationReceived);
    this.responseListener = Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);

    // Set up notification channels/categories based on platform
    await this.setupAndroidNotificationChannels();
    await this.setupIOSNotificationCategories();

    // Notifee events (check-in action + notifee-displayed taps)
    this.setupNotifeeEvents();

    // Handle the notification that launched the app from a killed state.
    // expo-notifications surfaces this via getLastNotificationResponseAsync(); the same
    // tap may also have reached the response listener above, so both routes flow through
    // handleResponseOnce which dedupes by request identifier.
    setTimeout(() => {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (!response) {
            return;
          }

          logger.info({
            message: 'App opened from notification (killed state)',
            context: { data: response.notification.request.content.data },
          });

          this.handleResponseOnce(response, TAP_KILLED_MODAL_DELAY_MS, 'killed-state');
        })
        .catch((error) => {
          logger.error({
            message: 'Error checking initial notification',
            context: { error },
          });
        });
    }, TAP_KILLED_INITIAL_DELAY_MS);

    logger.info({
      message: 'Push notification service initialized',
    });
  }

  public async registerForPushNotifications(userId: string, departmentCode: string): Promise<string | null> {
    if (!Device.isDevice) {
      logger.warn({
        message: 'Push notifications are not available on simulator/emulator',
      });
      return null;
    }

    if (!userId || userId.trim() === '') {
      logger.warn({
        message: 'Cannot register for push notifications without a signed-in user ID',
      });
      return null;
    }

    try {
      // Request OS notification permissions (iOS critical alerts included).
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.warn({
          message: 'Failed to get push notification permissions',
          context: { status: finalStatus },
        });
        return null;
      }

      // Also request Notifee permissions so notifee-managed channels/critical
      // alerts are authorized on both platforms.
      const notifeeSettings = await notifee.requestPermission({
        alert: true,
        badge: true,
        sound: true,
        criticalAlert: true,
      });
      if (notifeeSettings.authorizationStatus === AuthorizationStatus.DENIED) {
        logger.warn({
          message: 'Notifee notification permissions denied',
          context: { authorizationStatus: notifeeSettings.authorizationStatus },
        });
        return null;
      }

      // Get the native device push token (FCM on Android, APNs on iOS).
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      this.pushToken = devicePushToken.data as string;

      logger.info({
        message: 'Push notification token obtained',
        context: {
          token: this.pushToken,
          userId,
          platform: Platform.OS,
        },
      });

      // Register device with backend (user-scoped — the IC app has no unit context).
      // Source "IC" routes the Novu credential update to the IC-specific subscriber, keeping the inbox separate from the Responder app.
      await registerDevice({
        UserId: userId,
        Token: this.pushToken || '',
        Platform: Platform.OS === 'ios' ? 1 : 2,
        DeviceUuid: getDeviceUuid() || '',
        Prefix: departmentCode,
        Source: 'IC',
      });

      return this.pushToken;
    } catch (error) {
      logger.warn({
        message: 'Error registering for push notifications',
        context: { error },
      });
      return null;
    }
  }

  public getPushToken(): string | null {
    return this.pushToken;
  }

  public cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }

    if (this.notifeeForegroundUnsubscribe) {
      this.notifeeForegroundUnsubscribe();
      this.notifeeForegroundUnsubscribe = null;
    }
  }
}

/**
 * Shared check-in action handler for foreground and background notifee events.
 * Never throws: a rejected promise inside a notifee event handler is an
 * unhandled rejection that can kill the headless background task.
 */
const handleCheckInActionFromEvent = async (): Promise<void> => {
  try {
    logger.info({ message: 'Check-in action pressed from notification' });
    const activeCall = useCoreStore.getState().activeCall;
    if (!activeCall) {
      return;
    }

    const callId = parseInt(activeCall.CallId, 10);
    if (Number.isNaN(callId)) {
      logger.error({ message: 'Check-in action aborted: invalid CallId', context: { CallId: activeCall.CallId } });
      return;
    }

    // performCheckIn queues the event offline when the network request fails
    await useCheckInTimerStore.getState().performCheckIn({
      CallId: callId,
      CheckInType: CHECK_IN_TYPE_PERSONNEL,
      Latitude: useLocationStore.getState().latitude?.toString(),
      Longitude: useLocationStore.getState().longitude?.toString(),
    });
  } catch (error) {
    logger.error({
      message: 'Check-in action failed',
      context: { error },
    });
  }
};

// Notifee requires the background event handler to be registered at module
// scope: when the app is killed, only the headless JS task runs and
// initialize() is never called, so a registration inside initialize() would
// never fire for action presses from the killed state.
if (Platform.OS !== 'web') {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'check-in') {
      await handleCheckInActionFromEvent();
    }

    // Tapping a notifee-displayed notification from the background/killed state.
    // routerPushWithRetry waits for the router to mount and the session to hydrate,
    // so deep-linking here is safe even on a cold start.
    if (type === EventType.PRESS) {
      const eventCode = detail.notification?.data?.eventCode;
      if (typeof eventCode === 'string') {
        if (await handleChatDeepLink(eventCode)) {
          return;
        }
        await handleCallDeepLink(eventCode);
      }
    }
  });
}

export const pushNotificationService = PushNotificationService.getInstance();

// React hook for component usage
export const usePushNotifications = () => {
  const userId = useAuthStore((state) => state.userId);
  const rights = securityStore((state) => state.rights);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Push notifications are native-only; skip on web
    if (Platform.OS === 'web') return;

    // Only register if we have a signed-in user ID and it's different from the previous one
    if (rights && userId && userId !== previousUserIdRef.current) {
      pushNotificationService
        .registerForPushNotifications(userId, rights.DepartmentCode)
        .then((token) => {
          if (token) {
            logger.info({
              message: 'Successfully registered for push notifications',
              context: { userId },
            });
          }
        })
        .catch((error) => {
          logger.error({
            message: 'Error in push notification registration hook',
            context: { error },
          });
        });

      previousUserIdRef.current = userId;
    }

    // Cleanup function
    return () => {
      // No need to clean up here as the service handles its own cleanup
    };
  }, [userId, rights]);

  return {
    pushToken: pushNotificationService.getPushToken(),
  };
};
