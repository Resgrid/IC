import { AlertTriangle, X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type GestureResponderEvent, Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getSeverityColor } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

interface WeatherAlertBannerProps {
  alerts: WeatherAlertResultData[];
  onPress: () => void;
  onDismiss: () => void;
}

export const WeatherAlertBanner: React.FC<WeatherAlertBannerProps> = ({ alerts, onPress, onDismiss }) => {
  const { t } = useTranslation();

  if (alerts.length === 0) {
    return null;
  }

  const handleBannerPress = () => {
    onDismiss();
    onPress();
  };

  const handleDismissPress = (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    onDismiss();
  };

  const topAlert = alerts[0];
  const bgColor = getSeverityColor(topAlert.Severity);

  return (
    <Pressable onPress={handleBannerPress}>
      <Box style={{ backgroundColor: bgColor }} className="mx-4 mb-2 rounded-lg p-3">
        <HStack className="items-center justify-between">
          <HStack className="flex-1 items-center space-x-2">
            <Icon as={AlertTriangle} size="sm" color="#FFFFFF" />
            <Text className="flex-1 text-sm font-medium text-white" numberOfLines={1}>
              {topAlert.Headline || topAlert.Event}
            </Text>
          </HStack>

          {alerts.length > 1 ? (
            <Box className="mr-2 rounded-full bg-white/30 px-2 py-0.5">
              <Text className="text-xs font-bold text-white">{t('weather_alerts.banner.more_alerts', { count: alerts.length - 1 })}</Text>
            </Box>
          ) : null}

          <Pressable accessibilityLabel={t('common.dismiss')} accessibilityRole="button" className="ml-1 p-2" hitSlop={8} onPress={handleDismissPress} testID="weather-alert-banner-dismiss">
            <Icon as={X} size="sm" color="#FFFFFF" />
          </Pressable>
        </HStack>
      </Box>
    </Pressable>
  );
};
