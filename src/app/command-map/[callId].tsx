import { Stack, useLocalSearchParams } from 'expo-router';
import { Check, Crosshair, Hexagon, Spline, Type, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { AnnotationLayers, IncidentLocationMarkers } from '@/components/command/incident-map-layers';
import ZeroState from '@/components/common/zero-state';
import MapPins from '@/components/maps/map-pins';
import Mapbox from '@/components/maps/mapbox';
import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useCommandMapOverlay } from '@/hooks/use-command-map-overlay';
import { useMapGeolocationUpdates } from '@/hooks/use-map-geolocation-updates';
import { useMapSignalRUpdates } from '@/hooks/use-map-signalr-updates';
import { logger } from '@/lib/logging';
import { IncidentMapAnnotationType } from '@/models/v4/incidentCommand/incidentCommandEnums';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useCommandStore } from '@/stores/command/store';
import { useToastStore } from '@/stores/toast/store';

type DrawMode = 'none' | 'line' | 'area' | 'text';

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];

/**
 * Fullscreen editable incident tactical map: pan/zoom freely, save the incident's framing (Save View),
 * draw lines/areas, drop text labels, and remove markup — every change syncs to the board's map card
 * and is written to the incident log server-side (author + ICS role + time).
 */
export default function CommandMapScreen() {
  const { t } = useTranslation();
  const { callId: rawCallId, mapId: rawMapId } = useLocalSearchParams<{ callId: string; mapId?: string }>();
  const callId = String(rawCallId ?? '');
  /** Editing a NAMED map when set; null = the incident's main map. */
  const mapId = typeof rawMapId === 'string' && rawMapId.length > 0 ? rawMapId : null;

  const boards = useCommandStore((state) => state.boards);
  const updateMapViewEntry = useCommandStore((state) => state.updateMapViewEntry);
  const saveIncidentMapEntry = useCommandStore((state) => state.saveIncidentMapEntry);
  const saveMapAnnotationEntry = useCommandStore((state) => state.saveMapAnnotationEntry);
  const deleteMapAnnotationEntry = useCommandStore((state) => state.deleteMapAnnotationEntry);
  const showToast = useToastStore((state) => state.showToast);

  const boardState = boards[callId];
  const command = boardState?.board?.Command ?? null;
  const namedMap = useMemo(() => (mapId ? ((boardState?.board?.Maps ?? []).find((m) => m.IncidentMapId === mapId) ?? null) : null), [mapId, boardState?.board?.Maps]);
  // Markup is per-map: a named map shows only ITS annotations; the main map shows unscoped ones.
  const annotations = useMemo(() => (boardState?.board?.Annotations ?? []).filter((a) => !a.DeletedOn && (mapId ? a.IncidentMapId === mapId : !a.IncidentMapId)), [boardState?.board?.Annotations, mapId]);

  const [pins, setPins] = useState<MapMakerInfoData[]>([]);
  const commandOverlay = useCommandMapOverlay();

  const [mode, setMode] = useState<DrawMode>('none');
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [pendingTextCoord, setPendingTextCoord] = useState<[number, number] | null>(null);
  const [textLabel, setTextLabel] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Latest camera framing, captured from map movement so "Save View" pins exactly what's on screen.
  const cameraStateRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMapDataAndMarkers()
      .then((result) => {
        if (!cancelled) {
          setPins(result?.Data?.MapMakerInfos ?? []);
        }
      })
      .catch((error) => {
        logger.warn({ message: 'Command map failed to load markers', context: { error } });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useMapSignalRUpdates(setPins);
  useMapGeolocationUpdates(setPins);

  const incidentPins = useMemo(() => {
    const allowed = new Set(
      Object.entries(commandOverlay)
        .filter(([, info]) => info.callId === callId)
        .map(([markerId]) => markerId)
    );
    return pins.filter((pin) => allowed.has(pin.Id));
  }, [pins, commandOverlay, callId]);

  const initialCamera = useMemo(() => {
    if (namedMap?.CenterLatitude && namedMap?.CenterLongitude && namedMap?.ZoomLevel) {
      return { centerCoordinate: [parseFloat(namedMap.CenterLongitude), parseFloat(namedMap.CenterLatitude)] as [number, number], zoomLevel: parseFloat(namedMap.ZoomLevel) };
    }
    if (command?.MapCenterLatitude && command?.MapCenterLongitude && command?.MapZoomLevel) {
      return { centerCoordinate: [parseFloat(command.MapCenterLongitude), parseFloat(command.MapCenterLatitude)] as [number, number], zoomLevel: parseFloat(command.MapZoomLevel) };
    }
    const icpLat = parseFloat(command?.CommandPostLatitude ?? '');
    const icpLon = parseFloat(command?.CommandPostLongitude ?? '');
    if (Number.isFinite(icpLat) && Number.isFinite(icpLon)) {
      return { centerCoordinate: [icpLon, icpLat] as [number, number], zoomLevel: 14 };
    }
    const first = incidentPins[0];
    if (first) {
      return { centerCoordinate: [first.Longitude, first.Latitude] as [number, number], zoomLevel: 13 };
    }
    return { centerCoordinate: DEFAULT_CENTER, zoomLevel: 4 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.MapCenterLatitude, command?.MapCenterLongitude, command?.MapZoomLevel, namedMap?.CenterLatitude, namedMap?.CenterLongitude, namedMap?.ZoomLevel]);

  const handleCameraChanged = useCallback((state: { properties?: { center?: number[]; zoom?: number } }) => {
    const center = state?.properties?.center;
    const zoom = state?.properties?.zoom;
    if (Array.isArray(center) && center.length >= 2 && typeof zoom === 'number') {
      cameraStateRef.current = { center: [center[0], center[1]], zoom };
    }
  }, []);

  const handleMapPress = useCallback(
    (feature: GeoJSON.Feature) => {
      const coordinates = feature?.geometry && 'coordinates' in feature.geometry ? (feature.geometry.coordinates as number[]) : null;
      if (!coordinates || coordinates.length < 2 || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
        return;
      }
      const point: [number, number] = [coordinates[0], coordinates[1]];
      if (mode === 'line' || mode === 'area') {
        setDraftPoints((points) => [...points, point]);
      } else if (mode === 'text') {
        setPendingTextCoord(point);
        setTextLabel('');
      }
    },
    [mode]
  );

  const handleSaveView = useCallback(async () => {
    const camera = cameraStateRef.current;
    if (!camera) {
      showToast('warning', t('command.incident_map_move_first'));
      return;
    }
    const ok = namedMap
      ? await saveIncidentMapEntry(callId, {
          IncidentMapId: namedMap.IncidentMapId,
          Name: namedMap.Name,
          Description: namedMap.Description,
          ExpiresOn: namedMap.ExpiresOn,
          CenterLatitude: camera.center[1].toFixed(6),
          CenterLongitude: camera.center[0].toFixed(6),
          ZoomLevel: camera.zoom.toFixed(2),
        })
      : await updateMapViewEntry(callId, camera.center[1].toFixed(6), camera.center[0].toFixed(6), camera.zoom.toFixed(2));
    showToast(ok ? 'success' : 'error', ok ? t('command.incident_map_view_saved') : t('command.incident_map_view_error'));
  }, [callId, namedMap, saveIncidentMapEntry, updateMapViewEntry, showToast, t]);

  const resetDraft = useCallback(() => {
    setMode('none');
    setDraftPoints([]);
    setPendingTextCoord(null);
    setTextLabel('');
  }, []);

  const handleFinishDraft = useCallback(async () => {
    const minimumPoints = mode === 'area' ? 3 : 2;
    if (draftPoints.length < minimumPoints) {
      showToast('warning', t('command.incident_map_need_points', { count: minimumPoints }));
      return;
    }
    const geometry: GeoJSON.Geometry = mode === 'area' ? { type: 'Polygon', coordinates: [[...draftPoints, draftPoints[0]]] } : { type: 'LineString', coordinates: draftPoints };
    const ok = await saveMapAnnotationEntry(callId, {
      AnnotationType: mode === 'area' ? IncidentMapAnnotationType.Polygon : IncidentMapAnnotationType.Line,
      IncidentMapId: mapId,
      GeoJson: JSON.stringify({ type: 'Feature', geometry, properties: {} }),
    });
    showToast(ok ? 'success' : 'error', ok ? t('command.incident_map_markup_saved') : t('command.incident_map_markup_error'));
    resetDraft();
  }, [mode, draftPoints, callId, mapId, saveMapAnnotationEntry, showToast, t, resetDraft]);

  const handleSaveText = useCallback(async () => {
    if (!pendingTextCoord || !textLabel.trim()) {
      return;
    }
    const ok = await saveMapAnnotationEntry(callId, {
      AnnotationType: IncidentMapAnnotationType.Text,
      IncidentMapId: mapId,
      Label: textLabel.trim(),
      GeoJson: JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: pendingTextCoord }, properties: {} }),
    });
    showToast(ok ? 'success' : 'error', ok ? t('command.incident_map_markup_saved') : t('command.incident_map_markup_error'));
    resetDraft();
  }, [pendingTextCoord, textLabel, callId, mapId, saveMapAnnotationEntry, showToast, t, resetDraft]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) {
      return;
    }
    const annotationId = pendingDeleteId;
    setPendingDeleteId(null);
    const ok = await deleteMapAnnotationEntry(callId, annotationId);
    showToast(ok ? 'success' : 'error', ok ? t('command.incident_map_markup_removed') : t('command.incident_map_markup_error'));
  }, [pendingDeleteId, callId, deleteMapAnnotationEntry, showToast, t]);

  const draftShape = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    if (draftPoints.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: mode === 'area' && draftPoints.length >= 3 ? [...draftPoints, draftPoints[0]] : draftPoints }, properties: {} });
    }
    return { type: 'FeatureCollection', features };
  }, [draftPoints, mode]);

  if (!command) {
    return (
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen options={{ title: t('command.incident_map_title'), headerShown: true }} />
        <FocusAwareStatusBar />
        <ZeroState heading={t('command.empty_heading')} description={t('command.empty_description')} />
      </View>
    );
  }

  const isDrawing = mode === 'line' || mode === 'area';

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900" testID="command-map-screen">
      <Stack.Screen options={{ title: namedMap?.Name ?? t('command.incident_map_title'), headerShown: true }} />
      <FocusAwareStatusBar />

      <Mapbox.MapView style={styles.map} onPress={handleMapPress} onCameraChanged={handleCameraChanged} testID="command-map-view">
        <Mapbox.Camera defaultSettings={initialCamera} />
        <AnnotationLayers annotations={annotations} onAnnotationPress={(annotationId) => (mode === 'none' ? setPendingDeleteId(annotationId) : undefined)} />
        <IncidentLocationMarkers command={command} />
        {draftShape.features.length > 0 ? (
          <Mapbox.ShapeSource id="incident-draft" shape={draftShape}>
            <Mapbox.LineLayer id="incident-draft-line" style={{ lineColor: '#2563eb', lineWidth: 3, lineDasharray: [2, 1] }} />
          </Mapbox.ShapeSource>
        ) : null}
        <MapPins pins={incidentPins} commandOverlay={commandOverlay} />
      </Mapbox.MapView>

      {/* Edit toolbar */}
      <View style={styles.toolbar} testID="command-map-toolbar">
        {isDrawing || mode === 'text' ? (
          <HStack space="sm" className="items-center rounded-xl bg-white p-2 shadow-md dark:bg-gray-800">
            <Text className="px-1 text-sm text-gray-700 dark:text-gray-200">{mode === 'text' ? t('command.incident_map_tap_to_place') : t('command.incident_map_points', { count: draftPoints.length })}</Text>
            {isDrawing ? (
              <Button size="xs" onPress={handleFinishDraft} testID="command-map-draft-done">
                <ButtonIcon as={Check} />
                <ButtonText>{t('common.done')}</ButtonText>
              </Button>
            ) : null}
            <Button size="xs" variant="outline" onPress={resetDraft} testID="command-map-draft-cancel">
              <ButtonIcon as={X} />
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
          </HStack>
        ) : (
          <HStack space="sm" className="items-center rounded-xl bg-white p-2 shadow-md dark:bg-gray-800">
            <Button size="xs" variant="outline" onPress={handleSaveView} testID="command-map-save-view">
              <ButtonIcon as={Crosshair} />
              <ButtonText>{t('command.incident_map_save_view')}</ButtonText>
            </Button>
            <Button size="xs" variant="outline" onPress={() => setMode('line')} testID="command-map-draw-line">
              <ButtonIcon as={Spline} />
              <ButtonText>{t('command.incident_map_line')}</ButtonText>
            </Button>
            <Button size="xs" variant="outline" onPress={() => setMode('area')} testID="command-map-draw-area">
              <ButtonIcon as={Hexagon} />
              <ButtonText>{t('command.incident_map_area')}</ButtonText>
            </Button>
            <Button size="xs" variant="outline" onPress={() => setMode('text')} testID="command-map-add-text">
              <ButtonIcon as={Type} />
              <ButtonText>{t('command.incident_map_text')}</ButtonText>
            </Button>
          </HStack>
        )}
      </View>

      {/* Text label input */}
      <CustomBottomSheet isOpen={pendingTextCoord !== null} onClose={resetDraft} snapPoints={[35]} testID="command-map-text-sheet">
        <VStack space="md" className="w-full">
          <Heading size="md">{t('command.incident_map_text_title')}</Heading>
          <Input size="md">
            <InputField placeholder={t('command.incident_map_text_placeholder')} value={textLabel} onChangeText={setTextLabel} testID="command-map-text-input" />
          </Input>
          <Button size="lg" onPress={handleSaveText} isDisabled={!textLabel.trim()} testID="command-map-text-save">
            <ButtonText>{t('command.save')}</ButtonText>
          </Button>
        </VStack>
      </CustomBottomSheet>

      {/* Delete markup confirmation */}
      <AlertDialog isOpen={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="command-map-delete-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('command.incident_map_delete_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">{t('command.incident_map_delete_message')}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setPendingDeleteId(null)} testID="command-map-delete-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button action="negative" onPress={handleConfirmDelete} testID="command-map-delete-confirm">
              <ButtonText>{t('command.incident_map_delete')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  toolbar: {
    left: 12,
    position: 'absolute',
    right: 12,
    top: 12,
  },
});
