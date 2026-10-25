import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('View', props) };
});

// Real English strings (with {{interpolation}}), so the assertions read like the screen and every key must exist.
jest.mock('react-i18next', () => {
  const en = require('../../../translations/en.json');
  const lookup = (key: string) => key.split('.').reduce((node: any, part) => (node == null ? undefined : node[part]), en);
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const value = lookup(key);
        return typeof value === 'string' ? value.replace(/{{(\w+)}}/g, (_: string, name: string) => String(options?.[name] ?? '')) : key;
      },
    }),
  };
});

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Department terminology: renamed module names by term key.
const mockTerms: Record<string, string> = {};
jest.mock('@/stores/terminology/store', () => ({
  TermKeys: { Calls: 'module.calls', Units: 'module.units', Personnel: 'module.personnel' },
  useTerm: (key: string, fallback: string) => mockTerms[key] || fallback,
}));

const mockGetMapIconLegend = jest.fn();
jest.mock('@/api/mapping/mapping', () => ({
  getMapIconLegend: (...args: unknown[]) => mockGetMapIconLegend(...args),
}));

import { MAP_ICONS } from '@/constants/map-icons';

import { MapLegendSheet } from '../map-legend-sheet';

const PIN = (name: string) => `https://api.resgrid.dev/api/v4/TypeIcons/Pins/${name}?v=1`;
const UPLOAD = (name: string) => `https://api.resgrid.dev/api/v4/TypeIcons/${name}?v=1`;

const style = (Key: string, Color: string, extra: Record<string, unknown> = {}) => ({
  Key,
  Color,
  Meanings: [],
  UnitStatuses: [],
  PersonnelStatuses: [],
  Priorities: [],
  UnitPinIconUrl: null,
  PersonPinIconUrl: null,
  CallPinIconUrl: null,
  ...extra,
});

