import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('View', props) };
});

import { MAP_ICONS } from '@/constants/map-icons';

import PinMarker from '../pin-marker';

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
