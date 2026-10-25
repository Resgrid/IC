// Incident tactical map screen (src/app/command-map/[callId].tsx): the map legend control and sheet.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import CommandMapScreen from '@/app/command-map/[callId]';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ callId: '101' }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/components/maps/mapbox', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = (name: string) => (props: any) => React.createElement(View, { testID: props.testID ?? `mock-${name}` }, props.children);
  return {
    __esModule: true,
    default: {
      MapView: passthrough('map-view'),
      Camera: passthrough('camera'),
      ShapeSource: passthrough('shape-source'),
      LineLayer: passthrough('line-layer'),
      FillLayer: passthrough('fill-layer'),
      MarkerView: passthrough('marker-view'),
    },
  };
});
jest.mock('@/components/command/incident-map-layers', () => ({
  AnnotationLayers: () => null,
  IncidentLocationMarkers: () => null,
}));
jest.mock('@/components/maps/map-pins', () => ({ __esModule: true, default: () => null }));
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: jest.fn(() => Promise.resolve({ Data: { MapMakerInfos: [] } })),
}));
jest.mock('@/hooks/use-map-signalr-updates', () => ({ useMapSignalRUpdates: jest.fn(() => jest.fn()) }));
jest.mock('@/hooks/use-map-geolocation-updates', () => ({
  useMapGeolocationUpdates: jest.fn(),
  withLiveLocationsSince: (pins: unknown[]) => pins,
}));
jest.mock('@/hooks/use-command-map-overlay', () => ({ useCommandMapOverlay: () => ({}) }));
jest.mock('@/lib/map-center', () => ({ useDepartmentMapCenter: () => ({ latitude: 39.5, longitude: -119.8 }) }));
jest.mock('@/lib/map-style', () => ({ useDepartmentMapStyle: () => 'mapbox://styles/mapbox/streets-v12' }));
jest.mock('@/stores/toast/store', () => {
  const state = { showToast: jest.fn() };
  return { useToastStore: (selector: any) => selector(state) };
});
jest.mock('@/stores/command/store', () => {
  const state = {
    boards: {
      '101': {
        board: {
          Command: { IncidentCommandId: 'ic-1', CallId: 101, MapCenterLatitude: '39.5', MapCenterLongitude: '-119.8', MapZoomLevel: '14' },
          Maps: [],
          Annotations: [],
        },
      },
    },
    updateMapViewEntry: jest.fn(),
    saveIncidentMapEntry: jest.fn(),
    saveMapAnnotationEntry: jest.fn(),
    deleteMapAnnotationEntry: jest.fn(),
  };
  return { useCommandStore: (selector: any) => selector(state) };
});
jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));
jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));

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

describe('Command map: map legend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLegendProps.current = null;
  });

  it('shows a labelled legend button on the tactical map', async () => {
    render(<CommandMapScreen />);

    const button = await screen.findByTestId('map-legend-button');
    expect(screen.getByTestId('command-map-screen')).toBeTruthy();
    expect(button.props.accessibilityLabel).toBe('maps.legend.title');
    expect(button).toHaveStyle({ position: 'absolute', right: 20, width: 48, height: 48 });
    expect(mockLegendProps.current?.isOpen).toBe(false);
  });

  it('opens the legend sheet from the button and closes it again', async () => {
    render(<CommandMapScreen />);

    fireEvent.press(await screen.findByTestId('map-legend-button'));

    expect(screen.getByTestId('mock-map-legend-sheet')).toBeTruthy();
    expect(mockLegendProps.current?.isOpen).toBe(true);
    // The tactical map draws only the incident's units and personnel, never hydrants.
    expect(mockLegendProps.current?.showHydrant).toBeFalsy();

    act(() => {
      mockLegendProps.current?.onClose();
    });
    expect(screen.queryByTestId('mock-map-legend-sheet')).toBeNull();
  });
});
