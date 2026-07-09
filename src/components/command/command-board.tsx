import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';
import { CommandNodeType, TacticalObjectiveStatus } from '@/models/v4/incidentCommand/incidentCommandEnums';
import { type PersonnelCallCheckInStatus } from '@/models/v4/incidentCommand/personnelCallCheckInStatus';

interface CommandBoardProps {
  board: IncidentCommandBoard;
}

const parAction = (status: PersonnelCallCheckInStatus['Status']): 'error' | 'warning' | 'success' => {
  if (status === 'Critical') return 'error';
  if (status === 'Warning') return 'warning';
  return 'success';
};

/** Read-only rendering of a live incident command board (structure, objectives, accountability). */
export const CommandBoard: React.FC<CommandBoardProps> = ({ board }) => {
  const { t } = useTranslation();

  const liveNodes = board.Nodes.filter((n) => !n.DeletedOn).sort((a, b) => a.SortOrder - b.SortOrder);
  const liveAssignments = board.Assignments.filter((a) => !a.ReleasedOn);
  const objectives = board.Objectives.slice().sort((a, b) => a.SortOrder - b.SortOrder);

  return (
    <VStack space="lg">
      {/* Command structure (lanes) */}
      <VStack space="sm">
        <Heading size="sm">{t('incidents.lanes')}</Heading>
        {liveNodes.length === 0 ? (
          <Text className="text-typography-500">{t('incidents.no_lanes')}</Text>
        ) : (
          liveNodes.map((node) => (
            <Card key={node.CommandStructureNodeId} className="bg-white dark:bg-gray-800">
              <HStack className="items-center justify-between">
                <VStack space="xs" className="flex-1 pr-2">
                  <Text className="font-semibold text-typography-900">{node.Name}</Text>
                  <Text className="text-xs uppercase text-typography-500">{CommandNodeType[node.NodeType] ?? ''}</Text>
                </VStack>
                <Badge action="muted" size="sm">
                  <BadgeText>{`${t('incidents.resources')}: ${liveAssignments.filter((a) => a.CommandStructureNodeId === node.CommandStructureNodeId).length}`}</BadgeText>
                </Badge>
              </HStack>
            </Card>
          ))
        )}
      </VStack>

      <Divider />

      {/* Objectives / benchmarks */}
      <VStack space="sm">
        <Heading size="sm">{t('incidents.objectives')}</Heading>
        {objectives.length === 0 ? (
          <Text className="text-typography-500">{t('incidents.no_objectives')}</Text>
        ) : (
          objectives.map((objective) => (
            <HStack key={objective.TacticalObjectiveId} className="items-center justify-between">
              <Text className="flex-1 pr-2 text-typography-900">{objective.Name}</Text>
              <Badge action={objective.Status === TacticalObjectiveStatus.Complete ? 'success' : 'muted'} size="sm">
                <BadgeText>{objective.Status === TacticalObjectiveStatus.Complete ? t('common.done') : '—'}</BadgeText>
              </Badge>
            </HStack>
          ))
        )}
      </VStack>

      <Divider />

      {/* Personnel accountability / PAR */}
      <VStack space="sm">
        <Heading size="sm">{t('incidents.accountability')}</Heading>
        {board.Accountability.length === 0 ? (
          <Text className="text-typography-500">{t('incidents.unassigned')}</Text>
        ) : (
          board.Accountability.map((person) => (
            <HStack key={person.UserId} className="items-center justify-between">
              <Text className="flex-1 pr-2 text-typography-900">{person.FullName ?? person.UserId}</Text>
              <Badge action={parAction(person.Status)} size="sm">
                <BadgeText>{person.Status}</BadgeText>
              </Badge>
            </HStack>
          ))
        )}
      </VStack>
    </VStack>
  );
};

export default CommandBoard;
