/**
 * App initialization must wait for the data-protection capabilities, not only the feature flags,
 * before it connects the realtime hubs.
 *
 * 1e485b7 ("RG-T89 ADP Support") wrote the two fetches as a comma expression,
 * `await fetchFlags(), fetchCapabilities();`, which awaits only the first. The capabilities fetch
 * then floated: initialization carried on to the SignalR connects without it, and a rejection from
 * it bypassed the layout's error handling and retry entirely.
 *
 * These tests render the real layout with its dependency graph stubbed, so they fail if either
 * fetch stops being awaited again.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@novu/react-native', () => ({
  NovuProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const MockReact = require('react');
  return {
    Redirect: () => MockReact.createElement('Redirect'),
    SplashScreen: { hideAsync: jest.fn().mockResolvedValue(undefined) },
    Tabs: Object.assign(() => null, { Screen: () => null }),
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
    usePathname: () => '/',
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/common/offline-status-toast', () => ({ OfflineStatusToast: () => null }));
jest.mock('@/components/data-protection/step-up-prompt-host', () => ({ StepUpPromptHost: () => null }));
jest.mock('@/components/mfa/recovery-codes-modal', () => ({ RecoveryCodesModal: () => null }));
jest.mock('@/components/notifications/NotificationButton', () => ({ NotificationButton: () => null }));
jest.mock('@/components/notifications/NotificationInbox', () => ({ NotificationInbox: () => null }));
jest.mock('@/components/shared-session/shared-session-bar', () => ({ SharedSessionBar: () => null }));
jest.mock('@/components/shared-session/shared-session-lock-screen', () => ({ SharedSessionLockScreen: () => null }));
jest.mock('@/components/sidebar/sidebar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui', () => {
  const MockReact = require('react');
  return {
    FocusAwareStatusBar: () => null,
    View: ({ children }: { children?: React.ReactNode }) => MockReact.createElement('View', null, children),
  };
});
jest.mock('@/components/ui/button', () => ({ Button: () => null, ButtonText: () => null }));
jest.mock('@/components/ui/icon', () => ({ Icon: () => null }));
jest.mock('@/components/ui/pressable', () => ({ Pressable: () => null }));
jest.mock('@/components/ui/side-drawer', () => ({ SideDrawer: () => null }));
jest.mock('@/components/ui/text', () => ({ Text: () => null }));

jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@/hooks/use-app-lifecycle', () => ({ useAppLifecycle: () => ({ isActive: true, appState: 'active' }) }));
jest.mock('@/hooks/use-shared-session-lifecycle', () => ({
  useSharedSessionLifecycle: () => ({ onTouchCapture: () => false, locked: false, shared: false }),
}));
jest.mock('@/hooks/use-signalr-lifecycle', () => ({ useSignalRLifecycle: jest.fn() }));

const mockAuthState = { status: 'signedIn', userId: 'user-1' };
jest.mock('@/lib/auth', () => ({
  useAuthStore: <T,>(selector: (state: typeof mockAuthState) => T) => selector(mockAuthState),
}));
jest.mock('@/lib/auth/command-app-access', () => ({ enforceCommandAppAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/storage', () => ({ useIsFirstTime: () => [false, jest.fn()] }));

jest.mock('@/services/audio.service', () => ({ audioService: { initialize: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/services/bluetooth-audio.service', () => ({ bluetoothAudioService: { initialize: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/services/push-notification', () => ({ usePushNotifications: jest.fn() }));

const mockCoreState = { init: jest.fn().mockResolvedValue(undefined), fetchConfig: jest.fn().mockResolvedValue(undefined), config: null };
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: Object.assign(<T,>(selector: (state: typeof mockCoreState) => T) => selector(mockCoreState), { getState: () => mockCoreState }),
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: { getState: () => ({ init: jest.fn().mockResolvedValue(undefined), fetchCalls: jest.fn().mockResolvedValue(undefined) }) },
}));
jest.mock('@/stores/command/store', () => ({
  useCommandStore: { getState: () => ({ syncFromServer: jest.fn().mockResolvedValue(undefined) }) },
}));
jest.mock('@/stores/roles/store', () => ({
  useRolesStore: { getState: () => ({ init: jest.fn().mockResolvedValue(undefined), fetchRoles: jest.fn().mockResolvedValue(undefined) }) },
}));
jest.mock('@/stores/weather-alerts/store', () => ({
  useWeatherAlertsStore: { getState: () => ({ init: jest.fn().mockResolvedValue(undefined), fetchActiveAlerts: jest.fn().mockResolvedValue(undefined) }) },
}));

const mockSecurityState = { getRights: jest.fn().mockResolvedValue(undefined), rights: null };
jest.mock('@/stores/security/store', () => ({
  securityStore: Object.assign(<T,>(selector: (state: typeof mockSecurityState) => T) => selector(mockSecurityState), { getState: () => mockSecurityState }),
}));

const mockFetchFlags = jest.fn<Promise<void>, []>();
jest.mock('@/stores/feature-flags/store', () => ({
  FeatureFlagKeys: { ChatSystem: 'Chat.System' },
  featureFlagsStore: { getState: () => ({ fetchFlags: mockFetchFlags, isEnabled: () => false }) },
}));

const mockFetchCapabilities = jest.fn<Promise<void>, []>();
jest.mock('@/stores/data-protection/store', () => ({
  dataProtectionStore: { getState: () => ({ fetchCapabilities: mockFetchCapabilities }) },
}));

const mockConnectUpdateHub = jest.fn().mockResolvedValue(undefined);
const mockConnectGeolocationHub = jest.fn().mockResolvedValue(undefined);
jest.mock('@/stores/signalr/signalr-store', () => ({
  useSignalRStore: {
    getState: () => ({ connectUpdateHub: mockConnectUpdateHub, connectGeolocationHub: mockConnectGeolocationHub, connectChatHub: jest.fn() }),
  },
}));

import { logger } from '@/lib/logging';

import TabLayout from '../_layout';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Lets every already-settled step of initialization run, so only a genuinely pending await can hold it. */
const flushInitialization = () =>
  act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });

describe('app initialization awaits the feature flags and data-protection capabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchFlags.mockResolvedValue(undefined);
    mockFetchCapabilities.mockResolvedValue(undefined);
  });

  it.each([
    ['feature flags', mockFetchFlags],
    ['data-protection capabilities', mockFetchCapabilities],
  ])('does not connect the hubs while the %s are still loading', async (_name, fetch) => {
    const pending = deferred();
    fetch.mockReturnValue(pending.promise);

    render(<TabLayout />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    await flushInitialization();
    expect(mockConnectUpdateHub).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve();
    });

    await waitFor(() => {
      expect(mockConnectUpdateHub).toHaveBeenCalledTimes(1);
    });
  });

  it('routes a failed capabilities fetch into initialization error handling', async () => {
    mockFetchCapabilities.mockRejectedValue(new Error('capabilities unavailable'));

    render(<TabLayout />);

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to initialize app' }));
    });
    expect(mockConnectUpdateHub).not.toHaveBeenCalled();
  });
});
