import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mapbox natives are unavailable under jest — passthrough views keep the tree renderable.
jest.mock('@/components/maps/mapbox', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = (name: string) => (props: any) => React.createElement(View, { ...props, testID: props.testID ?? `mock-${name}` }, props.children);
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

jest.mock('@/components/maps/map-pins', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ pins }: { pins: { Id: string }[] }) => React.createElement(View, { testID: 'mock-map-pins', accessibilityLabel: pins.map((p) => p.Id).join(',') }),
  };
});

const mockGetMapDataAndMarkers = jest.fn();
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: (...args: unknown[]) => mockGetMapDataAndMarkers(...args),
}));

jest.mock('@/hooks/use-map-signalr-updates', () => ({ useMapSignalRUpdates: jest.fn() }));
jest.mock('@/hooks/use-map-geolocation-updates', () => ({ useMapGeolocationUpdates: jest.fn() }));

const mockOverlay: Record<string, { callId: string }> = {};
jest.mock('@/hooks/use-command-map-overlay', () => ({
  useCommandMapOverlay: () => mockOverlay,
}));

import { type IncidentCommand } from '@/models/v4/incidentCommand/incidentCommandModels';

import { IncidentMapCard } from '../incident-map-card';

const command = (overrides: Partial<IncidentCommand> = {}): IncidentCommand =>
  ({
    IncidentCommandId: 'ic-1',
    DepartmentId: 1,
    CallId: 101,
    EstablishedByUserId: 'u1',
    EstablishedOn: '2026-07-01T10:00:00Z',
    CurrentCommanderUserId: 'u1',
    IcsLevel: 1,
    Status: 0,
    MapCenterLatitude: '34.05',
    MapCenterLongitude: '-118.24',
    MapZoomLevel: '14',
    ...overrides,
  }) as IncidentCommand;

describe('IncidentMapCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockOverlay)) delete mockOverlay[key];
    mockGetMapDataAndMarkers.mockResolvedValue({ Data: { MapMakerInfos: [] } });
  });

  it('shows the create prompt when no map view has been saved yet', () => {
    const { getByTestId, unmount } = render(<IncidentMapCard callId="101" command={command({ MapZoomLevel: null, MapCenterLatitude: null, MapCenterLongitude: null })} annotations={[]} />);

    fireEvent.press(getByTestId('incident-map-create'));
    expect(mockPush).toHaveBeenCalledWith('/command-map/101');

    unmount();
  });

  it('renders the preview and opens fullscreen on tap', async () => {
    const { getByTestId, unmount } = render(<IncidentMapCard callId="101" command={command()} annotations={[]} />);

    await waitFor(() => expect(getByTestId('incident-map-card')).toBeTruthy());
    fireEvent.press(getByTestId('incident-map-open'));
    expect(mockPush).toHaveBeenCalledWith('/command-map/101');

    unmount();
  });

  it('only shows units/personnel that are on THIS incident', async () => {
    mockOverlay['u5'] = { callId: '101' };
    mockOverlay['p9'] = { callId: '202' }; // different incident — must be filtered out
    mockGetMapDataAndMarkers.mockResolvedValue({
      Data: {
        MapMakerInfos: [
          { Id: 'u5', Latitude: 34, Longitude: -118, Title: 'Engine 5' },
          { Id: 'p9', Latitude: 34.1, Longitude: -118.1, Title: 'Someone Else' },
          { Id: 'u7', Latitude: 34.2, Longitude: -118.2, Title: 'Unassigned Unit' },
        ],
      },
    });

    const { getByTestId, unmount } = render(<IncidentMapCard callId="101" command={command()} annotations={[]} />);

    await waitFor(() => expect(getByTestId('mock-map-pins').props.accessibilityLabel).toBe('u5'));

    unmount();
  });
});
