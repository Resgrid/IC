import { RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getMapIconLegend } from '@/api/mapping/mapping';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { type GetMapIconLegendResultData, type MapLegendPoiTypeData, type MapLegendRowData, type MapLegendStyleData } from '@/models/v4/mapping/getMapIconLegendResultData';
import { TermKeys, useTerm } from '@/stores/terminology/store';

import { PinMarkerIcon } from './pin-marker';
import { PoiMarkerShape } from './poi-marker';

// The sizes MapPins draws markers at, so a legend icon is the marker icon pixel for pixel.
const PIN_ICON_SIZE = 32;
const POI_ICON_SIZE = 36;

// What GetMapDataAndMarkers sends as ImagePath for station and hydrant markers (neither has a type, status or upload).
const STATION_IMAGE_PATH = 'Station';
const HYDRANT_IMAGE_PATH = 'hydrant';

// Style keys with a label of their own (maps.legend.style.*); "unknown" is labelled per kind, anything else shows its key.
const STYLE_KEYS = new Set(['available', 'dispatched', 'responding', 'onscene', 'transporting', 'returning', 'staging', 'delayed', 'unavailable', 'low', 'medium', 'high', 'emergency']);

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The list, without null entries; anything that is not an array (a missing field) is an empty list. */
function list<T>(value: readonly (T | null | undefined)[] | null | undefined): T[] {
  return Array.isArray(value) ? (value.filter((item) => item != null) as T[]) : [];
}

const joinNames = (names: readonly (string | null | undefined)[] | null | undefined): string =>
  list(names)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .join(', ');

const validColor = (color?: string | null): string | null => {
  const value = color?.trim();
  return value && HEX_COLOR.test(value) ? value : null;
};

interface MapLegendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Show the hydrant entry: only when the map this legend explains draws hydrant markers. */
  showHydrant?: boolean;
}

/**
 * Map icon legend: every icon the department's map can show, fetched from the server each time the sheet opens so
 * renamed types, custom priorities / statuses / status sets and new uploads show on the next open. Names come from the
 * department; the app only adds its own labels for the style colours, the "none" rows and the section chrome.
 */
export const MapLegendSheet: React.FC<MapLegendSheetProps> = ({ isOpen, onClose, showHydrant = false }) => {
  const { t } = useTranslation();
  const [legend, setLegend] = useState<GetMapIconLegendResultData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  // Bumped by Retry: re-runs the fetch effect while the sheet stays open.
  const [attempt, setAttempt] = useState(0);
  const handleRetry = useCallback(() => setAttempt((value) => value + 1), []);

  // Every open (and every retry) fetches afresh; closing or unmounting abandons a request still in flight.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const controller = new AbortController();
    setLegend(null);
    setHasError(false);
    setIsLoading(true);

    getMapIconLegend(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setLegend(result?.Data ?? {});
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        logger.warn({ message: 'Map legend failed to load', context: { error } });
        setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [isOpen, attempt]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[88]} testID="map-legend-sheet">
      <VStack space="md" className="w-full">
        <Heading size="md">{t('maps.legend.title')}</Heading>

        {isLoading ? (
          <VStack space="sm" className="h-40 items-center justify-center" testID="map-legend-loading">
            <Spinner size="large" />
            <Text className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</Text>
          </VStack>
        ) : hasError ? (
          <VStack space="md" className="items-center py-8" testID="map-legend-error">
            <Text className="text-center text-sm text-red-600 dark:text-red-400">{t('maps.legend.error')}</Text>
            <Button size="sm" variant="outline" onPress={handleRetry} testID="map-legend-retry">
              <ButtonIcon as={RefreshCw} />
              <ButtonText>{t('common.retry')}</ButtonText>
            </Button>
          </VStack>
        ) : legend ? (
          <MapLegendContent legend={legend} showHydrant={showHydrant} />
        ) : null}
      </VStack>
    </CustomBottomSheet>
  );
};

interface MapLegendContentProps {
  legend: GetMapIconLegendResultData;
  showHydrant: boolean;
}

