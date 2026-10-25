import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('View', props) };
});

import { MAP_ICONS } from '@/constants/map-icons';

import PinMarker, { getPinIconUrl } from '../pin-marker';

const ICON_URL = 'https://api.resgrid.dev/api/v4/UnitTypes/Icon/pit.png';

describe('PinMarker unit type icon', () => {
  it('shows the uploaded unit type icon in the pin footprint, keeping the lane ring', () => {
    render(<PinMarker accentColor="#ff0000" iconUrl={ICON_URL} imagePath="ambulance" laneLabel="Division A" size={32} title="PIT 1" />);

    const icon = screen.getByTestId('pin-type-icon');
    expect(icon.props.source).toEqual({ uri: ICON_URL });
    expect(icon.props.contentFit).toBe('contain');
    expect(icon.props.cachePolicy).toBe('memory-disk');
    expect(icon).toHaveStyle({ width: 32, height: 32, borderColor: '#ff0000', borderRadius: 16 });
    expect(screen.getByTestId('pin-lane-label')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('falls back to the bundled icon when the uploaded icon fails to load', () => {
    render(<PinMarker iconUrl={ICON_URL} imagePath="ambulance" title="PIT 1" />);

    act(() => {
      fireEvent(screen.getByTestId('pin-type-icon'), 'error', { error: 'HTTP 404' });
    });

    expect(screen.queryByTestId('pin-type-icon')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.ambulance.uri);
  });

  it('keeps the bundled icon when there is no uploaded icon (older servers, non-unit pins)', () => {
    render(<PinMarker iconUrl={null} imagePath="cartwo" title="Engine 1" />);

    expect(screen.queryByTestId('pin-type-icon')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.cartwo.uri);
  });
});

describe('PinMarker personnel role icon (Type 3 pins)', () => {
  const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/PersonnelRoles/Icon/medic.png';
  // What GetMapDataAndMarkers sends for a person; the bundled lookup lower-cases it.
  const PERSON_IMAGE = 'Person_RespondingCall' as keyof typeof MAP_ICONS;

  it('shows the role icon square, at the same size as other uploaded pins, keeping the lane ring', () => {
    render(<PinMarker accentColor="#00aa00" iconUrl={ROLE_ICON_URL} imagePath={PERSON_IMAGE} laneLabel="Rehab" size={32} title="Alex Reed" />);

    const icon = screen.getByTestId('pin-type-icon');
    expect(icon.props.source).toEqual({ uri: ROLE_ICON_URL });
    expect(icon.props.contentFit).toBe('contain');
    expect(icon).toHaveStyle({ width: 32, height: 32, borderColor: '#00aa00', borderRadius: 16 });
    expect(screen.getByText('Alex Reed')).toBeTruthy();
    expect(screen.getByTestId('pin-lane-label')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('falls back to the bundled person pin when the role icon fails to load', () => {
    render(<PinMarker accentColor="#00aa00" iconUrl={ROLE_ICON_URL} imagePath={PERSON_IMAGE} size={32} title="Alex Reed" />);

    act(() => {
      fireEvent(screen.getByTestId('pin-type-icon'), 'error', { error: 'HTTP 404' });
    });

    expect(screen.queryByTestId('pin-type-icon')).toBeNull();
    const bundled = screen.UNSAFE_getByType(Image);
    expect(bundled.props.source).toBe(MAP_ICONS.person_respondingcall.uri);
    // The lane ring moves to the bundled pin with it.
    expect(StyleSheet.flatten(bundled.props.style)).toEqual(expect.objectContaining({ width: 32, height: 32, borderColor: '#00aa00', borderRadius: 16 }));
  });

  it('looks exactly as before when the person has no role icon', () => {
    const { rerender } = render(<PinMarker iconUrl={null} imagePath={PERSON_IMAGE} size={32} title="Alex Reed" />);

    expect(screen.queryByTestId('pin-type-icon')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.person_respondingcall.uri);

    // Older servers omit the field altogether.
    rerender(<PinMarker imagePath={PERSON_IMAGE} size={32} title="Alex Reed" />);
    expect(screen.queryByTestId('pin-type-icon')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.person_respondingcall.uri);
  });
});

describe('PinMarker status / priority pin (PinIconUrl)', () => {
  // What GetMapDataAndMarkers sends for a responding engine: the bundled name plus the recoloured built-in pin.
  const ENGINE_IMAGE = 'Engine_Responding' as keyof typeof MAP_ICONS;
  const RESPONDING_PIN = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-responding?v=1';
  const ONSCENE_PIN = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-onscene?v=1';
  const UPLOAD_URL = 'https://api.resgrid.dev/api/v4/UnitTypes/Icon/engine.png?s=responding&v=1';

  it('draws the status pin in the bundled pin box, fit and lane ring, with no tint', () => {
    const { unmount } = render(<PinMarker accentColor="#ff0000" imagePath={ENGINE_IMAGE} size={32} title="Engine 1" />);
    const bundledStyle = StyleSheet.flatten(screen.UNSAFE_getByType(Image).props.style);
    unmount();

    render(<PinMarker accentColor="#ff0000" imagePath={ENGINE_IMAGE} laneLabel="Division A" pinIconUrl={RESPONDING_PIN} size={32} title="Engine 1" />);

    const statusPin = screen.getByTestId('pin-status-icon');
    expect(statusPin.props.source).toEqual({ uri: RESPONDING_PIN });
    expect(statusPin.props.contentFit).toBe('cover');
    expect(statusPin.props.cachePolicy).toBe('memory-disk');
    expect(statusPin.props.tintColor).toBeUndefined();
    expect(StyleSheet.flatten(statusPin.props.style)).toEqual(bundledStyle);
    expect(bundledStyle).toEqual(expect.objectContaining({ width: 32, height: 32, borderColor: '#ff0000', borderRadius: 16, resizeMode: 'cover' }));
    expect(screen.getByTestId('pin-lane-label')).toBeTruthy();
    expect(screen.queryByTestId('pin-type-icon')).toBeNull();
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('lets an uploaded icon win over the status pin, which wins over the bundled pin', () => {
    render(<PinMarker iconUrl={UPLOAD_URL} imagePath={ENGINE_IMAGE} pinIconUrl={RESPONDING_PIN} title="Engine 1" />);

    expect(screen.getByTestId('pin-type-icon').props.source).toEqual({ uri: UPLOAD_URL });
    expect(screen.queryByTestId('pin-status-icon')).toBeNull();
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();

    // A broken upload drops to the status pin, and a broken status pin to the bundled pin.
    act(() => {
      fireEvent(screen.getByTestId('pin-type-icon'), 'error', { error: 'HTTP 404' });
    });
    expect(screen.queryByTestId('pin-type-icon')).toBeNull();
    expect(screen.getByTestId('pin-status-icon').props.source).toEqual({ uri: RESPONDING_PIN });

    act(() => {
      fireEvent(screen.getByTestId('pin-status-icon'), 'error', { error: 'HTTP 404' });
    });
    expect(screen.queryByTestId('pin-status-icon')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.engine_responding.uri);
  });

  it('falls back to the bundled pin, lane ring included, when the status pin fails to load', () => {
    render(<PinMarker accentColor="#00aa00" imagePath={ENGINE_IMAGE} pinIconUrl={RESPONDING_PIN} size={32} title="Engine 1" />);

    act(() => {
      fireEvent(screen.getByTestId('pin-status-icon'), 'error', { error: 'HTTP 500' });
    });

    expect(screen.queryByTestId('pin-status-icon')).toBeNull();
    const bundled = screen.UNSAFE_getByType(Image);
    expect(bundled.props.source).toBe(MAP_ICONS.engine_responding.uri);
    expect(StyleSheet.flatten(bundled.props.style)).toEqual(expect.objectContaining({ width: 32, height: 32, borderColor: '#00aa00', borderRadius: 16 }));
  });

  it('redraws when only the status pin changes, and gives a new status pin a fresh attempt after a failure', () => {
    const { rerender } = render(<PinMarker imagePath={ENGINE_IMAGE} pinIconUrl={RESPONDING_PIN} title="Engine 1" />);

    act(() => {
      fireEvent(screen.getByTestId('pin-status-icon'), 'error', { error: 'HTTP 404' });
    });
    expect(screen.queryByTestId('pin-status-icon')).toBeNull();

    rerender(<PinMarker imagePath={ENGINE_IMAGE} pinIconUrl={ONSCENE_PIN} title="Engine 1" />);
    expect(screen.getByTestId('pin-status-icon').props.source).toEqual({ uri: ONSCENE_PIN });

    // The status has no meaning any more (or an older server): the bundled pin, exactly as before.
    rerender(<PinMarker imagePath={ENGINE_IMAGE} pinIconUrl={null} title="Engine 1" />);
    expect(screen.queryByTestId('pin-status-icon')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.engine_responding.uri);
  });

  it.each(['/api/v4/TypeIcons/Pins/engine-responding?v=1', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://api.resgrid.dev/pin.png', '   '])(
    'ignores a status pin that is not an absolute http(s) URL (%s)',
    (pinIconUrl) => {
      render(<PinMarker imagePath={ENGINE_IMAGE} pinIconUrl={pinIconUrl} title="Engine 1" />);

      expect(screen.queryByTestId('pin-status-icon')).toBeNull();
      expect(screen.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.engine_responding.uri);
    }
  );
});

describe('getPinIconUrl', () => {
  it('keeps absolute http(s) URLs, trimmed', () => {
    expect(getPinIconUrl(' https://api.resgrid.dev/api/v4/TypeIcons/Pins/call-high?v=1 ')).toBe('https://api.resgrid.dev/api/v4/TypeIcons/Pins/call-high?v=1');
    expect(getPinIconUrl('HTTP://localhost:5151/api/v4/TypeIcons/Pins/call-low?v=1')).toBe('HTTP://localhost:5151/api/v4/TypeIcons/Pins/call-low?v=1');
  });

  it('rejects empty, relative and non-http values', () => {
    expect(getPinIconUrl(undefined)).toBeNull();
    expect(getPinIconUrl(null)).toBeNull();
    expect(getPinIconUrl('')).toBeNull();
    expect(getPinIconUrl('https://')).toBeNull();
    expect(getPinIconUrl('//api.resgrid.dev/pin.png')).toBeNull();
    expect(getPinIconUrl('file:///pin.png')).toBeNull();
  });
});
