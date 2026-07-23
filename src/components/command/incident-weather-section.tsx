import { router } from 'expo-router';
import { CloudAlert, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getAlertsNearLocation } from '@/api/weather-alerts/weather-alerts';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { formatWeatherAlertDate, getSeverityColor, isAlertActive } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

/** Radius (miles) around the incident location to pull weather alerts for. */
const ALERT_RADIUS_MILES = 15;

interface IncidentWeatherSectionProps {
  /** Incident location: the ICP when set, otherwise the call's coordinates. */
  latitude: number;
  longitude: number;
  /** True when the coordinates come from the ICP (vs the call's own location). */
  isIcpLocation: boolean;
}

/** Active weather alerts at the incident's own location (ICP first, call location fallback). */
export const IncidentWeatherSection: React.FC<IncidentWeatherSectionProps> = ({ latitude, longitude, isIcpLocation }) => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<WeatherAlertResultData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAlertsNearLocation(latitude, longitude, ALERT_RADIUS_MILES);
      setAlerts((result?.Data ?? []).filter(isAlertActive));
    } catch (error) {
      logger.warn({ message: 'Incident weather alerts fetch failed', context: { error, latitude, longitude } });
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-weather-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Icon as={CloudAlert} size="sm" className="text-gray-500" />
          <Heading size="sm">{t('command.incident_weather_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({alerts.length})</Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={fetchAlerts} isDisabled={isLoading} testID="incident-weather-refresh">
          {isLoading ? <Spinner size="small" /> : <ButtonIcon as={RefreshCw} />}
        </Button>
      </HStack>

      <Text className="mb-2 text-xs text-gray-500 dark:text-gray-400">{isIcpLocation ? t('command.incident_weather_at_icp') : t('command.incident_weather_at_call')}</Text>

      {alerts.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{isLoading ? t('common.loading') : t('command.incident_weather_none')}</Text>
      ) : (
        <VStack space="sm">
          {alerts.map((alert) => (
            <Pressable key={alert.WeatherAlertId} onPress={() => router.push(`/weather-alert/${alert.WeatherAlertId}` as never)} testID={`incident-weather-${alert.WeatherAlertId}`}>
              <HStack space="sm" className="items-center rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
                <Box className="h-8 w-1.5 rounded-full" style={{ backgroundColor: getSeverityColor(alert.Severity) }} />
                <VStack className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
                    {alert.Event}
                  </Text>
                  {alert.ExpiresUtc ? (
                    <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                      {t('command.incident_weather_expires', { when: formatWeatherAlertDate(alert.ExpiresUtc) })}
                    </Text>
                  ) : null}
                </VStack>
                <Badge action="muted" size="sm">
                  <BadgeText>{t('command.incident_weather_view')}</BadgeText>
                </Badge>
              </HStack>
            </Pressable>
          ))}
        </VStack>
      )}
    </Box>
  );
};
