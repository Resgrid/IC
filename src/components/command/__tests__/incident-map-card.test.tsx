import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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

// Last props MapPins rendered with, so a test can check what reached the pins (not just which ids).
const mockMapPinsProps: { current: { pins: Record<string, unknown>[]; commandOverlay?: unknown } | null } = { current: null };
jest.mock('@/components/maps/map-pins', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { pins: { Id: string }[]; commandOverlay?: unknown }) => {
      mockMapPinsProps.current = props;
      return React.createElement(View, { testID: 'mock-map-pins', accessibilityLabel: props.pins.map((p) => p.Id).join(',') });
    },
  };
});

const mockGetMapDataAndMarkers = jest.fn();
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: (...args: unknown[]) => mockGetMapDataAndMarkers(...args),
}));

const mockRequestPinsRefresh = jest.fn();
const mockUseMapGeolocationUpdates = jest.fn();
jest.mock('@/hooks/use-map-signalr-updates', () => ({ useMapSignalRUpdates: jest.fn(() => mockRequestPinsRefresh) }));
jest.mock('@/hooks/use-map-geolocation-updates', () => ({
  useMapGeolocationUpdates: (...args: unknown[]) => mockUseMapGeolocationUpdates(...args),
  // No live positions in these tests: the snapshot passes through unchanged.
  withLiveLocationsSince: (pins: unknown[]) => pins,
}));

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

  it('feeds live positions the FULL pin set and the refetch, not just the incident subset', async () => {
    mockOverlay['u5'] = { callId: '101' };
    mockGetMapDataAndMarkers.mockResolvedValue({
      Data: {
        MapMakerInfos: [
          { Id: 'u5', Latitude: 34, Longitude: -118, Title: 'Engine 5' },
          { Id: 'u7', Latitude: 34.2, Longitude: -118.2, Title: 'Unassigned Unit' },
        ],
      },
    });

    const { getByTestId, unmount } = render(<IncidentMapCard callId="101" command={command()} annotations={[]} />);

    await waitFor(() => expect(getByTestId('mock-map-pins').props.accessibilityLabel).toBe('u5'));

    // A position for u7 must be recognised as a known pin (no refetch), so the hook sees every pin.
    const [pins, setPins, requestRefresh] = mockUseMapGeolocationUpdates.mock.calls[mockUseMapGeolocationUpdates.mock.calls.length - 1];
    expect((pins as { Id: string }[]).map((pin) => pin.Id)).toEqual(['u5', 'u7']);
    expect(typeof setPins).toBe('function');
    expect(requestRefresh).toBe(mockRequestPinsRefresh);

    unmount();
  });

  it('keeps the uploaded icons on the pins it narrows to this incident (personnel role icon included)', async () => {
    const roleIconUrl = 'https://api.resgrid.dev/api/v4/PersonnelRoles/Icon/medic.png';
    const unitIconUrl = 'https://api.resgrid.dev/api/v4/UnitTypes/Icon/engine.png';
    mockOverlay['u5'] = { callId: '101' };
    mockOverlay['pabc-123'] = { callId: '101' };
    mockGetMapDataAndMarkers.mockResolvedValue({
      Data: {
        MapMakerInfos: [
          { Id: 'u5', Type: 1, Latitude: 34, Longitude: -118, Title: 'Engine 5', ImagePath: 'Engine_Responding', IconUrl: unitIconUrl },
          { Id: 'pabc-123', Type: 3, Latitude: 34.1, Longitude: -118.1, Title: 'Alex Reed', ImagePath: 'Person_RespondingCall', IconUrl: roleIconUrl },
          { Id: 'pdef-456', Type: 3, Latitude: 34.2, Longitude: -118.2, Title: 'No Icon', ImagePath: 'Person_RespondingCall', IconUrl: null },
        ],
      },
    });

    const { getByTestId, unmount } = render(<IncidentMapCard callId="101" command={command()} annotations={[]} />);

    await waitFor(() => expect(getByTestId('mock-map-pins').props.accessibilityLabel).toBe('u5,pabc-123'));

    expect(mockMapPinsProps.current?.pins).toEqual([expect.objectContaining({ Id: 'u5', IconUrl: unitIconUrl }), expect.objectContaining({ Id: 'pabc-123', Type: 3, IconUrl: roleIconUrl, ImagePath: 'Person_RespondingCall' })]);
    // The overlay rides alongside, keyed by marker id, so the lane label/ring is added without rebuilding the pin.
    expect(mockMapPinsProps.current?.commandOverlay).toBe(mockOverlay);

    unmount();
  });

  it('keeps the status pin on the incident pins, and a realtime refetch that only changes it reaches the map', async () => {
    const respondingPin = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-responding?v=1';
    const onScenePin = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-onscene?v=1';
    mockOverlay['u5'] = { callId: '101' };
    const engine = { Id: 'u5', Type: 1, Latitude: 34, Longitude: -118, Title: 'Engine 5', ImagePath: 'Engine_Responding', IconUrl: null, PinIconUrl: respondingPin, IconStyle: 'responding' };
    mockGetMapDataAndMarkers.mockResolvedValue({ Data: { MapMakerInfos: [engine, { Id: 'u7', Type: 1, Latitude: 34.2, Longitude: -118.2, Title: 'Unassigned Unit', PinIconUrl: respondingPin }] } });

    const { getByTestId, unmount } = render(<IncidentMapCard callId="101" command={command()} annotations={[]} />);

    await waitFor(() => expect(getByTestId('mock-map-pins').props.accessibilityLabel).toBe('u5'));
    expect(mockMapPinsProps.current?.pins).toEqual([expect.objectContaining({ Id: 'u5', PinIconUrl: respondingPin, IconStyle: 'responding' })]);

    // The status-change refetch replaces the snapshot through the setter the realtime hook was handed.
    const { useMapSignalRUpdates } = jest.requireMock('@/hooks/use-map-signalr-updates') as { useMapSignalRUpdates: jest.Mock };
    const [setPins] = useMapSignalRUpdates.mock.calls[useMapSignalRUpdates.mock.calls.length - 1];
    act(() => {
      setPins([{ ...engine, PinIconUrl: onScenePin, IconStyle: 'onscene' }]);
    });

    expect(mockMapPinsProps.current?.pins).toEqual([expect.objectContaining({ Id: 'u5', PinIconUrl: onScenePin, IconStyle: 'onscene' })]);

    unmount();
  });
});
