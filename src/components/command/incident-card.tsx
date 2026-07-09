import { ChevronRightIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';

interface IncidentCardProps {
  board: IncidentCommandBoard;
  title: string;
  onPress: () => void;
}

/** Summary card for one active incident command in the Incidents list. */
export const IncidentCard: React.FC<IncidentCardProps> = ({ board, title, onPress }) => {
  const { t } = useTranslation();

  const laneCount = board.Nodes.filter((n) => !n.DeletedOn).length;
  const resourceCount = board.Assignments.filter((a) => !a.ReleasedOn).length;
  const critical = board.Accountability.filter((a) => a.Status === 'Critical').length;
  const warning = board.Accountability.filter((a) => a.Status === 'Warning').length;

  return (
    <Pressable onPress={onPress} testID="incident-card">
      <Card className="mb-3 bg-white dark:bg-gray-800">
        <HStack className="items-center justify-between">
          <VStack className="flex-1 pr-2" space="xs">
            <Text className="text-base font-semibold text-typography-900">{title}</Text>
            <HStack space="sm" className="flex-wrap items-center">
              <Badge action="muted" size="sm">
                <BadgeText>{`${t('incidents.lanes')}: ${laneCount}`}</BadgeText>
              </Badge>
              <Badge action="muted" size="sm">
                <BadgeText>{`${t('incidents.resources')}: ${resourceCount}`}</BadgeText>
              </Badge>
              {critical > 0 ? (
                <Badge action="error" size="sm">
                  <BadgeText>{`${t('incidents.par_critical')}: ${critical}`}</BadgeText>
                </Badge>
              ) : null}
              {warning > 0 ? (
                <Badge action="warning" size="sm">
                  <BadgeText>{`${t('incidents.par_warning')}: ${warning}`}</BadgeText>
                </Badge>
              ) : null}
            </HStack>
          </VStack>
          <ChevronRightIcon size={20} color="#9ca3af" />
        </HStack>
      </Card>
    </Pressable>
  );
};

export default IncidentCard;
