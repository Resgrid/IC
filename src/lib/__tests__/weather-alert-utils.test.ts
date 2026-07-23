import { formatWeatherAlertDate, getPolygonBounds, isAlertActive, parseCenterLocation, parsePolygonGeoJSON, parseWeatherAlertDate } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

describe('weather alert map utilities', () => {
  it('computes bounds for every ring in a polygon', () => {
    const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.5, 47],
            [-122, 47],
            [-122, 47.5],
            [-122.5, 47.5],
            [-122.5, 47],
          ],
        ],
      },
    };

    expect(getPolygonBounds(feature)).toEqual({
      ne: [-122, 47.5],
      sw: [-122.5, 47],
    });
  });

  it('computes bounds across every polygon in a multipolygon', () => {
    const feature = parsePolygonGeoJSON(
      JSON.stringify({
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
      })
    );

    expect(feature).not.toBeNull();
    if (!feature) throw new Error('Expected a parsed multipolygon feature');

    expect(getPolygonBounds(feature)).toEqual({
      ne: [-120, 48],
      sw: [-123, 45],
    });
  });

  it('returns null when a feature has no valid polygon coordinates', () => {
    const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[Number.NaN, 47]]],
      },
    };

    expect(getPolygonBounds(feature)).toBeNull();
  });

  it('rejects out-of-range alert center coordinates', () => {
    expect(parseCenterLocation('91,-122')).toBeNull();
    expect(parseCenterLocation('47,-181')).toBeNull();
    expect(parseCenterLocation('47.6062,-122.3321')).toEqual({
      latitude: 47.6062,
      longitude: -122.3321,
    });
  });

  it('parses department-local 12-hour and 24-hour timestamps', () => {
    const twelveHourDate = parseWeatherAlertDate('07/23/2026 4:35:12 PM');
    const twentyFourHourDate = parseWeatherAlertDate('07/23/2026 16:35:12');

    expect(twelveHourDate).not.toBeNull();
    expect(twentyFourHourDate).not.toBeNull();
    expect(twelveHourDate?.getFullYear()).toBe(2026);
    expect(twelveHourDate?.getMonth()).toBe(6);
    expect(twelveHourDate?.getDate()).toBe(23);
    expect(twelveHourDate?.getHours()).toBe(16);
    expect(twentyFourHourDate?.getHours()).toBe(16);
  });

  it('parses ISO timestamps and safely preserves malformed display values', () => {
    expect(parseWeatherAlertDate('2026-07-23T16:35:12Z')?.getTime()).toBe(Date.parse('2026-07-23T16:35:12Z'));
    expect(parseWeatherAlertDate('02/30/2026 4:35:12 PM')).toBeNull();
    expect(formatWeatherAlertDate('not-a-date')).toBe('not-a-date');
  });

  it('evaluates active alerts using department-local expiry timestamps', () => {
    expect(
      isAlertActive({
        Status: 0,
        ExpiresUtc: '12/31/2100 11:59:59 PM',
      } as WeatherAlertResultData)
    ).toBe(true);
    expect(
      isAlertActive({
        Status: 0,
        ExpiresUtc: '01/01/2000 12:00:00 AM',
      } as WeatherAlertResultData)
    ).toBe(false);
  });
});
