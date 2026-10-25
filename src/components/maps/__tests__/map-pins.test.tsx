import { render } from '@testing-library/react-native';
import React from 'react';

import { ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandModels';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

const mockPinMarker = jest.fn((_props: any) => null);
const mockPoiMarker = jest.fn((_props: any) => null);
const mockMarkerView = jest.fn((_props: any) => undefined);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/maps/mapbox', () => ({
  __esModule: true,
  default: {
    MarkerView: (props: { children: React.ReactNode }) => {
      mockMarkerView(props);
      return props.children;
    },
  },
}));

jest.mock('../pin-marker', () => ({
  __esModule: true,
  default: (props: any) => mockPinMarker(props),
}));

jest.mock('../poi-marker', () => ({
  __esModule: true,
  default: (props: any) => mockPoiMarker(props),
}));

import MapPins from '../map-pins';

const pin = (overrides: Partial<MapMakerInfoData>) =>
  ({ Id: 'x', Longitude: 4.35, Latitude: 50.85, Title: 'Pin', zIndex: 0, ImagePath: '', InfoWindowContent: '', Color: '', Type: 0, PoiImage: '', ...overrides }) as MapMakerInfoData;

describe('MapPins type icons', () => {
  beforeEach(() => {
    mockPinMarker.mockClear();
    mockPoiMarker.mockClear();
    mockMarkerView.mockClear();
  });

  it('hands the uploaded type icon to call, unit and POI markers alike', () => {
    render(
      <MapPins
        pins={[
          pin({ Id: 'c1', Type: 0, ImagePath: 'fire', IconUrl: 'https://api.resgrid.dev/api/v4/TypeIcons/call' }),
          pin({ Id: 'u1', Type: 1, ImagePath: 'ambulance', IconUrl: 'https://api.resgrid.dev/api/v4/TypeIcons/unit' }),
          pin({ Id: 'p1', Type: 4, PoiImage: 'map-icon-hospital', IconUrl: 'https://api.resgrid.dev/api/v4/TypeIcons/poi' }),
        ]}
      />
    );

    const pinUrls = mockPinMarker.mock.calls.map(([props]) => props.iconUrl);
    expect(pinUrls).toEqual(expect.arrayContaining(['https://api.resgrid.dev/api/v4/TypeIcons/call', 'https://api.resgrid.dev/api/v4/TypeIcons/unit']));
    expect(mockPoiMarker).toHaveBeenCalledWith(expect.objectContaining({ iconUrl: 'https://api.resgrid.dev/api/v4/TypeIcons/poi', poiImage: 'map-icon-hospital' }));
  });

  it('passes no icon URL when older servers omit it, leaving the bundled rendering in place', () => {
    render(<MapPins pins={[pin({ Id: 'c2', Type: 0, ImagePath: 'fire' }), pin({ Id: 'p2', Type: 4, PoiImage: 'map-icon-hospital' })]} />);

    expect(mockPinMarker).toHaveBeenCalledWith(expect.objectContaining({ iconUrl: undefined, imagePath: 'fire' }));
    expect(mockPoiMarker).toHaveBeenCalledWith(expect.objectContaining({ iconUrl: undefined }));
  });
});

describe('MapPins personnel role icons (Type 3)', () => {
  const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/PersonnelRoles/Icon/medic.png';
  const personPin = (overrides: Partial<MapMakerInfoData> = {}) => pin({ Id: 'pabc-123', Type: 3, ImagePath: 'Person_RespondingCall', Title: 'Alex Reed', ...overrides });

  beforeEach(() => {
    mockPinMarker.mockClear();
    mockPoiMarker.mockClear();
    mockMarkerView.mockClear();
  });

  it('hands the role icon to the person pin as a regular (non-POI), centre-anchored pin', () => {
    render(<MapPins pins={[personPin({ IconUrl: ROLE_ICON_URL })]} />);

    expect(mockPoiMarker).not.toHaveBeenCalled();
    expect(mockPinMarker).toHaveBeenCalledWith(expect.objectContaining({ iconUrl: ROLE_ICON_URL, imagePath: 'Person_RespondingCall', size: 32, title: 'Alex Reed' }));
    expect(mockMarkerView).toHaveBeenCalledWith(expect.objectContaining({ id: 'pin-pabc-123', anchor: { x: 0.5, y: 0.5 } }));
  });

  it('keeps the role icon alongside the command lane label and ring when the person is on the board', () => {
    render(
      <MapPins
        pins={[personPin({ IconUrl: ROLE_ICON_URL })]}
        commandOverlay={{ 'pabc-123': { callId: '101', assignmentId: 'a1', nodeId: 'n1', laneName: 'Rehab', laneColor: '#00aa00', resourceKind: ResourceAssignmentKind.RealPersonnel, resourceId: 'abc-123' } }}
      />
    );

    expect(mockPinMarker).toHaveBeenCalledWith(expect.objectContaining({ iconUrl: ROLE_ICON_URL, laneLabel: 'Rehab', accentColor: '#00aa00' }));
  });

  it('leaves the bundled person pin in place when the person has no role icon (null, or omitted by older servers)', () => {
    render(<MapPins pins={[personPin({ IconUrl: null }), personPin({ Id: 'pdef-456' })]} />);

    expect(mockPinMarker).toHaveBeenCalledTimes(2);
    for (const [props] of mockPinMarker.mock.calls) {
      expect(props.iconUrl ?? null).toBeNull();
      expect(props.imagePath).toBe('Person_RespondingCall');
    }
  });

  it('anchors POI pins on their tip and every other pin on its centre', () => {
    render(<MapPins pins={[pin({ Id: 'poi1', Type: 4, PoiImage: 'map-icon-hospital' }), personPin(), pin({ Id: 'u1', Type: 1, ImagePath: 'ambulance' })]} />);

    const anchors = Object.fromEntries(mockMarkerView.mock.calls.map(([props]) => [props.id, props.anchor]));
    expect(anchors).toEqual({ 'pin-poi1': { x: 0.5, y: 1.0 }, 'pin-pabc-123': { x: 0.5, y: 0.5 }, 'pin-u1': { x: 0.5, y: 0.5 } });
  });
});

