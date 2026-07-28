import { router } from 'expo-router';
import { Mail, Map as MapIcon, MapPin, Phone, Truck, User } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { parseUtcMs } from '@/lib/utils';
import type { MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import type { ActiveUnitRoleResultData } from '@/models/v4/unitRoles/activeUnitRoleResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';
import type { UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

/** Server status colors arrive as hex ('#3498db') or legacy css labels — only trust hex. */
const asHexColor = (value?: string | null) => (value && /^#[0-9a-fA-F]{3,8}$/.test(value.trim()) ? value.trim() : undefined);

const formatTimestamp = (iso?: string | null) => {
  if (!iso) {
    return null;
  }
  const ms = parseUtcMs(iso);
  return ms === null ? null : new Date(ms).toLocaleString();
};

const parseCoords = (lat?: number | string | null, lon?: number | string | null): { latitude: number; longitude: number } | null => {
  const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
  const lonNum = typeof lon === 'string' ? parseFloat(lon) : lon;
  if (latNum === null || latNum === undefined || lonNum === null || lonNum === undefined || Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    return null;
  }
  // (0,0) is the server's "no fix" placeholder, not a real position; reject out-of-range too
  if ((latNum === 0 && lonNum === 0) || Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
    return null;
  }
  return { latitude: latNum, longitude: lonNum };
};

const ColorBadge: React.FC<{ label: string; color?: string | null; testID?: string }> = ({ label, color, testID }) => {
  const hex = asHexColor(color);
  return (
    <Badge style={hex ? { backgroundColor: hex } : styles.badgeFallback} variant="solid" testID={testID}>
      <BadgeText className="text-white">{label}</BadgeText>
    </Badge>
  );
};

const LabeledRow: React.FC<{ label: string; children: React.ReactNode; testID?: string }> = ({ label, children, testID }) => (
  <VStack space="xs" testID={testID}>
    <Text className="text-2xs font-medium uppercase text-gray-500 dark:text-gray-400">{label}</Text>
    {children}
  </VStack>
);

interface ResourceDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  kind: 'unit' | 'person';
  resourceId: string;
  /** Display name fallback when the roster entry is missing. */
  name: string;
  unit?: UnitResultData;
  /** Live unit status (state, destination, last known coordinates). */
  status?: UnitStatusResultData;
  /** Unit role seats with current assignees. */
  unitRoles?: ActiveUnitRoleResultData[];
  person?: PersonnelInfoResultData;
  /** Lane the resource sits in ('' pool → host passes the unassigned label, no color). */
  laneName?: string | null;
  laneColor?: string | null;
  /** Destructive action label (remove-from-lane vs release-from-incident). */
  actionLabel: string;
  actionTestID: string;
  onAction: () => void;
  /** Optional second action (lane items also get a full Release). */
  secondaryActionLabel?: string;
  secondaryActionTestID?: string;
  onSecondaryAction?: () => void;
}

/**
 * Read-only inspector for an incident resource (unit or person): roster info, live status/staffing,
 * role assignments, and last known position. Hosts the destructive lane/pool action for the IC.
 */
export const ResourceDetailsSheet: React.FC<ResourceDetailsSheetProps> = ({
  isOpen,
  onClose,
  kind,
  resourceId,
  name,
  unit,
  status,
  unitRoles = [],
  person,
  laneName,
  laneColor,
  actionLabel,
  actionTestID,
  onAction,
  secondaryActionLabel,
  secondaryActionTestID,
  onSecondaryAction,
}) => {
  const { t } = useTranslation();
  const [marker, setMarker] = useState<MapMakerInfoData | null>(null);
  const mapNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel a pending map navigation if the sheet unmounts before the delay elapses
  useEffect(() => {
    return () => {
      if (mapNavTimerRef.current !== null) {
        clearTimeout(mapNavTimerRef.current);
        mapNavTimerRef.current = null;
      }
    };
  }, []);

  // Personnel have no coordinates in their info payload — pull the shared map markers and
  // find this resource's pin (`u{unitId}` / `p{userId}` convention).
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // Clear the previous resource's marker so its coordinates never leak into this view
    setMarker(null);
    let cancelled = false;
    getMapDataAndMarkers()
      .then((result) => {
        if (cancelled) {
          return;
        }
        const markerId = `${kind === 'unit' ? 'u' : 'p'}${resourceId}`;
        setMarker((result?.Data?.MapMakerInfos ?? []).find((info) => info.Id === markerId) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setMarker(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, kind, resourceId]);

  const coords = (kind === 'unit' ? parseCoords(status?.Latitude, status?.Longitude) : null) ?? parseCoords(marker?.Latitude, marker?.Longitude);
  const positionText = coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : null;
  const positionTimestamp = kind === 'unit' ? formatTimestamp(status?.TimestampUtc ?? status?.Timestamp) : null;
  const laneHex = asHexColor(laneColor);

  const openResourceMap = () => {
    if (!coords) {
      return;
    }
    const displayName = kind === 'unit' ? (unit?.Name ?? name) : person ? `${person.FirstName} ${person.LastName}` : name;
    // The sheet is an RN Modal — it renders above pushed routes, so close it first and
    // navigate once the dismiss animation has had a beat to run.
    onClose();
    mapNavTimerRef.current = setTimeout(() => {
      mapNavTimerRef.current = null;
      router.push({
        pathname: '/resource-map',
        params: {
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          title: displayName,
          ...(laneHex ? { color: laneHex } : {}),
        },
      } as never);
    }, 300);
  };

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[75]}>
      <ScrollView className="w-full" showsVerticalScrollIndicator={false}>
        <VStack space="md" className="w-full pb-6">
          <HStack space="sm" className="items-center">
            <Icon as={kind === 'unit' ? Truck : User} className="text-gray-500" size="md" />
            <Heading size="md">{kind === 'unit' ? t('command.unit_details_title') : t('command.person_details_title')}</Heading>
          </HStack>

          <VStack space="xs">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white" testID="resource-details-name">
              {kind === 'unit' ? (unit?.Name ?? name) : person ? `${person.FirstName} ${person.LastName}` : name}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {kind === 'unit' ? [unit?.Type, unit?.GroupName].filter(Boolean).join(' • ') : [person?.GroupName, person?.IdentificationNumber].filter(Boolean).join(' • ')}
            </Text>
            {laneName ? (
              <HStack space="sm" className="items-center" testID="resource-details-lane">
                {laneHex ? <View style={[styles.laneDot, { backgroundColor: laneHex }]} /> : null}
                <Text style={laneHex ? { color: laneHex } : undefined} className={laneHex ? 'text-sm font-semibold' : 'text-sm text-gray-500 dark:text-gray-400'} testID="resource-details-lane-name">
                  {laneName}
                </Text>
              </HStack>
            ) : null}
          </VStack>

          {kind === 'person' && (person?.EmailAddress || person?.MobilePhone) ? (
            <VStack space="xs">
              {person?.EmailAddress ? (
                <HStack space="sm" className="items-center">
                  <Icon as={Mail} className="text-gray-400" size="sm" />
                  <Text className="text-sm text-gray-900 dark:text-white">{person.EmailAddress}</Text>
                </HStack>
              ) : null}
              {person?.MobilePhone ? (
                <HStack space="sm" className="items-center">
                  <Icon as={Phone} className="text-gray-400" size="sm" />
                  <Text className="text-sm text-gray-900 dark:text-white">{person.MobilePhone}</Text>
                </HStack>
              ) : null}
            </VStack>
          ) : null}

          <LabeledRow label={t('command.resource_status_label')} testID="resource-details-status">
            <HStack space="sm" className="flex-wrap items-center">
              {kind === 'unit' ? (
                status?.State ? (
                  <ColorBadge color={status.StateStyle} label={status.State} testID="resource-details-state" />
                ) : (
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.resource_status_unknown')}</Text>
                )
              ) : (
                <>
                  {person?.Status ? <ColorBadge color={person.StatusColor} label={person.Status} testID="resource-details-state" /> : null}
                  {person?.Staffing ? <ColorBadge color={person.StaffingColor} label={`${t('command.resource_staffing_label')}: ${person.Staffing}`} testID="resource-details-staffing" /> : null}
                  {!person?.Status && !person?.Staffing ? <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.resource_status_unknown')}</Text> : null}
                </>
              )}
            </HStack>
            {kind === 'unit' && status?.Note ? <Text className="text-sm text-gray-500 dark:text-gray-400">{status.Note}</Text> : null}
            {kind === 'unit' && (status?.DestinationName || status?.Eta) ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400">{[status?.DestinationName, status?.Eta ? t('command.unit_eta', { eta: status.Eta }) : ''].filter(Boolean).join(' • ')}</Text>
            ) : null}
          </LabeledRow>

          <LabeledRow label={t('command.resource_position_label')} testID="resource-details-position">
            {positionText ? (
              <HStack space="sm" className="items-center">
                <Icon as={MapPin} className="text-gray-400" size="sm" />
                <VStack className="flex-1">
                  <Text className="text-sm tabular-nums text-gray-900 dark:text-white" testID="resource-details-coords">
                    {positionText}
                  </Text>
                  {positionTimestamp ? <Text className="text-xs text-gray-500 dark:text-gray-400">{positionTimestamp}</Text> : null}
                </VStack>
                <Pressable accessibilityLabel={t('command.view_on_map')} accessibilityRole="button" className="p-1" onPress={openResourceMap} testID="resource-details-view-map">
                  <Icon as={MapIcon} className="text-primary-500" size="md" />
                </Pressable>
              </HStack>
            ) : (
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.resource_position_unknown')}</Text>
            )}
          </LabeledRow>

          {kind === 'unit' && unitRoles.length > 0 ? (
            <LabeledRow label={t('command.resource_unit_roles_label')} testID="resource-details-roles">
              <VStack space="xs">
                {unitRoles.map((role) => (
                  <HStack key={role.UnitRoleId} className="items-center justify-between" space="sm">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">{role.Name}</Text>
                    <Text className={`text-sm font-medium ${role.FullName ? 'text-gray-900 dark:text-white' : 'italic text-gray-400 dark:text-gray-500'}`}>{role.FullName || t('command.role_open')}</Text>
                  </HStack>
                ))}
              </VStack>
            </LabeledRow>
          ) : null}

          {kind === 'person' && (person?.Roles ?? []).length > 0 ? (
            <LabeledRow label={t('command.resource_roles_label')} testID="resource-details-roles">
              <HStack space="xs" className="flex-wrap">
                {(person?.Roles ?? []).map((role) => (
                  <Badge key={role} action="info" variant="outline" className="mb-1">
                    <BadgeText>{role}</BadgeText>
                  </Badge>
                ))}
              </HStack>
            </LabeledRow>
          ) : null}

          <Button
            action={secondaryActionLabel ? undefined : 'negative'}
            variant={secondaryActionLabel ? 'outline' : 'solid'}
            size="lg"
            onPress={() => {
              onAction();
              onClose();
            }}
            testID={actionTestID}
          >
            <ButtonText>{actionLabel}</ButtonText>
          </Button>

          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              action="negative"
              size="lg"
              onPress={() => {
                onSecondaryAction();
                onClose();
              }}
              testID={secondaryActionTestID}
            >
              <ButtonText>{secondaryActionLabel}</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </ScrollView>
    </CustomBottomSheet>
  );
};

const styles = StyleSheet.create({
  badgeFallback: {
    backgroundColor: '#6b7280',
  },
  laneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
