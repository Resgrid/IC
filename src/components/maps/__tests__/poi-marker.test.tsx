import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('View', props) };
});

// The lucide glyph overlaid on the shape — stubbed so the test can tell the shape rendering apart.
jest.mock('../poi-marker-icon', () => {
  const React = require('react');
  return { __esModule: true, default: (props: any) => React.createElement('View', { testID: 'poi-shape-icon', iconKey: props.iconKey }) };
});

import PoiMarker from '../poi-marker';

const ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/hydrant-key';

describe('PoiMarker type icon', () => {
  it('shows the uploaded POI-type icon in place of the shape and glyph, in the same footprint', () => {
    render(<PoiMarker color="#2563eb" iconUrl={ICON_URL} marker="MAP_PIN" poiImage="map-icon-fire-station" size={36} title="Hydrant 12" />);

    const icon = screen.getByTestId('poi-type-icon');
    expect(icon.props.source).toEqual({ uri: ICON_URL });
    expect(icon.props.contentFit).toBe('contain');
    expect(icon.props.cachePolicy).toBe('memory-disk');
    expect(icon).toHaveStyle({ width: 36, height: 48 });
    expect(screen.queryByTestId('poi-shape-icon')).toBeNull();
    expect(screen.getByText('Hydrant 12')).toBeTruthy();
  });

  it('falls back to the shape and glyph when the uploaded icon fails to load', () => {
    render(<PoiMarker color="#2563eb" iconUrl={ICON_URL} marker="MAP_PIN" poiImage="map-icon-fire-station" title="Hydrant 12" />);

    act(() => {
      fireEvent(screen.getByTestId('poi-type-icon'), 'error', { error: 'HTTP 404' });
    });

    expect(screen.queryByTestId('poi-type-icon')).toBeNull();
    expect(screen.getByTestId('poi-shape-icon')).toBeTruthy();
  });

  it('keeps the shape and glyph when there is no uploaded icon (older servers)', () => {
    render(<PoiMarker color="#2563eb" iconUrl={null} marker="MAP_PIN" poiImage="map-icon-fire-station" title="Hydrant 12" />);

    expect(screen.queryByTestId('poi-type-icon')).toBeNull();
    expect(screen.getByTestId('poi-shape-icon')).toBeTruthy();
  });
});