describe('MapPins status / priority pins (PinIconUrl)', () => {
  const CALL_HIGH = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/call-high?v=1';
  const ENGINE_RESPONDING = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-responding?v=1';
  const ENGINE_ONSCENE = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-onscene?v=1';
  const PERSON_RESPONDING = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/person-responding?v=1';

  beforeEach(() => {
    mockPinMarker.mockClear();
    mockPoiMarker.mockClear();
    mockMarkerView.mockClear();
  });

  it('hands the status / priority pin to call, unit and person markers, centre-anchored like the bundled pin', () => {
    render(
      <MapPins
        pins={[
          pin({ Id: 'c1', Type: 0, ImagePath: 'Call', PinIconUrl: CALL_HIGH, IconStyle: 'high' }),
          pin({ Id: 'u1', Type: 1, ImagePath: 'Engine_Responding', PinIconUrl: ENGINE_RESPONDING, IconStyle: 'responding' }),
          pin({ Id: 'pabc-123', Type: 3, ImagePath: 'Person_RespondingCall', PinIconUrl: PERSON_RESPONDING, IconStyle: 'responding' }),
        ]}
      />
    );

    const byImage = Object.fromEntries(mockPinMarker.mock.calls.map(([props]) => [props.imagePath, props]));
    expect(byImage.Call).toEqual(expect.objectContaining({ pinIconUrl: CALL_HIGH, iconUrl: undefined, size: 32 }));
    expect(byImage.Engine_Responding).toEqual(expect.objectContaining({ pinIconUrl: ENGINE_RESPONDING, size: 32 }));
    expect(byImage.Person_RespondingCall).toEqual(expect.objectContaining({ pinIconUrl: PERSON_RESPONDING, size: 32 }));
    for (const [props] of mockMarkerView.mock.calls) {
      expect(props.anchor).toEqual({ x: 0.5, y: 0.5 });
    }
  });

  it('passes the uploaded icon and the status pin side by side, leaving the precedence to the marker', () => {
    const uploadUrl = 'https://api.resgrid.dev/api/v4/UnitTypes/Icon/engine.png?s=responding&v=1';
    render(<MapPins pins={[pin({ Id: 'u1', Type: 1, ImagePath: 'Engine_Responding', IconUrl: uploadUrl, PinIconUrl: ENGINE_RESPONDING })]} />);

    expect(mockPinMarker).toHaveBeenCalledWith(expect.objectContaining({ iconUrl: uploadUrl, pinIconUrl: ENGINE_RESPONDING }));
  });

  it('leaves POI markers alone and passes nothing when the server sends no pin (stations, older servers)', () => {
    render(
      <MapPins pins={[pin({ Id: 'poi1', Type: 4, PoiImage: 'map-icon-hospital', PinIconUrl: null }), pin({ Id: 's1', Type: 2, ImagePath: 'Station', PinIconUrl: null }), pin({ Id: 'c2', Type: 0, ImagePath: 'fire' })]} />
    );

    expect(mockPoiMarker).toHaveBeenCalledTimes(1);
    expect(mockPoiMarker.mock.calls[0][0]).not.toHaveProperty('pinIconUrl');
    expect(mockPinMarker).toHaveBeenCalledTimes(2);
    for (const [props] of mockPinMarker.mock.calls) {
      expect(props.pinIconUrl ?? null).toBeNull();
    }
  });

  it('redraws a marker when a refetch changes only its status pin', () => {
    const responding = pin({ Id: 'u1', Type: 1, ImagePath: 'Engine_Responding', PinIconUrl: ENGINE_RESPONDING, IconStyle: 'responding' });
    const { rerender } = render(<MapPins pins={[responding]} />);
    expect(mockPinMarker).toHaveBeenLastCalledWith(expect.objectContaining({ pinIconUrl: ENGINE_RESPONDING }));

    // Same pin object (e.g. an unrelated pin moved): the memoised marker is not redrawn.
    mockPinMarker.mockClear();
    rerender(<MapPins pins={[responding]} />);
    expect(mockPinMarker).not.toHaveBeenCalled();

    // The refetch after a status change hands over a new pin that differs only in its pin URL / style.
    rerender(<MapPins pins={[{ ...responding, PinIconUrl: ENGINE_ONSCENE, IconStyle: 'onscene' }]} />);
    expect(mockPinMarker).toHaveBeenCalledTimes(1);
    expect(mockPinMarker).toHaveBeenLastCalledWith(expect.objectContaining({ pinIconUrl: ENGINE_ONSCENE, imagePath: 'Engine_Responding' }));
  });
});
