/* eslint-disable react/no-unstable-nested-components */

import { NovuProvider } from '@novu/react-native';
import Countly from 'countly-sdk-react-native-bridge';
import * as NavigationBar from 'expo-navigation-bar';
import { Redirect, router, SplashScreen, Tabs, usePathname } from 'expo-router';
import { ArrowLeft, ClipboardList, CloudAlert, LayoutDashboard, Map, Megaphone, Menu, Navigation, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, type ColorValue, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineStatusToast } from '@/components/common/offline-status-toast';
import { NotificationButton } from '@/components/notifications/NotificationButton';
import { NotificationInbox } from '@/components/notifications/NotificationInbox';
import Sidebar from '@/components/sidebar/sidebar';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { SideDrawer } from '@/components/ui/side-drawer';
import { Text } from '@/components/ui/text';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useSignalRLifecycle } from '@/hooks/use-signalr-lifecycle';
import { getAppHeaderHeight } from '@/lib/app-shell-layout';
import { useAuthStore } from '@/lib/auth';
import { enforceCommandAppAccess } from '@/lib/auth/command-app-access';
import { logger } from '@/lib/logging';
import { getMapsHeaderState } from '@/lib/maps-route';
import { useIsFirstTime } from '@/lib/storage';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { audioService } from '@/services/audio.service';
import { bluetoothAudioService } from '@/services/bluetooth-audio.service';
import { usePushNotifications } from '@/services/push-notification';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useCommandStore } from '@/stores/command/store';
import { FeatureFlagKeys, featureFlagsStore } from '@/stores/feature-flags/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';
import { useWeatherAlertsStore } from '@/stores/weather-alerts/store';

