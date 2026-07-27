import { Stack, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import Mapbox from '@/components/maps/mapbox';
import { Box } from '@/components/ui/box';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';

Mapbox.setAccessToken(Env.IC_MAPBOX_PUBKEY);

/** Fullscreen single-resource map: one marker at the resource's last known position. */
export default function ResourceMapScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams<{ latitude?: string; longitude?: string; title?: string; color?: string }>();

  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const latitude = parseFloat(first(params.latitude) ?? '');
  const longitude = parseFloat(first(params.longitude) ?? '');
  const title = first(params.title) ?? '';
  const rawColor = first(params.color);
  const color = rawColor && /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : '#E53E3E';

  const isValid = !Number.isNaN(latitude) && !Number.isNaN(longitude) && (latitude !== 0 || longitude !== 0);

  if (!isValid) {
    return (
      <Box className="flex-1 items-center justify-center bg-gray-100 dark:bg-gray-950">
        <Stack.Screen options={{ title, headerShown: true }} />
        <FocusAwareStatusBar />
        <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.resource_position_unknown')}</Text>
      </Box>
    );
  }

  return (
    <Box className="flex-1">
      <Stack.Screen options={{ title, headerShown: true }} />
      <FocusAwareStatusBar />
      <Mapbox.MapView style={styles.map} styleURL={colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street} logoEnabled={false} attributionEnabled={false} compassEnabled={true}>
        <Mapbox.Camera zoomLevel={15} centerCoordinate={[longitude, latitude]} animationMode="flyTo" animationDuration={800} />
        <Mapbox.MarkerView id="resourcePosition" coordinate={[longitude, latitude]} anchor={{ x: 0.5, y: 1.0 }} allowOverlap={true}>
          <View style={styles.markerContainer}>
            <View style={[styles.markerPin, { backgroundColor: color }]} />
            <View style={[styles.markerDot, { borderTopColor: color }]} />
          </View>
        </Mapbox.MarkerView>
      </Mapbox.MapView>
    </Box>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 40,
  },
  markerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerDot: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
