/**
 * Web/Electron MarkerView anchoring: native MarkerView takes a fractional { x, y } anchor, mapbox-gl a named one.
 * Before the mapping, the web MarkerView dropped `anchor` altogether, so pins native sits on their bottom edge
 * (POI pins, incident locations, the resource position) were centred on their coordinate on web.
 *
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react-native';
import mapboxgl from 'mapbox-gl';
import React from 'react';

// The token + department-center stores are irrelevant here and pull in the app's storage layer.
jest.mock('@/lib/mapbox-token', () => ({ onMapboxAccessTokenChange: jest.fn() }));
jest.mock('@/lib/map-center', () => ({ useDepartmentMapCenter: jest.fn() }));

import { MapContext, MarkerView, PointAnnotation, toMarkerAnchor } from '../map-view.web';

const MockMarker = mapboxgl.Marker as unknown as jest.Mock;

const fakeMap = {} as never;

const renderMarker = (element: React.ReactElement) => render(<MapContext.Provider value={fakeMap}>{element}</MapContext.Provider>);

const lastMarkerOptions = () => MockMarker.mock.calls[MockMarker.mock.calls.length - 1][0];

describe('toMarkerAnchor', () => {
  it.each([
    [{ x: 0.5, y: 0.5 }, 'center'],
    [{ x: 0.5, y: 1 }, 'bottom'],
    [{ x: 0.5, y: 0 }, 'top'],
    [{ x: 0, y: 0.5 }, 'left'],
    [{ x: 1, y: 0.5 }, 'right'],
    [{ x: 0, y: 0 }, 'top-left'],
    [{ x: 1, y: 0 }, 'top-right'],
    [{ x: 0, y: 1 }, 'bottom-left'],
    [{ x: 1, y: 1 }, 'bottom-right'],
    // Fractions in between snap to the nearest named anchor.
    [{ x: 0.5, y: 0.8 }, 'bottom'],
    [{ x: 0.6, y: 0.4 }, 'center'],
  ])('maps %j to %s', (anchor, expected) => {
    expect(toMarkerAnchor(anchor)).toBe(expected);
  });

  it('passes a named anchor through and defaults to center', () => {
    expect(toMarkerAnchor('bottom-left')).toBe('bottom-left');
    expect(toMarkerAnchor(undefined)).toBe('center');
    expect(toMarkerAnchor(null)).toBe('center');
  });
});

describe('web MarkerView anchor', () => {
  beforeEach(() => {
    MockMarker.mockClear();
  });

  it('forwards a bottom-center anchor to the mapbox-gl marker, as native does', () => {
    const { unmount } = renderMarker(<MarkerView anchor={{ x: 0.5, y: 1.0 }} coordinate={[4.35, 50.85]} id="pin-poi1" allowOverlap />);

    expect(MockMarker).toHaveBeenCalledTimes(1);
    expect(lastMarkerOptions()).toEqual(expect.objectContaining({ anchor: 'bottom', element: expect.any(HTMLDivElement) }));

    unmount();
  });

  it('centres the marker when no anchor is given', () => {
    const { unmount } = renderMarker(<MarkerView coordinate={[4.35, 50.85]} id="pin-u1" />);

    expect(lastMarkerOptions()).toEqual(expect.objectContaining({ anchor: 'center' }));

    unmount();
  });

  it('gives PointAnnotation the same mapping for fractional and named anchors', () => {
    const first = renderMarker(<PointAnnotation anchor={{ x: 0.5, y: 0.5 }} coordinate={[4.35, 50.85]} id="userLocation" />);
    expect(lastMarkerOptions()).toEqual(expect.objectContaining({ anchor: 'center' }));
    first.unmount();

    const second = renderMarker(<PointAnnotation anchor="top-right" coordinate={[4.35, 50.85]} id="named" />);
    expect(lastMarkerOptions()).toEqual(expect.objectContaining({ anchor: 'top-right' }));
    second.unmount();
  });
});
