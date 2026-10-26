import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => React.createElement(View, props),
  };
});

import { MAP_ICONS } from '@/constants/map-icons';

import { getUnitTypeMapIconAsset, UnitTypeIcon } from '../unit-type-icon';

const ICON_URL = 'https://api.resgrid.dev/api/v4/UnitTypes/Icon/abc.png';

// The icon is decorative (hidden from assistive tech), so default queries skip it.
const getIcon = () => screen.getByTestId('type-icon', { includeHiddenElements: true });
const queryIcon = () => screen.queryByTestId('type-icon', { includeHiddenElements: true });

describe('UnitTypeIcon', () => {
  it('renders the uploaded icon when a URL is given', () => {
    render(<UnitTypeIcon iconUrl={ICON_URL} mapIcon="ambulance" size={20} testID="type-icon" />);

    const image = getIcon();
    expect(image.props.source).toEqual({ uri: ICON_URL });
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.cachePolicy).toBe('memory-disk');
    expect(image.props.style).toEqual({ width: 20, height: 20 });
    // Decorative: the unit name beside it carries the meaning.
    expect(image.props.accessible).toBe(false);
  });

  it('falls back to the bundled built-in icon when there is no upload, matching the name case-insensitively', () => {
    render(<UnitTypeIcon iconUrl={null} mapIcon="Ambulance" testID="type-icon" />);

    const image = getIcon();
    expect(image.props.source).toBe(MAP_ICONS.ambulance.uri);
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.style).toEqual({ width: 24, height: 24 });
    expect(image.props.onError).toBeUndefined();
  });

  it('renders the fallback when the type has no icon or an unknown built-in name', () => {
    const { rerender } = render(<UnitTypeIcon fallback={<Text testID="fallback">T</Text>} testID="type-icon" />);
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(queryIcon()).toBeNull();

    rerender(<UnitTypeIcon iconUrl="  " mapIcon="not-a-real-icon" fallback={<Text testID="fallback">T</Text>} testID="type-icon" />);
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(queryIcon()).toBeNull();
  });

  it('renders nothing by default when there is no icon (older servers omit the fields)', () => {
    const { toJSON } = render(<UnitTypeIcon testID="type-icon" />);
    expect(toJSON()).toBeNull();
  });

  it('falls to the built-in icon when the uploaded icon fails to load', () => {
    render(<UnitTypeIcon iconUrl={ICON_URL} mapIcon="cartwo" fallback={<Text testID="fallback">T</Text>} testID="type-icon" />);

    act(() => {
      fireEvent(getIcon(), 'error', { error: 'HTTP 404' });
    });

    expect(getIcon().props.source).toBe(MAP_ICONS.cartwo.uri);
    expect(screen.queryByTestId('fallback')).toBeNull();
  });

  it('falls to the fallback when the uploaded icon fails to load and there is no built-in icon', () => {
    render(<UnitTypeIcon iconUrl={ICON_URL} fallback={<Text testID="fallback">T</Text>} testID="type-icon" />);

    act(() => {
      fireEvent(getIcon(), 'error', { error: 'HTTP 404' });
    });

    expect(queryIcon()).toBeNull();
    expect(screen.getByTestId('fallback')).toBeTruthy();
  });

  it('retries the upload when the unit is given a different icon URL after a failure', () => {
    const { rerender } = render(<UnitTypeIcon iconUrl={ICON_URL} fallback={<Text testID="fallback">T</Text>} testID="type-icon" />);

    act(() => {
      fireEvent(getIcon(), 'error', { error: 'HTTP 404' });
    });
    expect(screen.getByTestId('fallback')).toBeTruthy();

    const nextUrl = 'https://api.resgrid.dev/api/v4/UnitTypes/Icon/def.png';
    rerender(<UnitTypeIcon iconUrl={nextUrl} fallback={<Text testID="fallback">T</Text>} testID="type-icon" />);
    expect(getIcon().props.source).toEqual({ uri: nextUrl });
  });
});

describe('getUnitTypeMapIconAsset', () => {
  it('resolves known names in any case and rejects unknown or empty ones', () => {
    expect(getUnitTypeMapIconAsset('AMBULANCE')).toBe(MAP_ICONS.ambulance.uri);
    expect(getUnitTypeMapIconAsset(' truck ')).toBe(MAP_ICONS.truck.uri);
    expect(getUnitTypeMapIconAsset('toString')).toBeNull();
    expect(getUnitTypeMapIconAsset('')).toBeNull();
    expect(getUnitTypeMapIconAsset(null)).toBeNull();
    expect(getUnitTypeMapIconAsset(undefined)).toBeNull();
  });
});