const legendData = () => ({
  StatusStyles: [
    style('available', '#28A745', { UnitStatuses: ['In Quarters', 'Ready Reserve'], PersonnelStatuses: ['Standing By'], UnitPinIconUrl: PIN('engine-available'), PersonPinIconUrl: PIN('person-available') }),
    style('responding', '#007BFF', { UnitStatuses: ['Code 3'], PersonnelStatuses: [], UnitPinIconUrl: PIN('engine-responding'), PersonPinIconUrl: PIN('person-responding') }),
    style('unknown', '#9E9E9E', { UnitStatuses: ['Fueling'], UnitPinIconUrl: null, PersonPinIconUrl: null }),
  ],
  PriorityStyles: [style('emergency', '#DC3545', { Priorities: ['P1 Urgent', 'Mayday'], CallPinIconUrl: PIN('call-emergency') }), style('unknown', '#9E9E9E', { Priorities: ['Info Only'] })],
  Calls: [
    {
      Id: null,
      Name: 'Server none label (calls)',
      StatusSetName: null,
      IconUrl: null,
      PinIconUrl: null,
      ImagePath: 'Call',
      States: [{ Id: 1, Name: 'P1 Urgent', Color: '#ff0000', IconStyle: 'emergency', IconUrl: null, PinIconUrl: PIN('call-emergency'), ImagePath: 'Call', IsVariant: false }],
    },
    {
      Id: 12,
      Name: 'Structure Fire',
      StatusSetName: null,
      IconUrl: UPLOAD('structure-fire'),
      PinIconUrl: null,
      ImagePath: 'fire',
      States: [
        // Upload for this exact priority: wins over the styled pin.
        { Id: 1, Name: 'P1 Urgent', Color: '#ff0000', IconStyle: 'emergency', IconUrl: UPLOAD('structure-fire-p1'), PinIconUrl: PIN('fire-emergency'), ImagePath: 'fire', IsVariant: true },
        // No upload: the styled pin.
        { Id: 2, Name: 'Info Only', Color: null, IconStyle: 'unknown', IconUrl: null, PinIconUrl: PIN('fire-unknown'), ImagePath: 'fire', IsVariant: false },
        // Neither (older server / no meaning): the bundled asset.
        { Id: 3, Name: 'Routine', Color: 'not-a-colour', IconStyle: 'unknown', IconUrl: null, PinIconUrl: null, ImagePath: 'fire', IsVariant: false },
      ],
    },
  ],
  Units: [
    {
      Id: null,
      Name: 'Server none label (units)',
      StatusSetName: null,
      IconUrl: null,
      PinIconUrl: null,
      ImagePath: 'Engine_Responding',
      States: [{ Id: 0, Name: 'Ready', Color: '#00ff00', IconStyle: 'available', IconUrl: null, PinIconUrl: PIN('engine-available'), ImagePath: 'Engine_Available', IsVariant: false }],
    },
    {
      Id: 7,
      Name: 'Brush Truck',
      StatusSetName: 'Wildland Set',
      IconUrl: null,
      PinIconUrl: null,
      ImagePath: 'fourbyfour',
      States: [{ Id: 41, Name: 'Mopping Up', Color: '#ffaa00', IconStyle: 'onscene', IconUrl: null, PinIconUrl: PIN('fourbyfour-onscene'), ImagePath: 'fourbyfour', IsVariant: false }],
    },
    { Id: 8, Name: 'Tender', StatusSetName: null, IconUrl: null, PinIconUrl: null, ImagePath: 'truck', States: [] },
  ],
  Personnel: [
    { Id: null, Name: 'Server none label (personnel)', StatusSetName: null, IconUrl: null, PinIconUrl: null, ImagePath: 'Person_RespondingCall', States: [] },
    {
      Id: 3,
      Name: 'Medic',
      StatusSetName: null,
      IconUrl: UPLOAD('medic'),
      PinIconUrl: null,
      ImagePath: 'Person_RespondingCall',
      States: [{ Id: 5, Name: 'On Shift', Color: null, IconStyle: 'available', IconUrl: UPLOAD('medic-badge'), PinIconUrl: PIN('person-available'), ImagePath: 'Person_Available', IsVariant: false }],
    },
  ],
  PoiTypes: [
    { PoiTypeId: 4, Name: 'Water Point', Color: '#1e88e5', PoiImage: 'map-icon-water-supply', ImagePath: 'watersupply', Marker: 'SQUARE', IconUrl: null },
    { PoiTypeId: 5, Name: 'Helispot', Color: '#43a047', PoiImage: 'map-icon-heliport', ImagePath: 'helipad', Marker: 'MAP_PIN', IconUrl: UPLOAD('helispot') },
  ],
});

const envelope = (data: unknown = legendData()) => ({ PageSize: 0, Status: 'success', Environment: 'dev', RequestId: 'r', Version: 'v4', Timestamp: '', Node: '', Data: data });

const renderOpen = async (props: Partial<React.ComponentProps<typeof MapLegendSheet>> = {}) => {
  const utils = render(<MapLegendSheet isOpen={true} onClose={jest.fn()} {...props} />);
  await waitFor(() => expect(screen.getByTestId('map-legend-content')).toBeTruthy());
  return utils;
};

