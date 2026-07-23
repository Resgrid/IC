import { router } from 'expo-router';
import { Expand, Map as MapIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { AnnotationLayers, IncidentLocationMarkers } from '@/components/command/incident-map-layers';
import MapPins from '@/components/maps/map-pins';
import Mapbox from '@/components/maps/mapbox';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { useCommandMapOverlay } from '@/hooks/use-command-map-overlay';
import { useMapGeolocationUpdates } from '@/hooks/use-map-geolocation-updates';
import { useMapSignalRUpdates } from '@/hooks/use-map-signalr-updates';
import { logger } from '@/lib/logging';
import { type IncidentCommand, type IncidentMapAnnotation } from '@/models/v4/incidentCommand/incidentCommandModels';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

interface IncidentMapCardProps {
  callId: string;
  command: IncidentCommand;
  annotations: IncidentMapAnnotation[];
}

/**
 * Non-interactive incident-map preview on the command board: the saved framing, drawn markup,
 * ICP/Staging/Rehab markers, and live positions of ONLY the units/personnel on this incident.
 * Tapping anywhere opens the fullscreen editable tactical map.
 */
export const IncidentMapCard: React.FC<IncidentMapCardProps> = ({ callId, command, annotations }) => {
  const { t } = useTranslation();
  const [pins, setPins] = useState<MapMakerInfoData[]>([]);
  const commandOverlay = useCommandMapOverlay();

  const hasSavedView = Boolean(command.MapZoomLevel && command.MapCenterLatitude && command.MapCenterLongitude);

  // Live snapshot + realtime updates (status changes re-fetch, geolocation deltas move markers in place)
  useEffect(() => {
    let cancelled = false;
    getMapDataAndMarkers()
      .then((result) => {
        if (!cancelled) {
          setPins(result?.Data?.MapMakerInfos ?? []);
        }
      })
      .catch((error) => {
        logger.warn({ message: 'Incident map card failed to load markers', context: { error } });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useMapSignalRUpdates(setPins);
  useMapGeolocationUpdates(setPins);

  // Only units/personnel that are ON this incident (assigned in lanes/staging or tracked resources)
  const incidentPins = useMemo(() => {
    const allowed = new Set(
      Object.entries(commandOverlay)
        .filter(([, info]) => info.callId === callId)
        .map(([markerId]) => markerId)
    );
    return pins.filter((pin) => allowed.has(pin.Id));
  }, [pins, commandOverlay, callId]);

  const openFullscreen = () => router.push(`/command-map/${callId}` as never);

  if (!hasSavedView) {
    return (
      <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="incident-map-card-empty">
        <HStack className="items-center justify-between">
          <HStack space="sm" className="items-center">
            <Icon as={MapIcon} size="sm" className="text-gray-500" />
            <Heading size="sm">{t('command.incident_map_section')}</Heading>
          </HStack>
          <Button size="xs" variant="outline" onPress={openFullscreen} testID="incident-map-create">
            <ButtonText>{t('command.incident_map_create')}</ButtonText>
          </Button>
        </HStack>
        <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('command.incident_map_empty_description')}</Text>
      </Box>
    );
  }

  return (
    <Box className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800" testID="incident-map-card">
      <HStack className="items-center justify-between px-4 py-2">
        <HStack space="sm" className="items-center">
          <Icon as={MapIcon} size="sm" className="text-gray-500" />
          <Heading size="sm">{t('command.incident_map_section')}</Heading>
        </HStack>
        <Icon as={Expand} size="sm" className="text-gray-400" />
      </HStack>

      <Pressable onPress={openFullscreen} accessibilityLabel={t('command.incident_map_open')} testID="incident-map-open">
        <View style={styles.mapContainer} pointerEvents="none">
          <Mapbox.MapView style={styles.map} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} logoEnabled={false} attributionEnabled={false} compassEnabled={false}>
            <Mapbox.Camera centerCoordinate={[parseFloat(command.MapCenterLongitude ?? '0'), parseFloat(command.MapCenterLatitude ?? '0')]} zoomLevel={parseFloat(command.MapZoomLevel ?? '12')} animationDuration={0} />
            <AnnotationLayers annotations={annotations} />
            <IncidentLocationMarkers command={command} />
            <MapPins pins={incidentPins} commandOverlay={commandOverlay} />
          </Mapbox.MapView>
        </View>
      </Pressable>
    </Box>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  mapContainer: {
    height: 220,
    width: '100%',
  },
});

export default IncidentMapCard;