export default function TabLayout() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.userId);
  const [isFirstTime, _setIsFirstTime] = useIsFirstTime();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isInitComplete, setIsInitComplete] = useState(false);
  const [initRetryCount, setInitRetryCount] = useState(0);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  const pathname = usePathname();
  const mapsHeaderState = useMemo(() => getMapsHeaderState(pathname), [pathname]);
  const { isActive, appState } = useAppLifecycle();
  const { trackEvent } = useAnalytics();

  // Identify user in Countly when signed in
  useEffect(() => {
    if (status === 'signedIn' && userId) {
      try {
        Countly.setUserData({ custom: { id: userId } });
      } catch {
        // Countly may not be initialized (e.g., no app key configured) — ignore
      }
    }
  }, [status, userId]);

  // Hide the Android system navigation bar so it doesn't cover the tab bar.
  // The app runs edge-to-edge (react-native-edge-to-edge), so the nav bar overlays
  // content by default. We hide it on mount and re-hide it via a listener whenever
  // the map (or any other view) causes Android to show it again.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setVisibilityAsync('hidden');
    const subscription = NavigationBar.addVisibilityListener(({ visibility }) => {
      if (visibility === 'visible') {
        NavigationBar.setVisibilityAsync('hidden');
      }
    });
    return () => subscription.remove();
  }, []);

  // Refs to track initialization state
  const hasInitialized = useRef(false);
  const isInitializing = useRef(false);
  // Bumped on every initialization start and whenever the session ends. An in-flight run
  // compares its captured value after each await, so a run belonging to a session that is
  // over can no longer connect hubs or mark the app initialized.
  const initGeneration = useRef(0);
  const hasHiddenSplash = useRef(false);
  const parentRef = useRef(null);

  // Render counting for diagnostics (web only)
  const renderCount = useRef(0);
  renderCount.current += 1;
  if (__DEV__ && Platform.OS === 'web' && renderCount.current % 50 === 0) {
    console.warn(`[TabLayout] render #${renderCount.current}`, {
      status,
      isInitComplete,
      isOpen,
      isLandscape,
    });
  }

  const hideSplash = useCallback(async () => {
    if (hasHiddenSplash.current) return;

    try {
      await SplashScreen.hideAsync();
      hasHiddenSplash.current = true;
      logger.info({
        message: 'Splash screen hidden',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to hide splash screen',
        context: { error },
      });
    }
  }, []);

  // Initialize push notifications
  usePushNotifications();

  // Track when home view is rendered (debounced - don't fire on every resize)
  const lastTrackRef = useRef(0);
  useEffect(() => {
    if (status === 'signedIn') {
      const now = Date.now();
      if (now - lastTrackRef.current > 5000) {
        lastTrackRef.current = now;
        trackEvent('home_view_rendered', {
          isLandscape: isLandscape,
          screenWidth: width,
          screenHeight: height,
        });
      }
    }
  }, [status, trackEvent, isLandscape, width, height]);

  const initializeApp = useCallback(async () => {
    if (isInitializing.current) {
      logger.info({
        message: 'App initialization already in progress, skipping',
      });
      return;
    }

    if (status !== 'signedIn') {
      logger.info({
        message: 'User not signed in, skipping initialization',
        context: { status },
      });
      return;
    }

    isInitializing.current = true;
    const generation = (initGeneration.current += 1);
    const isCurrentRun = () => initGeneration.current === generation;
    logger.info({
      message: 'Starting app initialization',
      context: {
        hasInitialized: hasInitialized.current,
      },
    });

    try {
      // Initialize core app data (init() calls fetchConfig() internally)
      await useCoreStore.getState().init();
      await useRolesStore.getState().init();
      await useCallsStore.getState().init();
      await useWeatherAlertsStore.getState().init();
      await securityStore.getState().getRights();

      // An unauthorized member is toasted and signed out here rather than left in an app that would
      // fail every board request; see enforceCommandAppAccess.
      if (!isCurrentRun()) return;
      if (await enforceCommandAppAccess({ deniedMessage: t('login.command_not_authorized'), userId })) {
        return;
      }

      await featureFlagsStore.getState().fetchFlags();

      if (!isCurrentRun()) return;

      await useSignalRStore.getState().connectUpdateHub();
      await useSignalRStore.getState().connectGeolocationHub();

      if (!isCurrentRun()) return;

      // Connect the realtime chat hub (best-effort; chat may be disabled per department)
      if (featureFlagsStore.getState().isEnabled(FeatureFlagKeys.ChatSystem)) {
        try {
          await useSignalRStore.getState().connectChatHub();
          logger.info({ message: 'SignalR chat hub connected successfully' });
        } catch (chatError) {
          logger.warn({ message: 'Failed to connect SignalR chat hub during initialization', context: { error: chatError } });
        }
      } else {
        logger.info({ message: 'Chat disabled by feature flag; skipping chat hub connection' });
      }

      // Hydrate incident-command boards from the server Sync Bundle (best-effort; offline-safe)
      useCommandStore
        .getState()
        .syncFromServer()
        .catch(() => {});

      if (!isCurrentRun()) return;

      hasInitialized.current = true;

      // Initialize Bluetooth and Audio services (native-only)
      if (Platform.OS !== 'web') {
        await bluetoothAudioService.initialize();
        await audioService.initialize();
      }

      logger.info({
        message: 'App initialization completed successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize app',
        context: { error },
      });
      // A run whose session already ended must not burn the retry budget or clobber
      // state a newer run has since established.
      if (!isCurrentRun()) return;

      // Reset initialization state on error so it can be retried
      hasInitialized.current = false;
      setInitRetryCount((c) => c + 1);
    } finally {
      // Only the current run owns the guard; a superseded run clearing it would let two
      // initializations overlap.
      if (isCurrentRun()) {
        isInitializing.current = false;
        setIsInitComplete(true);
      }
    }
  }, [status, t, userId]);

  const refreshDataFromBackground = useCallback(async () => {
    if (status !== 'signedIn' || !hasInitialized.current) return;

    logger.info({
      message: 'App resumed from background, refreshing data',
    });

    try {
      // Refresh data
      await Promise.all([
        useCoreStore.getState().fetchConfig(),
        useCallsStore.getState().fetchCalls(),
        useRolesStore.getState().fetchRoles(),
        useWeatherAlertsStore.getState().fetchActiveAlerts(),
        useCommandStore.getState().syncFromServer(),
      ]);
    } catch (error) {
      logger.warn({
        message: 'Failed to refresh data on app resume',
        context: { error },
      });
    }
  }, [status]);

  // Handle SignalR lifecycle management
  useSignalRLifecycle({
    isSignedIn: status === 'signedIn',
    hasInitialized: hasInitialized.current,
  });

  // Handle splash screen hiding
  useEffect(() => {
    if (status !== 'idle' && !hasHiddenSplash.current) {
      const timer = setTimeout(() => {
        hideSplash();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [status, hideSplash]);

  // Handle app initialization - simplified logic
  const MAX_INIT_RETRIES = 3;
  useEffect(() => {
    if (status === 'signedIn') return;

    // Leaving the signed-in state retires any initialization still in flight, and frees
    // the guard it no longer owns so the next sign-in is not skipped as "already
    // initializing".
    initGeneration.current += 1;
    isInitializing.current = false;

    if (initRetryCount > 0) {
      setInitRetryCount(0);
    }
  }, [status, initRetryCount]);
  useEffect(() => {
    const shouldInitialize = status === 'signedIn' && !hasInitialized.current && !isInitializing.current && initRetryCount < MAX_INIT_RETRIES;

    if (shouldInitialize) {
      logger.info({
        message: 'Triggering app initialization',
        context: {
          hasInitialized: hasInitialized.current,
          initRetryCount,
        },
      });
      initializeApp();
    }
  }, [status, initializeApp, initRetryCount]);

  // Handle app resuming from background - separate from initialization
  useEffect(() => {
    // On web, isActive/appState are always active — skip the initial fire
    // and only trigger on genuine state changes (i.e., on native background→foreground)
    if (Platform.OS === 'web') return;

    if (isActive && appState === 'active') {
      const timer = setTimeout(() => {
        if (hasInitialized.current) {
          // Normal refresh after successful init
          refreshDataFromBackground();
        } else if (!isInitializing.current) {
          // Retry initialization if it previously failed
          logger.info({ message: 'Retrying app initialization after returning to foreground' });
          initializeApp();
        }
      }, 500); // Small delay to prevent multiple rapid calls

      return () => clearTimeout(timer);
    }
  }, [isActive, appState, refreshDataFromBackground, initializeApp]);

  // Get user ID and config for notifications
  const config = useCoreStore((state) => state.config);
  const rights = securityStore((state) => state.rights);

  // Compute Novu readiness once for consistent gating across the render
  const novuReady = !!(userId && config?.NovuApplicationId && config?.NovuBackendApiUrl && config?.NovuSocketUrl && rights?.DepartmentCode);
  // Cache the last known-good Novu config so NovuProvider stays mounted stably
  // even if a transient state update briefly nullifies one of the values.
  const lastNovuConfig = useRef<{
    subscriberId: string;
    applicationIdentifier: string;
    backendUrl: string;
    socketUrl: string;
  } | null>(null);
  if (novuReady) {
    lastNovuConfig.current = {
      subscriberId: `${rights?.DepartmentCode}_IC_User_${userId}`,
      applicationIdentifier: config!.NovuApplicationId,
      backendUrl: config!.NovuBackendApiUrl,
      socketUrl: config!.NovuSocketUrl,
    };
  }

  // Memoize screen options to prevent new objects every render
  const screenOptions = React.useMemo(
    () => ({
      headerShown: true,
      headerStatusBarHeight: insets.top,
      headerStyle: {
        height: getAppHeaderHeight(insets.top, isLandscape),
      },
      tabBarShowLabel: true,
      tabBarIconStyle: {
        width: 24,
        height: 24,
      },
      tabBarLabelStyle: {
        fontSize: isLandscape ? 12 : 10,
        fontWeight: '500' as const,
      },
      tabBarStyle: {
        paddingBottom: Math.max(insets.bottom, 5),
        paddingTop: 5,
        height: isLandscape ? 65 : Math.max(60 + insets.bottom, 60),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 100,
        backgroundColor: 'transparent',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
      },
    }),
    [isLandscape, insets.bottom, insets.top]
  );

  // Memoize header callbacks to prevent new function refs every render
  const handleOpenDrawer = useCallback(() => setIsOpen(true), []);
  const handleCloseDrawer = useCallback(() => setIsOpen(false), []);
  const handleOpenNotifications = useCallback(() => setIsNotificationsOpen(true), []);
  const handleCloseNotifications = useCallback(() => setIsNotificationsOpen(false), []);

  // Memoize per-screen tab bar icon renderers to prevent new functions every render
  const mapIcon = useCallback(({ color }: { color: ColorValue }) => <Icon as={Map} stroke={color as string} className="text-primary-500 dark:text-primary-400" />, []);
  const callsIcon = useCallback(({ color }: { color: ColorValue }) => <Icon as={Megaphone} stroke={color as string} className="text-primary-500 dark:text-primary-400" />, []);
  const incidentsIcon = useCallback(({ color }: { color: ColorValue }) => <Icon as={LayoutDashboard} stroke={color as string} className="text-primary-500 dark:text-primary-400" />, []);
  const commandIcon = useCallback(({ color }: { color: ColorValue }) => <Icon as={ClipboardList} stroke={color as string} className="text-primary-500 dark:text-primary-400" />, []);
  const routesIcon = useCallback(({ color }: { color: ColorValue }) => <Icon as={Navigation} stroke={color as string} className="text-primary-500 dark:text-primary-400" />, []);
  const weatherAlertsIcon = useCallback(({ color }: { color: ColorValue }) => <Icon as={CloudAlert} stroke={color as string} className="text-primary-500 dark:text-primary-400" />, []);
  const settingsIcon = useCallback(({ color }: { color: ColorValue }) => <Icon as={Settings} stroke={color as string} />, []);

  // Memoize header left/right renders
  const headerLeftMap = useCallback(() => <CreateDrawerMenuButton setIsOpen={setIsOpen} />, []);
  const headerLeftBack = useCallback(() => <CreateHeaderBackButton />, []);
  const headerRightNotification = useCallback(
    () => <CreateNotificationButton config={config} setIsNotificationsOpen={handleOpenNotifications} userId={userId} departmentCode={rights?.DepartmentCode} />,
    [config, handleOpenNotifications, userId, rights?.DepartmentCode]
  );

  // Memoize per-screen options to prevent new objects every render
  const indexOptions = useMemo(
    () => ({
      title: t('tabs.map'),
      tabBarIcon: mapIcon,
      headerLeft: headerLeftMap,
      tabBarButtonTestID: 'map-tab' as const,
      headerRight: headerRightNotification,
    }),
    [t, mapIcon, headerLeftMap, headerRightNotification]
  );

  const callsOptions = useMemo(
    () => ({
      title: t('tabs.calls'),
      headerShown: true as const,
      tabBarIcon: callsIcon,
      tabBarButtonTestID: 'calls-tab' as const,
      headerLeft: headerLeftMap,
      headerRight: headerRightNotification,
    }),
    [t, callsIcon, headerLeftMap, headerRightNotification]
  );

  const commandOptions = useMemo(
    () => ({
      title: t('tabs.command_board'),
      headerShown: true as const,
      tabBarIcon: commandIcon,
      tabBarButtonTestID: 'command-tab' as const,
      headerLeft: headerLeftMap,
      headerRight: headerRightNotification,
    }),
    [t, commandIcon, headerLeftMap, headerRightNotification]
  );

  const incidentsOptions = useMemo(
    () => ({
      title: t('tabs.incidents'),
      headerShown: true as const,
      tabBarIcon: routesIcon,
      tabBarButtonTestID: 'routes-tab' as const,
      headerLeft: headerLeftMap,
      headerRight: headerRightNotification,
    }),
    [t, routesIcon, headerLeftMap, headerRightNotification]
  );

  // weather-alerts is kept (relevant to IC scene safety) but HIDDEN from the tab bar (href: null);
  // it is reachable from the map-home weather banner. IC shell tabs: Map, Calls, Settings.
  const weatherAlertsOptions = useMemo(
    () => ({
      href: null,
      title: t('tabs.weather_alerts'),
      headerShown: true as const,
      tabBarIcon: weatherAlertsIcon,
      tabBarButtonTestID: 'weather-alerts-tab' as const,
      headerLeft: headerLeftMap,
      headerRight: headerRightNotification,
    }),
    [t, weatherAlertsIcon, headerLeftMap, headerRightNotification]
  );

  // The Maps browser is a hidden tab route so its entire nested stack retains the
  // authenticated app shell. The landing page gets the drawer menu; child routes
  // get a back button while the tab bar remains available.
  const mapsOptions = useMemo(
    () => ({
      href: null,
      title: t(mapsHeaderState.titleKey),
      headerShown: true as const,
      headerLeft: mapsHeaderState.showMenu ? headerLeftMap : headerLeftBack,
      headerRight: headerRightNotification,
    }),
    [t, mapsHeaderState, headerLeftMap, headerLeftBack, headerRightNotification]
  );

  // POI detail renders inside the tab shell (app header + tab bar stay visible) but has no tab
  // bar entry of its own; the header shows a back button instead of the drawer menu.
  const poiDetailOptions = useMemo(
    () => ({
      href: null,
      title: t('routes.poi_detail'),
      headerShown: true as const,
      headerLeft: headerLeftBack,
      headerRight: headerRightNotification,
    }),
    [t, headerLeftBack, headerRightNotification]
  );

  // chat + chatbot are routable (sidebar menu links) but hidden from the tab bar (href: null).
  // They keep the app header: it is the only way back out, since neither is on the tab bar and
  // their in-screen toolbars carry actions rather than navigation.
  const chatOptions = useMemo(
    () => ({
      href: null,
      title: t('chat.title'),
      headerShown: true as const,
      headerLeft: headerLeftMap,
      headerRight: headerRightNotification,
    }),
    [t, headerLeftMap, headerRightNotification]
  );

  const chatbotOptions = useMemo(
    () => ({
      href: null,
      title: t('chatbot.title'),
      headerShown: true as const,
      headerLeft: headerLeftMap,
      headerRight: headerRightNotification,
    }),
    [t, headerLeftMap, headerRightNotification]
  );

  // settings stays routable (sidebar menu link) but is hidden from the tab bar.
  const settingsOptions = useMemo(
    () => ({
      href: null,
      title: t('tabs.settings'),
      headerShown: true as const,
      tabBarIcon: settingsIcon,
      tabBarButtonTestID: 'settings-tab' as const,
      headerLeft: headerLeftMap,
      headerRight: headerRightNotification,
    }),
    [t, settingsIcon, headerLeftMap, headerRightNotification]
  );

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  // Guard against rendering full UI before auth state is determined
  if (status !== 'signedIn') {
    return <Redirect href="/login" />;
  }

  const content = (
    <View style={styles.container} pointerEvents="box-none">
      {/* Loading overlay during initialization — shown on top of Tabs so the navigator stays mounted */}
      {!isInitComplete ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}
      <View className="flex-1 flex-row" ref={parentRef}>
        {/* Drawer renders after init to avoid heavy re-renders during store settling.
            The menu is always a hamburger-toggled drawer — no persistent panel on tablets. */}
        {isInitComplete ? (
          <SideDrawer isOpen={isOpen} onClose={handleCloseDrawer} testID="app-side-drawer">
            <Sidebar onClose={handleCloseDrawer} />
          </SideDrawer>
        ) : null}

        {/* Main content area */}
        <View className="w-full flex-1">
          {isInitComplete ? <OfflineStatusToast /> : null}
          <Tabs screenOptions={screenOptions}>
            <Tabs.Screen name="index" options={indexOptions} />

            <Tabs.Screen name="calls" options={callsOptions} />

            <Tabs.Screen name="command" options={commandOptions} />

            {/* incidents, weather-alerts, and settings are registered so their route files resolve;
                hidden entries use href: null in their options — reachable via the sidebar menu.
                IC shell shows: Map, Calls, Command Board. */}
            <Tabs.Screen name="incidents" options={incidentsOptions} />

            {/* weather-alerts is registered so its route file resolves, but hidden from the
                tab bar (href: null). IC shell shows: Map, Calls, Settings. */}
            <Tabs.Screen name="weather-alerts" options={weatherAlertsOptions} />

            <Tabs.Screen name="maps" options={mapsOptions} />

            <Tabs.Screen name="settings" options={settingsOptions} />

            {/* chat + chatbot are hidden tab routes (href: null) reachable via the sidebar menu. */}
            <Tabs.Screen name="chat" options={chatOptions} />

            <Tabs.Screen name="chatbot" options={chatbotOptions} />

            <Tabs.Screen name="poi/[id]" options={poiDetailOptions} />
          </Tabs>

          {/* NotificationInbox positioned within the tab content area — only after init and Novu is ready */}
          {isInitComplete && novuReady && <NotificationInbox isOpen={isNotificationsOpen} onClose={handleCloseNotifications} />}
        </View>
      </View>
    </View>
  );

  // Keep NovuProvider mounted once it has been initialized to avoid full tree
  // unmount/remount. We use the cached config so even if novuReady briefly goes
  // false during a config re-fetch, the provider stays up with last-good props.
  if (lastNovuConfig.current) {
    return (
      <NovuProvider
        subscriberId={lastNovuConfig.current.subscriberId}
        applicationIdentifier={lastNovuConfig.current.applicationIdentifier}
        backendUrl={lastNovuConfig.current.backendUrl}
        socketUrl={lastNovuConfig.current.socketUrl}
      >
        {content}
      </NovuProvider>
    );
  }

  return content;
}

interface CreateDrawerMenuButtonProps {
  setIsOpen: (isOpen: boolean) => void;
}

const CreateDrawerMenuButton = ({ setIsOpen }: CreateDrawerMenuButtonProps) => {
  const { t } = useTranslation();

  return (
    <Pressable
      className="p-3"
      hitSlop={8}
      testID="drawer-menu-button"
      accessibilityRole="button"
      accessibilityLabel={t('sidebar.menu')}
      onPress={() => {
        setIsOpen(true);
      }}
    >
      {/* Routed through the Icon wrapper, not a bare lucide element: className alone never reaches a
          raw lucide icon (no cssInterop is registered for them), so it falls back to currentColor and
          renders solid black — invisible against a dark header. */}
      <Icon as={Menu} size={24} className="text-gray-700 dark:text-gray-200" />
    </Pressable>
  );
};

const CreateHeaderBackButton = () => {
  const { t } = useTranslation();

  return (
    <Pressable
      className="p-3"
      hitSlop={8}
      testID="header-back-button"
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }}
    >
      <Icon as={ArrowLeft} size={24} className="text-gray-700 dark:text-gray-200" />
    </Pressable>
  );
};

const CreateNotificationButton = ({
  config,
  setIsNotificationsOpen,
  userId,
  departmentCode,
}: {
  config: GetConfigResultData | null;
  setIsNotificationsOpen: () => void;
  userId: string | null;
  departmentCode: string | undefined;
}) => {
  if (!userId || !config || !config.NovuApplicationId || !config.NovuBackendApiUrl || !config.NovuSocketUrl || !departmentCode) {
    return null;
  }

  // No NovuProvider here — the outer NovuProvider in TabLayout already wraps everything,
  // so NotificationButton can access Novu context directly. This avoids creating 5 duplicate
  // socket.io connections (one per tab header).
  return <NotificationButton onPress={setIsNotificationsOpen} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#ffffff' : undefined,
  },
  loadingOverlay: {
    ...(StyleSheet.absoluteFill as object),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#ffffff' : 'rgba(255,255,255,0.95)',
    zIndex: 1000,
  },
});
