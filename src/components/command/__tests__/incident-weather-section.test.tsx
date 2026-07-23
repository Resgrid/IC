import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGetAlertsNearLocation = jest.fn();
jest.mock('@/api/weather-alerts/weather-alerts', () => ({
  getAlertsNearLocation: (...args: unknown[]) => mockGetAlertsNearLocation(...args),
}));

import { IncidentWeatherSection } from '../incident-weather-section';

const alert = (overrides: Record<string, unknown> = {}) => ({
  WeatherAlertId: 'wa-1',
  Event: 'Severe Thunderstorm Warning',
  Severity: 1,
  Status: 0,
  ExpiresUtc: '2100-01-01T00:00:00Z',
  ...overrides,
});

describe('IncidentWeatherSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches alerts for the incident location and lists active ones', async () => {
    mockGetAlertsNearLocation.mockResolvedValue({ Data: [alert(), alert({ WeatherAlertId: 'wa-expired', ExpiresUtc: '2000-01-01T00:00:00Z' })] });

    const { getByTestId, queryByTestId, unmount } = render(<IncidentWeatherSection latitude={34.05} longitude={-118.24} isIcpLocation={true} />);

    await waitFor(() => expect(getByTestId('incident-weather-wa-1')).toBeTruthy());
    expect(mockGetAlertsNearLocation).toHaveBeenCalledWith(34.05, -118.24, 15);
    expect(queryByTestId('incident-weather-wa-expired')).toBeNull();

    unmount();
  });

  it('opens the alert detail on tap', async () => {
    mockGetAlertsNearLocation.mockResolvedValue({ Data: [alert()] });
    const { getByTestId, unmount } = render(<IncidentWeatherSection latitude={34.05} longitude={-118.24} isIcpLocation={false} />);

    await waitFor(() => expect(getByTestId('incident-weather-wa-1')).toBeTruthy());
    fireEvent.press(getByTestId('incident-weather-wa-1'));

    expect(mockPush).toHaveBeenCalledWith('/weather-alert/wa-1');

    unmount();
  });
});
