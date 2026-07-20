import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { useWindowDimensions } from 'react-native';

import { useAnalytics } from '@/hooks/use-analytics';
import { useCoreStore } from '@/stores/app/core-store';
import { useCommandStore } from '@/stores/command/store';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';
import { securityStore } from '@/stores/security/store';

import CallDetail from '../[id]';



// Mock UI components that might use NativeWind
jest.mock('@/components/command/start-command-sheet', () => ({
  StartCommandSheet: () => null,
}));

jest.mock('@/components/ui', () => ({
  FocusAwareStatusBar: jest.fn().mockImplementation(() => null),
  SafeAreaView: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/box', () => ({
  Box: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/button', () => ({
  Button: jest.fn().mockImplementation(({ children, onPress, disabled, ...props }) => {
    const React = require('react');

    return React.createElement('button', {
      onPress,
      onClick: onPress, // For web compatibility
      disabled,
      accessibilityRole: 'button',
      accessibilityLabel: React.Children.toArray(children).map((child: any) =>
        typeof child === 'string' ? child :
          child?.props?.children || ''
      ).join(' '),
      testID: `button-${React.Children.toArray(children).map((child: any) =>
        typeof child === 'string' ? child :
          child?.props?.children || ''
      ).join(' ').toLowerCase().replace(/\s+/g, '-')}`,
      ...props
    }, children);
  }),
  ButtonIcon: jest.fn().mockImplementation(() => null),
  ButtonText: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/shared-tabs', () => ({
  SharedTabs: jest.fn().mockImplementation(({ tabs }) => {
    const React = require('react');
    const { View } = require('react-native');

    // Render the first tab's content by default
    const firstTabContent = tabs && tabs.length > 0 ? tabs[0].content : null;
    return React.createElement(View, {}, firstTabContent);
  }),
}));

jest.mock('@/components/ui/text', () => ({
  Text: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: jest.fn().mockImplementation(({ children }) => children),
}));

// Type the mock
const mockUseWindowDimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

// Mock expo-constants first before any other imports
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      IS_MOBILE_APP: "true",
    },
  },
  default: {
    expoConfig: {
      extra: {
        IS_MOBILE_APP: "true",
      },
    },
  },
}));

// Mock @env to prevent expo-constants issues
jest.mock('@env', () => ({
  Env: {
    IS_MOBILE_APP: "true",
  },
}));

// Mock axios
jest.mock('axios', () => {
  const axiosMock: any = {
    create: jest.fn(() => axiosMock),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  };
  return axiosMock;
});

// Mock query-string
jest.mock('query-string', () => ({
  stringify: jest.fn((obj) => Object.keys(obj).map(key => `${key}=${obj[key]}`).join('&')),
}));

// Mock auth store
jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      status: 'signedIn',
      error: null,
    })),
    setState: jest.fn(),
  },
}));

// Mock storage modules
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.mock.com'),
}));

jest.mock('@/lib/storage', () => ({
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock all the dependencies
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({
    back: jest.fn(),
    push: jest.fn(),
  })),
}));

// Mock Lucide React Native icons
jest.mock('lucide-react-native', () => ({
  ClockIcon: 'ClockIcon',
  FileTextIcon: 'FileTextIcon',
  ImageIcon: 'ImageIcon',
  InfoIcon: 'InfoIcon',
  PaperclipIcon: 'PaperclipIcon',
  RouteIcon: 'RouteIcon',
  UserIcon: 'UserIcon',
  UsersIcon: 'UsersIcon',
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Path: 'Path',
  G: 'G',
  Circle: 'Circle',
  Rect: 'Rect',
  default: 'Svg',
  SvgXml: 'SvgXml',
  __esModule: true,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn(() => '2024-01-01 12:00'),
}));

// Mock HtmlRenderer
jest.mock('@/components/ui/html-renderer', () => ({
  __esModule: true,
  HtmlRenderer: 'HtmlRenderer',
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: jest.fn(),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

jest.mock('@/stores/command/store', () => ({
  useCommandStore: jest.fn(),
}));

jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: jest.fn(),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn(),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn(),
}));

