import { ChevronRightIcon, ClockIcon, MapPinIcon, ShieldIcon, TruckIcon, UsersIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { parseUtcMs } from '@/lib/utils';
import { type IncidentCommandSummary } from '@/models/v4/incidentCommand/incidentCommandModels';

interface IncidentCardProps {
  summary: IncidentCommandSummary;
  onPress: () => void;
}

/** "3d 4h" / "2h 05m" / "12m" elapsed label between two instants. */
export const formatIncidentDuration = (startIso: string, endIso?: string | null): string => {
  const start = parseUtcMs(startIso);
  const end = (endIso ? parseUtcMs(endIso) : null) ?? Date.now();
  if (start === null) {
    return '—';
  }
  const totalMinutes = Math.max(0, Math.floor((end - start) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
};

/** Summary card for one incident command in the Incidents list (active or ended). */
export const IncidentCard: React.FC<IncidentCardProps> = ({ summary, onPress }) => {
  const { t } = useTranslation();

  const isEnded = summary.Status !== 0;
  const title = summary.Name || summary.CallName || (summary.CallNumber ? `#${summary.CallNumber}` : t('incidents.unnamed'));
  const location = summary.CommandPostLocationText || summary.CallAddress;

  return (
    <Pressable onPress={onPress} testID="incident-card">
      <Card className="mb-3 bg-white dark:bg-gray-800">
        <HStack className="items-center justify-between">
          <VStack className="flex-1 pr-2" space="xs">
            <HStack space="sm" className="items-center">
              <Text className="min-w-0 flex-1 text-base font-semibold text-typography-900" numberOfLines={1}>
                {title}
              </Text>
              {isEnded ? (
                <Badge action="muted" size="sm" testID="incident-ended-badge">
                  <BadgeText>{t('incidents.ended_badge')}</BadgeText>
                </Badge>
              ) : (
                <Badge action="success" size="sm" testID="incident-active-badge">
                  <BadgeText>{t('incidents.active_badge')}</BadgeText>
                </Badge>
              )}
            </HStack>

            <HStack space="sm" className="items-center">
              <ClockIcon size={14} color="#9ca3af" />
              <Text className="text-sm text-gray-600 dark:text-gray-300" testID="incident-duration">
                {formatIncidentDuration(summary.EstablishedOn, summary.ClosedOn)}
              </Text>
              {summary.CommanderName ? (
                <>
                  <ShieldIcon size={14} color="#9ca3af" />
                  <Text className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300" numberOfLines={1} testID="incident-commander">
                    {summary.CommanderName}
                  </Text>
                </>
              ) : null}
            </HStack>

            {location ? (
              <HStack space="sm" className="items-center">
                <MapPinIcon size={14} color="#9ca3af" />
                <Text className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300" numberOfLines={1} testID="incident-location">
                  {location}
                </Text>
              </HStack>
            ) : null}

            <HStack space="sm" className="flex-wrap items-center">
              <Badge action="muted" size="sm">
                <TruckIcon size={12} color="#6b7280" />
                <BadgeText className="ml-1">{`${t('incidents.units')}: ${summary.AssignedUnitCount}`}</BadgeText>
              </Badge>
              <Badge action="muted" size="sm">
                <UsersIcon size={12} color="#6b7280" />
                <BadgeText className="ml-1">{`${t('incidents.personnel')}: ${summary.AssignedPersonnelCount}`}</BadgeText>
              </Badge>
            </HStack>
          </VStack>
          <ChevronRightIcon size={20} color="#9ca3af" />
        </HStack>
      </Card>
    </Pressable>
  );
};

export default IncidentCard;
