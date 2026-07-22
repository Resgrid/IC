import { logger } from '@/lib/logging';
import { type ActiveWeatherAlertsResult } from '@/models/v4/weatherAlerts/activeWeatherAlertsResult';
import { type WeatherAlertResult } from '@/models/v4/weatherAlerts/weatherAlertResult';
import { type WeatherAlertSettingsResult } from '@/models/v4/weatherAlerts/weatherAlertSettingsResult';
import { type WeatherAlertZonesResult } from '@/models/v4/weatherAlerts/weatherAlertZonesResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getActiveAlertsApi = createCachedApiEndpoint('/WeatherAlerts/GetActiveAlerts', { ttl: 60 * 1000, enabled: true });
// GetWeatherAlert uses a path parameter, so the endpoint is created per call
const getWeatherAlertEndpoint = (alertId: string) => createApiEndpoint(`/WeatherAlerts/GetWeatherAlert/${encodeURIComponent(alertId)}`);
const getAlertsNearLocationApi = createApiEndpoint('/WeatherAlerts/GetAlertsNearLocation');
const getAlertHistoryApi = createApiEndpoint('/WeatherAlerts/GetAlertHistory');
const getSettingsApi = createCachedApiEndpoint('/WeatherAlerts/GetSettings', { ttl: 5 * 60 * 1000, enabled: true });
const getZonesApi = createCachedApiEndpoint('/WeatherAlerts/GetZones', { ttl: 5 * 60 * 1000, enabled: true });

export const getActiveAlerts = async () => {
  const response = await getActiveAlertsApi.get<ActiveWeatherAlertsResult>();
  return response.data;
};

/** Domain error for weather-alert fetch failures — carries the alert id and endpoint, hides transport details. */
export class WeatherAlertFetchError extends Error {
  constructor(
    public readonly alertId: string,
    public readonly endpoint: string,
    cause: unknown
  ) {
    super(`Unable to load weather alert ${alertId}`, { cause });
    this.name = 'WeatherAlertFetchError';
  }
}

export const getWeatherAlert = async (alertId: string) => {
  const endpoint = `/WeatherAlerts/GetWeatherAlert/${encodeURIComponent(alertId)}`;
  try {
    const response = await getWeatherAlertEndpoint(alertId).get<WeatherAlertResult>();
    return response.data;
  } catch (error) {
    // Log with context here, then surface a domain error; callers (stores) still catch and drive
    // their own error state, so the rejection is never left unhandled.
    logger.error({ message: 'Failed to fetch weather alert', context: { alertId, endpoint, error } });
    throw new WeatherAlertFetchError(alertId, endpoint, error);
  }
};

export const getAlertsNearLocation = async (lat: number, lng: number, radiusMiles: number) => {
  const response = await getAlertsNearLocationApi.get<ActiveWeatherAlertsResult>({
    lat,
    lng,
    radiusMiles,
  });
  return response.data;
};

export const getAlertHistory = async (startDate: string, endDate: string) => {
  const response = await getAlertHistoryApi.get<ActiveWeatherAlertsResult>({
    startDate,
    endDate,
  });
  return response.data;
};

export const getWeatherAlertSettings = async () => {
  const response = await getSettingsApi.get<WeatherAlertSettingsResult>();
  return response.data;
};

export const getWeatherAlertZones = async () => {
  const response = await getZonesApi.get<WeatherAlertZonesResult>();
  return response.data;
};