jest.mock('@/stores/security/store', () => ({
  securityStore: jest.fn(),
}));

jest.mock('../../../components/calls/call-detail-menu', () => ({
  useCallDetailMenu: jest.fn(() => ({
    HeaderRightMenu: () => null,
    CallDetailActionSheet: () => null,
  })),
}));

jest.mock('../../../components/calls/call-files-modal', () => {
  return function CallFilesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/call-images-modal', () => {
  return function CallImagesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/call-notes-modal', () => {
  return function CallNotesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/close-call-bottom-sheet', () => ({
  CloseCallBottomSheet: () => null,
}));

jest.mock('@/components/maps/static-map', () => {
  return function StaticMap() {
    return null;
  };
});

jest.mock('@/components/check-in-timers/check-in-tab-content', () => ({
  CheckInTabContent: () => null,
}));

jest.mock('@/components/call-video-feeds/video-feed-tab-content', () => ({
  VideoFeedTabContent: () => null,
}));

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: jest.fn((selector: any) =>
    selector({
      timerStatuses: [],
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
      reset: jest.fn(),
    })
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// React Native mocks
jest.mock('react-native', () => ({
  View: jest.fn().mockImplementation(({ children, ...props }) => children),
  Text: jest.fn().mockImplementation(({ children }) => children),
  ScrollView: jest.fn().mockImplementation(({ children }) => children),
  ActivityIndicator: jest.fn().mockImplementation(() => null),
  StatusBar: {
    setBackgroundColor: jest.fn(),
    setTranslucent: jest.fn(),
    setBarStyle: jest.fn(),
    setHidden: jest.fn(),
  },
  useWindowDimensions: jest.fn(() => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
  })),
  Dimensions: {
    get: jest.fn(() => ({
      width: 375,
      height: 812,
      scale: 3,
      fontScale: 1,
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn(options => options.ios),
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(style => style),
  },
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addEventListener: jest.fn((eventType, callback) => ({
      remove: jest.fn()
    })),
    addChangeListener: jest.fn((callback) => ({
      remove: jest.fn()
    })),
    removeChangeListener: jest.fn(),
    isReduceMotionEnabled: jest.fn(() => false),
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
    addEventListener: jest.fn((eventType, callback) => ({
      remove: jest.fn()
    })),
    removeEventListener: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock Countly
jest.mock('countly-sdk-react-native-bridge', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    start: jest.fn(),
    enableCrashReporting: jest.fn(),
    events: {
      recordEvent: jest.fn(),
    },
  },
}));

// Mock Expo HTML elements
jest.mock('@expo/html-elements', () => ({
  H1: ({ children, ...props }: any) => children,
  H2: ({ children, ...props }: any) => children,
  H3: ({ children, ...props }: any) => children,
  H4: ({ children, ...props }: any) => children,
  H5: ({ children, ...props }: any) => children,
  H6: ({ children, ...props }: any) => children,
}));

// Mock Expo Navigation Bar
jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn(),
  setVisibilityAsync: jest.fn(),
  setBehaviorAsync: jest.fn(),
  getBackgroundColorAsync: jest.fn(),
  getVisibilityAsync: jest.fn(),
  getBehaviorAsync: jest.fn(),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(),
}));

