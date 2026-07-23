import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { type IncidentNeedEntity, NeedEntityKind } from '@/models/v4/incidentCommand/incidentCommandModels';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

const FALLBACK_COLOR = '#6b7280';

const asHexColor = (value?: string | null): string | null => (value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : null);

/** Solid chip tinted with a server-provided status color. */
const StatusChip: React.FC<{ label: string; color?: string | null; testID?: string }> = ({ label, color, testID }) => (
  <View style={[styles.chip, { backgroundColor: asHexColor(color) ?? FALLBACK_COLOR }]} testID={testID}>
    <Text style={styles.chipText}>{label}</Text>
  </View>
);

interface NeedEntityStatusListProps {
  incidentNeedId: string;
  fetchEntities: (incidentNeedId: string) => Promise<IncidentNeedEntity[]>;
  /** Live unit status snapshot (units store). */
  unitStatuses: UnitStatusResultData[];
  /** Personnel roster with live status + staffing (roles store). */
  personnel: PersonnelInfoResultData[];
}

/**
 * The units/users/roles/groups toned out under an Entity need, with each unit's live status and
 * each user's live status AND staffing. Roles/groups show as requested (their members respond
 * individually and land on the incident log).
 */
export const NeedEntityStatusList: React.FC<NeedEntityStatusListProps> = ({ incidentNeedId, fetchEntities, unitStatuses, personnel }) => {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<IncidentNeedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchEntities(incidentNeedId)
      .then((rows) => {
        if (!cancelled) {
          setEntities(rows);
        }
      })
      .catch((error) => {
        // The store implementation resolves [] on failure, but the prop contract doesn't
        // guarantee that — never leave a rejection unhandled.
        logger.warn({ message: 'Failed to load need entities', context: { incidentNeedId, error } });
        if (!cancelled) {
          setEntities([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [incidentNeedId, fetchEntities]);

  if (isLoading) {
    return <Spinner size="small" />;
  }

  if (entities.length === 0) {
    return <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.need_entities_none')}</Text>;
  }

  return (
    <VStack space="xs" testID={`need-entities-${incidentNeedId}`}>
      {entities.map((entity) => {
        const unitStatus = entity.EntityKind === NeedEntityKind.Unit ? unitStatuses.find((s) => s.UnitId === entity.EntityId) : undefined;
        const person = entity.EntityKind === NeedEntityKind.User ? personnel.find((p) => p.UserId === entity.EntityId) : undefined;

        return (
          <HStack key={entity.IncidentNeedEntityId} space="sm" className="items-center rounded-lg bg-gray-100 px-2 py-1.5 dark:bg-gray-800" testID={`need-entity-${entity.IncidentNeedEntityId}`}>
            <Text className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-200" numberOfLines={1}>
              {entity.EntityName || entity.EntityId}
            </Text>
            {unitStatus ? (
              <StatusChip label={unitStatus.State} color={unitStatus.StateStyle} testID={`need-entity-unit-status-${entity.IncidentNeedEntityId}`} />
            ) : person ? (
              <>
                {person.Status ? <StatusChip label={person.Status} color={person.StatusColor} testID={`need-entity-user-status-${entity.IncidentNeedEntityId}`} /> : null}
                {person.Staffing ? <StatusChip label={person.Staffing} color={person.StaffingColor} testID={`need-entity-user-staffing-${entity.IncidentNeedEntityId}`} /> : null}
              </>
            ) : (
              <Badge action="muted" size="sm">
                <BadgeText>{entity.DispatchedOn ? t('command.need_entity_dispatched') : t('command.need_entity_requested')}</BadgeText>
              </Badge>
            )}
          </HStack>
        );
      })}
    </VStack>
  );
};

const styles = StyleSheet.create({
  chip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
});