describe('MapLegendSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockTerms)) delete mockTerms[key];
    mockGetMapIconLegend.mockResolvedValue(envelope());
  });

  it('does not fetch or render anything while closed', () => {
    render(<MapLegendSheet isOpen={false} onClose={jest.fn()} />);

    expect(mockGetMapIconLegend).not.toHaveBeenCalled();
    expect(screen.queryByText('Map legend')).toBeNull();
  });

  it("renders the department's own names for statuses, priorities, types, roles and POI types", async () => {
    await renderOpen();

    expect(screen.getByText('Map legend')).toBeTruthy();
    expect(screen.getByText('Units: In Quarters, Ready Reserve')).toBeTruthy();
    expect(screen.getByText('Personnel: Standing By')).toBeTruthy();
    expect(screen.getByText('Units: Code 3')).toBeTruthy();
    expect(screen.getByText('Priorities: P1 Urgent, Mayday')).toBeTruthy();
    expect(screen.getByText('Structure Fire')).toBeTruthy();
    expect(screen.getByText('Routine')).toBeTruthy();
    expect(screen.getByText('Brush Truck')).toBeTruthy();
    expect(screen.getByText('Mopping Up')).toBeTruthy();
    expect(screen.getByText('Medic')).toBeTruthy();
    expect(screen.getByText('On Shift')).toBeTruthy();
    expect(screen.getByText('Water Point')).toBeTruthy();
    expect(screen.getByText('Helispot')).toBeTruthy();
  });

  it('omits an empty names line instead of showing a bare label', async () => {
    await renderOpen();

    // Responding has unit statuses but no personnel statuses: one line, no bare "Personnel:".
    const responding = screen.getByTestId('map-legend-status-style-responding');
    const lines = responding.findAll((node: any) => typeof node.props.children === 'string' && /^(Units|Personnel):/.test(node.props.children) && typeof node.type === 'string');
    expect(lines.map((node: any) => node.props.children)).toEqual(['Units: Code 3']);
  });

  it('shows the sections in order: status colors, priority colors, calls, units, personnel, other', async () => {
    await renderOpen();

    const order = ['map-legend-status-colors', 'map-legend-priority-colors', 'map-legend-calls', 'map-legend-units', 'map-legend-personnel', 'map-legend-other'];
    const content = screen.getByTestId('map-legend-content');
    expect(content.children.map((child: any) => child.props.testID)).toEqual(order);
  });

  it('labels the Id null rows with its own localized text, never the server Name', async () => {
    await renderOpen();

    expect(screen.getByText('Calls with no type')).toBeTruthy();
    expect(screen.getByText('Units with no type')).toBeTruthy();
    expect(screen.getByText('Members with no role icon')).toBeTruthy();
    expect(screen.queryByText(/Server none label/)).toBeNull();
    expect(screen.getByTestId('map-legend-calls-row-none')).toBeTruthy();
  });

  it('shows the status set name, or the built-in unit statuses label when there is none', async () => {
    await renderOpen();

    expect(screen.getByText('Statuses: Wildland Set')).toBeTruthy();
    // The "no type" row and Tender both use the built-in unit statuses.
    expect(screen.getAllByText('Built-in unit statuses')).toHaveLength(2);
  });

  it('labels the styles by key, with the "unknown" style worded per kind', async () => {
    await renderOpen();

    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Responding')).toBeTruthy();
    expect(screen.getByText('Emergency')).toBeTruthy();
    expect(screen.getByText('No meaning or no status')).toBeTruthy();
    expect(screen.getByText('No meaning')).toBeTruthy();
    expect(screen.getByTestId('map-legend-status-style-available-swatch')).toHaveStyle({ backgroundColor: '#28A745' });
  });

  it('draws the status and priority pins from the style URLs, leaving a style with no pin empty', async () => {
    await renderOpen();

    expect(screen.getByTestId('map-legend-status-style-available-unit-pin').props.source).toEqual({ uri: PIN('engine-available') });
    expect(screen.getByTestId('map-legend-status-style-available-person-pin').props.source).toEqual({ uri: PIN('person-available') });
    expect(screen.getByTestId('map-legend-priority-style-emergency-call-pin').props.source).toEqual({ uri: PIN('call-emergency') });
    expect(screen.getByTestId('map-legend-status-style-unknown-unit-empty')).toBeTruthy();
    expect(screen.getByTestId('map-legend-priority-style-unknown-call-empty')).toBeTruthy();
  });

  it('picks each icon as the map does: IconUrl, else PinIconUrl, else the bundled ImagePath asset', async () => {
    await renderOpen();

    const row = 'map-legend-calls-row-12';
    // The type's own upload beside the name.
    expect(screen.getByTestId(`${row}-icon-upload`).props.source).toEqual({ uri: UPLOAD('structure-fire') });
    expect(screen.getByTestId(`${row}-state-1-icon-upload`).props.source).toEqual({ uri: UPLOAD('structure-fire-p1') });
    expect(screen.queryByTestId(`${row}-state-1-icon-pin`)).toBeNull();
    expect(screen.getByTestId(`${row}-state-2-icon-pin`).props.source).toEqual({ uri: PIN('fire-unknown') });
    expect(screen.getByTestId(`${row}-state-3-icon-bundled`).props.source).toBe(MAP_ICONS.fire.uri);
    // A row with no upload shows its bundled type icon; the station is the bundled station pin.
    expect(screen.getByTestId('map-legend-units-row-7-icon-bundled').props.source).toBe(MAP_ICONS.fourbyfour.uri);
    expect(screen.getByTestId('map-legend-station-icon-bundled').props.source).toBe(MAP_ICONS.station.uri);
  });

  it('falls back down the chain when a remote icon fails to load', async () => {
    await renderOpen();

    const state = 'map-legend-calls-row-12-state-1-icon';
    act(() => {
      fireEvent(screen.getByTestId(`${state}-upload`), 'error', { error: 'HTTP 404' });
    });
    expect(screen.queryByTestId(`${state}-upload`)).toBeNull();
    expect(screen.getByTestId(`${state}-pin`).props.source).toEqual({ uri: PIN('fire-emergency') });

    act(() => {
      fireEvent(screen.getByTestId(`${state}-pin`), 'error', { error: 'HTTP 500' });
    });
    expect(screen.queryByTestId(`${state}-pin`)).toBeNull();
    expect(screen.getByTestId(`${state}-bundled`).props.source).toBe(MAP_ICONS.fire.uri);
  });

  it('draws POI types as the map draws POI markers: the upload, else the coloured shape', async () => {
    await renderOpen();

    expect(screen.getByTestId('map-legend-poi-5-icon-upload').props.source).toEqual({ uri: UPLOAD('helispot') });
    expect(screen.getByTestId('map-legend-poi-4-icon-shape')).toBeTruthy();
    expect(screen.queryByTestId('map-legend-poi-4-icon-upload')).toBeNull();
  });

  it('gives each icon an accessibility label of row and state', async () => {
    await renderOpen();

    expect(screen.getByLabelText('Structure Fire · P1 Urgent')).toBeTruthy();
    expect(screen.getByLabelText('Calls with no type · P1 Urgent')).toBeTruthy();
    expect(screen.getByLabelText('Brush Truck · Mopping Up')).toBeTruthy();
    expect(screen.getByLabelText('Available · Units')).toBeTruthy();
    expect(screen.getByLabelText('Emergency · Calls')).toBeTruthy();
    expect(screen.getByLabelText('Water Point')).toBeTruthy();
  });

  it('marks a state with its own colour, ignoring values that are not hex colours', async () => {
    await renderOpen();

    expect(screen.getByTestId('map-legend-calls-row-12-state-1-dot')).toHaveStyle({ backgroundColor: '#ff0000' });
    expect(screen.queryByTestId('map-legend-calls-row-12-state-2-dot')).toBeNull();
    expect(screen.queryByTestId('map-legend-calls-row-12-state-3-dot')).toBeNull();
  });

  it('uses the department terminology for the calls, units and personnel headings', async () => {
    mockTerms['module.calls'] = 'Incidents';
    mockTerms['module.units'] = 'Apparatus';
    mockTerms['module.personnel'] = 'Members';

    await renderOpen();

    expect(screen.getByText('Incidents')).toBeTruthy();
    expect(screen.getByText('Apparatus')).toBeTruthy();
    expect(screen.getByText('Members')).toBeTruthy();
    expect(screen.getByText('Apparatus: In Quarters, Ready Reserve')).toBeTruthy();
    expect(screen.getByText('Members: Standing By')).toBeTruthy();
  });

  it('shows the personnel note and the station, and lists hydrants only when asked', async () => {
    const { unmount } = await renderOpen();

    expect(screen.getByText("A member shows the icon of the first role they hold that has one. A member On Unit takes the color of their unit's status.")).toBeTruthy();
    expect(screen.getByText('Station')).toBeTruthy();
    expect(screen.getByText('Stations and points of interest')).toBeTruthy();
    expect(screen.queryByTestId('map-legend-hydrant')).toBeNull();
    unmount();

    await renderOpen({ showHydrant: true });
    expect(screen.getByTestId('map-legend-hydrant')).toBeTruthy();
    expect(screen.getByText('Stations, hydrants and points of interest')).toBeTruthy();
  });

  it('treats missing or null lists as empty, skipping their sections without crashing', async () => {
    mockGetMapIconLegend.mockResolvedValue(envelope({ StatusStyles: null, Calls: [null, { Id: 2, Name: 'Medical', ImagePath: 'firstaid', States: null }] }));

    await renderOpen();

    expect(screen.queryByTestId('map-legend-status-colors')).toBeNull();
    expect(screen.queryByTestId('map-legend-priority-colors')).toBeNull();
    expect(screen.queryByTestId('map-legend-units')).toBeNull();
    expect(screen.queryByTestId('map-legend-personnel')).toBeNull();
    expect(screen.getByText('Medical')).toBeTruthy();
    expect(screen.getByTestId('map-legend-station')).toBeTruthy();
  });

  it('copes with a response that has no Data at all', async () => {
    mockGetMapIconLegend.mockResolvedValue({ Status: 'success' });

    await renderOpen();

    expect(screen.queryByTestId('map-legend-calls')).toBeNull();
    expect(screen.getByTestId('map-legend-station')).toBeTruthy();
  });

  it('shows a spinner while loading', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mockGetMapIconLegend.mockReturnValue(new Promise((r) => (resolve = r)));

    render(<MapLegendSheet isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByTestId('map-legend-loading')).toBeTruthy();
    expect(screen.queryByTestId('map-legend-content')).toBeNull();

    await act(async () => {
      resolve(envelope());
    });
    expect(screen.queryByTestId('map-legend-loading')).toBeNull();
    expect(screen.getByTestId('map-legend-content')).toBeTruthy();
  });

  it('shows an error with Retry, and Retry fetches again', async () => {
    mockGetMapIconLegend.mockRejectedValueOnce(new Error('Network Error'));

    render(<MapLegendSheet isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('map-legend-error')).toBeTruthy());
    expect(screen.getByText('Could not load the map legend.')).toBeTruthy();
    expect(screen.queryByTestId('map-legend-content')).toBeNull();

    fireEvent.press(screen.getByTestId('map-legend-retry'));

    await waitFor(() => expect(screen.getByTestId('map-legend-content')).toBeTruthy());
    expect(mockGetMapIconLegend).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('map-legend-error')).toBeNull();
  });

  it('fetches afresh every time it opens, so department changes show on the next open', async () => {
    const { rerender } = await renderOpen();
    expect(mockGetMapIconLegend).toHaveBeenCalledTimes(1);
    expect(mockGetMapIconLegend.mock.calls[0][0]).toBeInstanceOf(AbortSignal);

    rerender(<MapLegendSheet isOpen={false} onClose={jest.fn()} />);
    const renamed = legendData();
    renamed.Calls[1].Name = 'Building Fire';
    mockGetMapIconLegend.mockResolvedValue(envelope(renamed));

    rerender(<MapLegendSheet isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Building Fire')).toBeTruthy());
    expect(screen.queryByText('Structure Fire')).toBeNull();
    expect(mockGetMapIconLegend).toHaveBeenCalledTimes(2);
  });

  it('abandons a request still in flight when the sheet closes', async () => {
    mockGetMapIconLegend.mockReturnValue(new Promise(() => undefined));
    const { rerender } = render(<MapLegendSheet isOpen={true} onClose={jest.fn()} />);
    const signal = mockGetMapIconLegend.mock.calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(false);

    rerender(<MapLegendSheet isOpen={false} onClose={jest.fn()} />);

    expect(signal.aborted).toBe(true);
  });

  it('never draws a bundled image for a style pin', async () => {
    await renderOpen();

    const styleRow = screen.getByTestId('map-legend-status-style-unknown');
    expect(styleRow.findAll((node: any) => node.type === Image)).toHaveLength(0);
  });
});
