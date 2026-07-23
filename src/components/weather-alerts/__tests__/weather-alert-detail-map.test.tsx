import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

import { WeatherAlertDetailMap } from '../weather-alert-detail-map';

jest.mock('@/components/maps/mapbox', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = (testID: string) =>
    function Passthrough({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) {
      return React.createElement(View, { ...props, testID }, children);
    };

  return {
    __esModule: true,
    default: {
      Camera: passthrough('mock-camera'),
      FillLayer: passthrough('mock-fill-layer'),
      LineLayer: passthrough('mock-line-layer'),
      MapView: passthrough('mock-map-view'),
      PointAnnotation: passthrough('mock-point-annotation'),
      ShapeSource: passthrough('mock-shape-source'),
    },
  };
});

const createAlert = (overrides: Partial<WeatherAlertResultData> = {}): WeatherAlertResultData => Object.assign(new WeatherAlertResultData(), overrides);

describe('WeatherAlertDetailMap', () => {
  it('fits the camera to all parts of a multipolygon alert', () => {
    const alert = createAlert({
      Polygon: JSON.stringify({
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-123, 47],
              [-122, 47],
              [-122, 48],
              [-123, 47],
            ],
          ],
          [
            [
              [-121, 45],
              [-120, 45],
              [-120, 46],
              [-121, 45],
            ],
          ],
        ],
      }),
    });

    render(<WeatherAlertDetailMap alert={alert} />);

    expect(screen.getByTestId('mock-camera').props.bounds).toEqual({
      ne: [-120, 48],
      sw: [-123, 45],
      paddingTop: 40,
      paddingBottom: 40,
      paddingLeft: 40,
      paddingRight: 40,
    });
  });

  it('centers on the alert location when polygon bounds are unavailable', () => {
    const alert = createAlert({
      CenterGeoLocation: '34.0522,-118.2437',
      Polygon: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [-118.3, 34],
          [-118.2, 34.1],
        ],
      }),
    });

    render(<WeatherAlertDetailMap alert={alert} />);

    expect(screen.getByTestId('mock-camera').props.centerCoordinate).toEqual([-118.2437, 34.0522]);
    expect(screen.getByTestId('mock-camera').props.zoomLevel).toBe(8);
    expect(screen.getByTestId('mock-point-annotation').props.coordinate).toEqual([-118.2437, 34.0522]);
  });

  it('does not show a default U.S. map when the alert has no location data', () => {
    const { toJSON } = render(<WeatherAlertDetailMap alert={createAlert()} />);

    expect(toJSON()).toBeNull();
  });
});
