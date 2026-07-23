import { AlertTriangle, CloudLightning, Flame, Heart, Leaf, type LucideIcon } from 'lucide-react-native';

import { WeatherAlertCategory, WeatherAlertSeverity, WeatherAlertStatus } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

export const SEVERITY_COLORS: Record<number, string> = {
  [WeatherAlertSeverity.Extreme]: '#7B1FA2',
  [WeatherAlertSeverity.Severe]: '#D32F2F',
  [WeatherAlertSeverity.Moderate]: '#F57C00',
  [WeatherAlertSeverity.Minor]: '#FBC02D',
  [WeatherAlertSeverity.Unknown]: '#9E9E9E',
};

export const SEVERITY_DARK_BG: Record<number, string> = {
  [WeatherAlertSeverity.Extreme]: 'rgba(123,31,162,0.2)',
  [WeatherAlertSeverity.Severe]: 'rgba(211,47,47,0.2)',
  [WeatherAlertSeverity.Moderate]: 'rgba(245,124,0,0.2)',
  [WeatherAlertSeverity.Minor]: 'rgba(251,192,45,0.2)',
  [WeatherAlertSeverity.Unknown]: 'rgba(158,158,158,0.2)',
};

export const getSeverityColor = (severity: number): string => {
  return SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[WeatherAlertSeverity.Unknown];
};

export const getSeverityTranslationKey = (severity: number): string => {
  const keys: Record<number, string> = {
    [WeatherAlertSeverity.Extreme]: 'weather_alerts.severity.extreme',
    [WeatherAlertSeverity.Severe]: 'weather_alerts.severity.severe',
    [WeatherAlertSeverity.Moderate]: 'weather_alerts.severity.moderate',
    [WeatherAlertSeverity.Minor]: 'weather_alerts.severity.minor',
    [WeatherAlertSeverity.Unknown]: 'weather_alerts.severity.unknown',
  };
  return keys[severity] ?? keys[WeatherAlertSeverity.Unknown];
};

export const getCategoryIcon = (category: number): LucideIcon => {
  const icons: Record<number, LucideIcon> = {
    [WeatherAlertCategory.Met]: CloudLightning,
    [WeatherAlertCategory.Fire]: Flame,
    [WeatherAlertCategory.Health]: Heart,
    [WeatherAlertCategory.Env]: Leaf,
    [WeatherAlertCategory.Other]: AlertTriangle,
  };
  return icons[category] ?? icons[WeatherAlertCategory.Other];
};

export const parsePolygonGeoJSON = (polygonStr: string): GeoJSON.Feature | null => {
  if (!polygonStr) return null;

  try {
    // Try parsing as GeoJSON first
    const parsed = JSON.parse(polygonStr);
    if (parsed.type === 'Feature') return parsed;
    if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
      return { type: 'Feature', properties: {}, geometry: parsed };
    }
    return null;
  } catch {
    // Try parsing as coordinate pairs "lat,lng lat,lng ..."
    try {
      const coords = polygonStr
        .trim()
        .split(/\s+/)
        .reduce<[number, number][]>((acc, pair) => {
          const parts = pair.split(',');
          if (parts.length < 2) return acc;
          const lat = Number(parts[0]);
          const lng = Number(parts[1]);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            acc.push([lng, lat]);
          }
          return acc;
        }, []);

      if (coords.length < 3) return null;

      // Close the polygon if needed
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([...first]);
      }

      return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      };
    } catch {
      return null;
    }
  }
};

export const parseCenterLocation = (centerStr: string): { latitude: number; longitude: number } | null => {
  if (!centerStr) return null;

  try {
    const [lat, lng] = centerStr.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
};

export interface WeatherAlertMapBounds {
  ne: [number, number];
  sw: [number, number];
}

export const getPolygonBounds = (feature: GeoJSON.Feature): WeatherAlertMapBounds | null => {
  const { geometry } = feature;
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return null;

  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;
  let hasValidCoordinate = false;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const position of ring) {
        const [longitude, latitude] = position;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) continue;

        hasValidCoordinate = true;
        minLongitude = Math.min(minLongitude, longitude);
        maxLongitude = Math.max(maxLongitude, longitude);
        minLatitude = Math.min(minLatitude, latitude);
        maxLatitude = Math.max(maxLatitude, latitude);
      }
    }
  }

  if (!hasValidCoordinate) return null;

  return {
    ne: [maxLongitude, maxLatitude],
    sw: [minLongitude, minLatitude],
  };
};

const DEPARTMENT_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+(AM|PM))?$/i;

export const parseWeatherAlertDate = (value?: string | null): Date | null => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  const departmentDateParts = DEPARTMENT_DATE_PATTERN.exec(trimmedValue);
  if (departmentDateParts) {
    const [, monthValue, dayValue, yearValue, hourValue, minuteValue, secondValue, meridiemValue] = departmentDateParts;
    const month = Number(monthValue);
    const day = Number(dayValue);
    const year = Number(yearValue);
    const minute = Number(minuteValue);
    const second = Number(secondValue);
    let hour = Number(hourValue);

    if (meridiemValue) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (meridiemValue.toUpperCase() === 'PM' ? 12 : 0);
    } else if (hour < 0 || hour > 23) {
      return null;
    }

    const date = new Date(year, month - 1, day, hour, minute, second);
    const isValid =
      month >= 1 &&
      month <= 12 &&
      minute >= 0 &&
      minute <= 59 &&
      second >= 0 &&
      second <= 59 &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second;

    return isValid ? date : null;
  }

  const timestamp = Date.parse(trimmedValue);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

export const formatWeatherAlertDate = (value?: string | null): string => {
  const trimmedValue = value?.trim() ?? '';
  return parseWeatherAlertDate(trimmedValue)?.toLocaleString() ?? trimmedValue;
};

export const sortAlertsBySeverity = (alerts: WeatherAlertResultData[]): WeatherAlertResultData[] => {
  return [...alerts].sort((a, b) => {
    if (a.Severity !== b.Severity) return a.Severity - b.Severity;
    const bEffectiveAt = parseWeatherAlertDate(b.EffectiveUtc)?.getTime() ?? 0;
    const aEffectiveAt = parseWeatherAlertDate(a.EffectiveUtc)?.getTime() ?? 0;
    return bEffectiveAt - aEffectiveAt;
  });
};

export const isAlertActive = (alert: WeatherAlertResultData): boolean => {
  if (alert.Status !== WeatherAlertStatus.Active) return false;
  if (alert.ExpiresUtc) {
    const expiresAt = parseWeatherAlertDate(alert.ExpiresUtc);
    return expiresAt ? expiresAt.getTime() > Date.now() : true;
  }
  return true;
};
