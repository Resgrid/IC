// Main map screen (src/app/(app)/index.tsx): the map legend control and sheet.
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  cssInterop: jest.fn((Component: any) => Component),
  useColorScheme: jest.fn(() => ({
    colorScheme: 'light',
    get: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  })),
  __esModule: true,
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import Map from '@/app/(app)/index';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { locationService } from '@/services/location';
import { useLocationStore } from '@/stores/app/location-store';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/hooks/use-app-lifecycle');
jest.mock('@/stores/app/location-store');
jest.mock('@/services/location');
jest.mock('@/hooks/use-map-signalr-updates', () => ({
  useMapSignalRUpdates: jest.fn(),
}));
jest.mock('@/hooks/use-map-geolocation-updates', () => ({
  useMapGeolocationUpdates: jest.fn(),
  withLiveLocationsSince: (pins: unknown[]) => pins,
}));
const mockGetMapDataAndMarkers = jest.fn();
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: (...args: unknown[]) => mockGetMapDataAndMarkers(...args),
}));
jest.mock('@rnmapbox/maps', () => ({
  setAccessToken: jest.fn(),
  MapView: 'MapView',
  Camera: 'Camera',
  PointAnnotation: 'PointAnnotation',
  ShapeSource: 'ShapeSource',
  FillLayer: 'FillLayer',
  LineLayer: 'LineLayer',
  MarkerView: 'MarkerView',
  StyleURL: { Street: 'mapbox://styles/mapbox/streets-v11' },
  UserTrackingMode: { Follow: 'follow', FollowWithHeading: 'followWithHeading' },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/stores/toast/store', () => {
  const state = { showToast: jest.fn() };
  const useToastStore = (selector: any) => (typeof selector === 'function' ? selector(state) : state);
  useToastStore.getState = () => state;
  return { useToastStore };
});
jest.mock('@/stores/app/core-store', () => {
  const storeState = { setActiveCall: jest.fn(), isInitialized: true, config: null };
  const mockFn = jest.fn((selector) => (typeof selector === 'function' ? selector(storeState) : storeState)) as jest.Mock & { getState: () => typeof storeState };
  mockFn.getState = () => storeState;
  return { useCoreStore: mockFn };
});
jest.mock('@/components/maps/map-pins', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/maps/pin-detail-modal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/maps/map-layers-sheet', () => ({ MapLayersSheet: () => null }));
jest.mock('@/components/weather-alerts/weather-alert-banner', () => ({ WeatherAlertBanner: () => null }));
jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));

// The legend sheet itself is covered by map-legend-sheet.test.tsx: here, only what the screen hands it.
const mockLegendProps: { current: { isOpen: boolean; onClose: () => void; showHydrant?: boolean } | null } = { current: null };
jest.mock('@/components/maps/map-legend-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    MapLegendSheet: (props: { isOpen: boolean; onClose: () => void; showHydrant?: boolean }) => {
      mockLegendProps.current = props;
      return props.isOpen ? React.createElement(View, { testID: 'mock-map-legend-sheet' }) : null;
    },
  };
});

const locationState = { latitude: 40.7128, longitude: -74.006, heading: 0, isMapLocked: false };

describe('Main map: map legend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLegendProps.current = null;
    (useLocationStore as unknown as jest.Mock).mockImplementation((selector: any) => (typeof selector === 'function' ? selector(locationState) : locationState));
    (useAppLifecycle as jest.Mock).mockReturnValue({ isActive: true, appState: 'active', isBackground: false, lastActiveTimestamp: Date.now() });
    (locationService.startLocationUpdates as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    (locationService.stopLocationUpdates as jest.Mock) = jest.fn();
    mockGetMapDataAndMarkers.mockResolvedValue({ Data: { MapMakerInfos: [] } });
  });

  it('shows a labelled legend button stacked above the layers button', async () => {
    render(<Map />);

    const button = await screen.findByTestId('map-legend-button');
    expect(button.props.accessibilityLabel).toBe('maps.legend.title');
    expect(button.props.accessibilityRole).toBe('button');
    // 132 above the bottom safe-area inset (34): the slot above the layers control.
    expect(button).toHaveStyle({ position: 'absolute', right: 20, bottom: 166, width: 48, height: 48 });
    expect(screen.getByTestId('layers-button')).toBeTruthy();
    expect(screen.queryByTestId('mock-map-legend-sheet')).toBeNull();
    expect(mockLegendProps.current?.isOpen).toBe(false);
  });

  it('stacks recenter, layers and legend in their own slots, so none covers another', async () => {
    render(<Map />);
    await screen.findByTestId('map-legend-button');
    expect(screen.queryByTestId('recenter-button')).toBeNull();

    // The user pans the map: the recenter control appears in the bottom slot.
    act(() => {
      screen.UNSAFE_getByType('MapView' as any).props.onCameraChanged({ properties: { isUserInteraction: true } });
    });

    // Above the bottom safe-area inset (34): recenter 20, layers 76, legend 132.
    expect(screen.getByTestId('recenter-button')).toHaveStyle({ bottom: 54 });
    expect(screen.getByTestId('layers-button')).toHaveStyle({ bottom: 110 });
    expect(screen.getByTestId('map-legend-button')).toHaveStyle({ bottom: 166 });
  });

  it('opens the legend sheet from the button and closes it again', async () => {
    render(<Map />);

    fireEvent.press(await screen.findByTestId('map-legend-button'));

    expect(screen.getByTestId('mock-map-legend-sheet')).toBeTruthy();
    expect(mockLegendProps.current?.isOpen).toBe(true);
    expect(mockLegendProps.current?.showHydrant).toBe(false);

    act(() => {
      mockLegendProps.current?.onClose();
    });
    expect(screen.queryByTestId('mock-map-legend-sheet')).toBeNull();
  });

  it('asks the legend to list hydrants only when the map is drawing hydrant markers', async () => {
    mockGetMapDataAndMarkers.mockResolvedValue({
      Data: {
        MapMakerInfos: [
          { Id: 'u1', Type: 1, Title: 'Engine 1', Latitude: 40, Longitude: -74, ImagePath: 'Engine_Available' },
          { Id: 'hydrant-9', Type: 5, Title: 'H-9', Latitude: 40, Longitude: -74, ImagePath: 'hydrant' },
        ],
      },
    });

    render(<Map />);

    await waitFor(() => expect(mockLegendProps.current?.showHydrant).toBe(true));
  });
});