const MapLegendContent: React.FC<MapLegendContentProps> = ({ legend, showHydrant }) => {
  const { t } = useTranslation();
  // Module names follow the department's terminology (e.g. "Incidents" for calls), else the app's own words.
  const callsTerm = useTerm(TermKeys.Calls, t('maps.legend.calls'));
  const unitsTerm = useTerm(TermKeys.Units, t('maps.legend.units'));
  const personnelTerm = useTerm(TermKeys.Personnel, t('maps.legend.personnel'));

  const statusStyles = list(legend.StatusStyles);
  const priorityStyles = list(legend.PriorityStyles);
  const calls = list(legend.Calls);
  const units = list(legend.Units);
  const personnel = list(legend.Personnel);
  const poiTypes = list(legend.PoiTypes);

  const styleLabel = (key: string | null | undefined, kind: 'status' | 'priority'): string => {
    const normalized = (key ?? '').trim().toLowerCase();
    if (normalized === 'unknown') {
      return kind === 'status' ? t('maps.legend.style.unknown_status') : t('maps.legend.style.unknown_priority');
    }
    return STYLE_KEYS.has(normalized) ? t(`maps.legend.style.${normalized}`) : (key ?? '');
  };

  const namesLine = (label: string, names: readonly (string | null | undefined)[] | null | undefined): string | null => {
    const joined = joinNames(names);
    return joined ? t('maps.legend.names_line', { label, names: joined }) : null;
  };

  return (
    <VStack space="lg" className="w-full" testID="map-legend-content">
      {statusStyles.length > 0 ? (
        <LegendSection title={t('maps.legend.status_colors')} testID="map-legend-status-colors">
          {statusStyles.map((style, index) => {
            const label = styleLabel(style.Key, 'status');
            const testID = `map-legend-status-style-${style.Key || index}`;
            return (
              <LegendStyleRow
                key={`${style.Key}-${index}`}
                style={style}
                label={label}
                lines={[namesLine(unitsTerm, style.UnitStatuses), namesLine(personnelTerm, style.PersonnelStatuses)]}
                testID={testID}
                icons={
                  <>
                    <PinMarkerIcon pinIconUrl={style.UnitPinIconUrl} fallbackToBundled={false} size={PIN_ICON_SIZE} accessibilityLabel={`${label} · ${unitsTerm}`} testID={`${testID}-unit`} />
                    <PinMarkerIcon pinIconUrl={style.PersonPinIconUrl} fallbackToBundled={false} size={PIN_ICON_SIZE} accessibilityLabel={`${label} · ${personnelTerm}`} testID={`${testID}-person`} />
                  </>
                }
              />
            );
          })}
        </LegendSection>
      ) : null}

      {priorityStyles.length > 0 ? (
        <LegendSection title={t('maps.legend.priority_colors')} testID="map-legend-priority-colors">
          {priorityStyles.map((style, index) => {
            const label = styleLabel(style.Key, 'priority');
            const testID = `map-legend-priority-style-${style.Key || index}`;
            return (
              <LegendStyleRow
                key={`${style.Key}-${index}`}
                style={style}
                label={label}
                lines={[namesLine(t('maps.legend.priorities'), style.Priorities)]}
                testID={testID}
                icons={<PinMarkerIcon pinIconUrl={style.CallPinIconUrl} fallbackToBundled={false} size={PIN_ICON_SIZE} accessibilityLabel={`${label} · ${callsTerm}`} testID={`${testID}-call`} />}
              />
            );
          })}
        </LegendSection>
      ) : null}

      {calls.length > 0 ? (
        <LegendSection title={callsTerm} testID="map-legend-calls">
          {calls.map((row, index) => (
            <LegendRowCard key={`${row.Id ?? 'none'}-${index}`} row={row} name={row.Id == null ? t('maps.legend.no_call_type') : row.Name} testID={`map-legend-calls-row-${row.Id ?? 'none'}`} />
          ))}
        </LegendSection>
      ) : null}

      {units.length > 0 ? (
        <LegendSection title={unitsTerm} testID="map-legend-units">
          {units.map((row, index) => (
            <LegendRowCard
              key={`${row.Id ?? 'none'}-${index}`}
              row={row}
              name={row.Id == null ? t('maps.legend.no_unit_type') : row.Name}
              subtitle={row.StatusSetName?.trim() ? t('maps.legend.statuses_line', { name: row.StatusSetName.trim() }) : t('maps.legend.built_in_unit_statuses')}
              testID={`map-legend-units-row-${row.Id ?? 'none'}`}
            />
          ))}
        </LegendSection>
      ) : null}

      {personnel.length > 0 ? (
        <LegendSection title={personnelTerm} note={t('maps.legend.personnel_note')} testID="map-legend-personnel">
          {personnel.map((row, index) => (
            <LegendRowCard key={`${row.Id ?? 'none'}-${index}`} row={row} name={row.Id == null ? t('maps.legend.no_role_icon') : row.Name} testID={`map-legend-personnel-row-${row.Id ?? 'none'}`} />
          ))}
        </LegendSection>
      ) : null}

      <LegendSection title={showHydrant ? t('maps.legend.other_with_hydrants') : t('maps.legend.other')} testID="map-legend-other">
        <HStack className="flex-wrap rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
          <LegendTile label={t('maps.legend.station')} testID="map-legend-station">
            <PinMarkerIcon imagePath={STATION_IMAGE_PATH} size={PIN_ICON_SIZE} accessibilityLabel={t('maps.legend.station')} testID="map-legend-station-icon" />
          </LegendTile>
          {showHydrant ? (
            <LegendTile label={t('maps.legend.hydrant')} testID="map-legend-hydrant">
              <PinMarkerIcon imagePath={HYDRANT_IMAGE_PATH} size={PIN_ICON_SIZE} accessibilityLabel={t('maps.legend.hydrant')} testID="map-legend-hydrant-icon" />
            </LegendTile>
          ) : null}
          {poiTypes.map((poiType, index) => (
            <LegendPoiTypeTile key={`${poiType.PoiTypeId}-${index}`} poiType={poiType} />
          ))}
        </HStack>
      </LegendSection>
    </VStack>
  );
};