// Mock react-native-edge-to-edge
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: {
    setHidden: jest.fn(),
    setColor: jest.fn(),
    setStyle: jest.fn(),
  },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const MockedSafeAreaView = ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('div', props, children);
  };
  MockedSafeAreaView.displayName = 'SafeAreaView';

  return {
    SafeAreaView: MockedSafeAreaView,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

const mockTrackEvent = jest.fn();
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockUseCommandStore = useCommandStore as unknown as jest.Mock;
const mockUseCallDetailStore = useCallDetailStore as jest.MockedFunction<typeof useCallDetailStore>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockUseToastStore = useToastStore as jest.MockedFunction<typeof useToastStore>;
const mockSecurityStore = securityStore as jest.MockedFunction<typeof securityStore>;

describe('CallDetail', () => {
  const defaultCallDetailStore = {
    call: null,
    callExtraData: null,
    callPriority: null,
    isLoading: true,
    error: null,
    fetchCallDetail: jest.fn(),
    reset: jest.fn(),
  };

  const defaultCoreStore = {
    activeCall: null,
  };

  const defaultLocationStore = {
    latitude: 40.7128,
    longitude: -74.0060,
  };

  const defaultSecurityStore = {
    rights: { CanCreateCalls: true },
    getRights: jest.fn(),
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAnalytics.mockReturnValue({
      trackEvent: mockTrackEvent,
    });

    mockUseLocalSearchParams.mockReturnValue({
      id: 'test-call-id',
    });

    mockUseLocationStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(defaultLocationStore);
      }
      return defaultLocationStore;
    });

    mockUseToastStore.mockImplementation((selector: any) => {
      const store = { showToast: jest.fn() };
      if (selector) {
        return selector(store);
      }
      return store;
    });

    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(defaultCoreStore);
      }
      return defaultCoreStore;
    });

    mockUseCommandStore.mockImplementation((selector: any) => {
      const state = { boards: {}, activeCallId: null };
      return selector ? selector(state) : state;
    });

    mockUseCallDetailStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(defaultCallDetailStore);
      }
      return defaultCallDetailStore;
    });

    mockSecurityStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(defaultSecurityStore);
      }
      return defaultSecurityStore;
    });
  });

  it('should track analytics when call detail view is rendered with call data', async () => {
    const mockCall = {
      CallId: 'test-call-id',
      Name: 'Test Call',
      Number: 'C2024001',
      Priority: 2,
      Type: 'Emergency',
      Address: '123 Main St',
      Latitude: '40.7128',
      Longitude: '-74.0060',
      NotesCount: 3,
      ImgagesCount: 2,
      FileCount: 1,
    };

    const mockCallExtraData = {
      Protocols: [{ Name: 'Protocol 1' }],
      Dispatches: [{ Name: 'Unit 1' }],
      Activity: [{ StatusText: 'Dispatched' }],
    };

    const callDetailStore = {
      call: mockCall,
      callExtraData: mockCallExtraData,
      callPriority: { Name: 'High', Color: '#ff0000' },
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    };

    mockUseCallDetailStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(callDetailStore);
      }
      return callDetailStore;
    });

    render(<CallDetail />);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('call_detail_view_rendered', {
        callId: 'test-call-id',
        callName: 'Test Call',
        callNumber: 'C2024001',
        callPriority: 2,
        callType: 'Emergency',
        hasCoordinates: true,
        hasAddress: true,
        hasNotes: true,
        hasImages: true,
        hasFiles: true,
        hasExtraData: true,
        hasProtocols: true,
        hasDispatches: true,
        hasTimeline: true,
      });
    });
  });

  it('should not track analytics when call data is not available', () => {
    const callDetailStore = {
      call: null,
      callExtraData: null,
      callPriority: null,
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    };

    mockUseCallDetailStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(callDetailStore);
      }
      return callDetailStore;
    });

    render(<CallDetail />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('should track analytics with default values when call has missing data', async () => {
    const mockCall = {
      CallId: '',
      Name: '',
      Number: '',
      Priority: 0,
      Type: '',
      Address: '',
      Latitude: null,
      Longitude: null,
      NotesCount: 0,
      ImgagesCount: 0,
      FileCount: 0,
    };

    const callDetailStore = {
      call: mockCall,
      callExtraData: null,
      callPriority: null,
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    };

    mockUseCallDetailStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(callDetailStore);
      }
      return callDetailStore;
    });

    render(<CallDetail />);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('call_detail_view_rendered', {
        callId: '',
        callName: '',
        callNumber: '',
        callPriority: 0,
        callType: '',
        hasCoordinates: false,
        hasAddress: false,
        hasNotes: false,
        hasImages: false,
        hasFiles: false,
        hasExtraData: false,
        hasProtocols: false,
        hasDispatches: false,
        hasTimeline: false,
      });
    });
  });

  describe('Start Command functionality', () => {
    const mockCall = {
      CallId: 'test-call-id',
      Name: 'Test Call',
      Number: 'C2024001',
      Priority: 2,
      Type: 'Emergency',
      Address: '123 Main St',
      Latitude: '40.7128',
      Longitude: '-74.0060',
      NotesCount: 0,
      ImgagesCount: 0,
      FileCount: 0,
    };

    const setCallDetail = () => {
      mockUseCallDetailStore.mockImplementation((selector: any) => {
        const store = {
          call: mockCall,
          callExtraData: null,
          callPriority: null,
          isLoading: false,
          error: null,
          fetchCallDetail: jest.fn(),
          reset: jest.fn(),
        };
        return selector ? selector(store) : store;
      });
    };

    it('shows the Start Command button when the call has no command board', () => {
      setCallDetail();

      const { getByTestId, toJSON } = render(<CallDetail />);
      expect(getByTestId('start-command-button')).toBeTruthy();
      expect(JSON.stringify(toJSON())).toContain('command.start_command');
    });

    it('shows Open Command Board and the Active Command badge when this call is the active board', () => {
      setCallDetail();
      mockUseCommandStore.mockImplementation((selector: any) => {
        const state = { boards: { 'test-call-id': { callId: 'test-call-id' } }, activeCallId: 'test-call-id' };
        return selector ? selector(state) : state;
      });

      const { getByTestId, toJSON } = render(<CallDetail />);
      expect(getByTestId('start-command-button')).toBeTruthy();
      const json = JSON.stringify(toJSON());
      expect(json).toContain('command.open_board');
      expect(json).toContain('command.active_badge');
    });

    it('starts command for the call and navigates to the command board', async () => {
      const mockSetActiveCall = jest.fn(() => Promise.resolve());
      const mockShowToast = jest.fn();
      const mockPush = jest.fn();

      setCallDetail();
      // Existing board → button starts directly (no template picker)
      mockUseCommandStore.mockImplementation((selector: any) => {
        const state = { boards: { 'test-call-id': { callId: 'test-call-id' } }, activeCallId: null };
        return selector ? selector(state) : state;
      });
      (mockUseCommandStore as any).getState = jest.fn(() => ({ startCommand: mockSetActiveCall }));
      mockUseToastStore.mockImplementation((selector: any) => {
        const store = { showToast: mockShowToast };
        return selector ? selector(store) : store;
      });
      (useRouter as jest.Mock).mockReturnValue({ back: jest.fn(), push: mockPush });

      const { getByTestId } = render(<CallDetail />);
      fireEvent.press(getByTestId('start-command-button'));

      await waitFor(() => {
        expect(mockSetActiveCall).toHaveBeenCalledWith(mockCall.CallId, null);
        expect(mockShowToast).toHaveBeenCalledWith('success', 'command.start_success');
        expect(mockPush).toHaveBeenCalledWith('/command');
      });
    });

    it('shows an error toast when starting command fails', async () => {
      const mockSetActiveCall = jest.fn(() => Promise.reject(new Error('boom')));
      const mockShowToast = jest.fn();

      setCallDetail();
      // Existing board → button starts directly (no template picker)
      mockUseCommandStore.mockImplementation((selector: any) => {
        const state = { boards: { 'test-call-id': { callId: 'test-call-id' } }, activeCallId: null };
        return selector ? selector(state) : state;
      });
      (mockUseCommandStore as any).getState = jest.fn(() => ({ startCommand: mockSetActiveCall }));
      mockUseToastStore.mockImplementation((selector: any) => {
        const store = { showToast: mockShowToast };
        return selector ? selector(store) : store;
      });

      const { getByTestId } = render(<CallDetail />);
      fireEvent.press(getByTestId('start-command-button'));

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('error', 'command.start_error');
      });
    });
  });
});