interface LegendSectionProps {
  title: string;
  note?: string;
  testID: string;
  children: React.ReactNode;
}

const LegendSection: React.FC<LegendSectionProps> = ({ title, note, testID, children }) => (
  <VStack space="sm" testID={testID}>
    <Heading size="sm" className="text-gray-900 dark:text-white">
      {title}
    </Heading>
    {note ? <Text className="text-xs text-gray-500 dark:text-gray-400">{note}</Text> : null}
    {children}
  </VStack>
);

interface LegendStyleRowProps {
  style: MapLegendStyleData;
  label: string;
  lines: (string | null)[];
  icons: React.ReactNode;
  testID: string;
}

const LegendStyleRow: React.FC<LegendStyleRowProps> = ({ style, label, lines, icons, testID }) => {
  const color = validColor(style.Color);
  return (
    <HStack space="sm" className="items-center rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800" testID={testID}>
      <HStack space="xs" className="items-center">
        {icons}
      </HStack>
      {color ? <Box className="size-4 rounded-full border border-gray-300 dark:border-gray-600" style={{ backgroundColor: color }} testID={`${testID}-swatch`} /> : null}
      <VStack className="flex-1">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">{label}</Text>
        {lines.map((line, index) =>
          line ? (
            <Text key={index} className="text-xs text-gray-600 dark:text-gray-300">
              {line}
            </Text>
          ) : null
        )}
      </VStack>
    </HStack>
  );
};

interface LegendRowCardProps {
  row: MapLegendRowData;
  name: string;
  subtitle?: string;
  testID: string;
}

const LegendRowCard: React.FC<LegendRowCardProps> = ({ row, name, subtitle, testID }) => {
  const states = list(row.States);
  return (
    <VStack space="sm" className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800" testID={testID}>
      <HStack space="sm" className="items-center">
        <PinMarkerIcon iconUrl={row.IconUrl} pinIconUrl={row.PinIconUrl} imagePath={row.ImagePath} size={PIN_ICON_SIZE} accessibilityLabel={name} testID={`${testID}-icon`} />
        <VStack className="flex-1">
          <Text className="text-sm font-semibold text-gray-900 dark:text-white">{name}</Text>
          {subtitle ? <Text className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</Text> : null}
        </VStack>
      </HStack>
      {states.length > 0 ? (
        <HStack className="flex-wrap">
          {states.map((state, index) => {
            const dotColor = validColor(state.Color);
            const stateTestID = `${testID}-state-${state.Id}`;
            return (
              <LegendTile
                key={`${state.Id}-${index}`}
                label={state.Name}
                testID={stateTestID}
                dot={dotColor ? <Box className="size-2 rounded-full" style={{ backgroundColor: dotColor }} testID={`${stateTestID}-dot`} /> : null}
              >
                <PinMarkerIcon iconUrl={state.IconUrl} pinIconUrl={state.PinIconUrl} imagePath={state.ImagePath} size={PIN_ICON_SIZE} accessibilityLabel={`${name} · ${state.Name}`} testID={`${stateTestID}-icon`} />
              </LegendTile>
            );
          })}
        </HStack>
      ) : null}
    </VStack>
  );
};

interface LegendTileProps {
  label: string;
  dot?: React.ReactNode;
  testID: string;
  children: React.ReactNode;
}

const LegendTile: React.FC<LegendTileProps> = ({ label, dot, testID, children }) => (
  <VStack className="w-20 items-center px-1 py-1.5" testID={testID}>
    {children}
    <HStack space="xs" className="mt-1 max-w-full items-center justify-center">
      {dot}
      <Text numberOfLines={2} className="shrink text-center text-xs text-gray-700 dark:text-gray-300">
        {label}
      </Text>
    </HStack>
  </VStack>
);

interface LegendPoiTypeTileProps {
  poiType: MapLegendPoiTypeData;
}

const LegendPoiTypeTile: React.FC<LegendPoiTypeTileProps> = ({ poiType }) => {
  const testID = `map-legend-poi-${poiType.PoiTypeId}`;
  return (
    <LegendTile label={poiType.Name} testID={testID}>
      <PoiMarkerShape
        iconUrl={poiType.IconUrl}
        poiImage={poiType.PoiImage}
        imagePath={poiType.ImagePath}
        color={poiType.Color}
        marker={poiType.Marker}
        size={POI_ICON_SIZE}
        accessibilityLabel={poiType.Name}
        testID={`${testID}-icon`}
      />
    </LegendTile>
  );
};

export default MapLegendSheet;
