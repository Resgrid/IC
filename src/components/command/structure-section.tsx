import { CloudOff, Pencil, Plus, Trash2, UserPlus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getCommandNodeTypeName } from '@/lib/incident-command-utils';
import { type CommandStructureNode, type ResourceAssignment } from '@/models/v4/incidentCommand/incidentCommandModels';

import { WorkTimeLight } from './landscape-structure-board';

interface StructureSectionProps {
  nodes: CommandStructureNode[];
  assignments: ResourceAssignment[];
  resolveResourceName: (kind: number, resourceId: string) => string;
  /** Display name for a lane lead slot (resolves user ids to names); external leads pass through. */
  resolveLeadName?: (userId?: string | null, externalName?: string | null) => string | null;
  onAddLane: () => void;
  onDeleteLane: (nodeId: string) => void;
  /** Open the lane details editor (leads, linked objectives/need). */
  onEditLane?: (nodeId: string) => void;
  onAssignResource: (nodeId: string) => void;
  onMoveResource: (assignmentId: string, targetNodeId: string) => void | Promise<void>;
  onReleaseResource: (assignmentId: string) => void;
}

/** ICS command structure — lanes (Division/Group/Branch/...) with their assigned resources. */
export const StructureSection: React.FC<StructureSectionProps> = ({
  nodes,
  assignments,
  resolveResourceName,
  resolveLeadName,
  onAddLane,
  onDeleteLane,
  onEditLane,
  onAssignResource,
  onMoveResource,
  onReleaseResource,
}) => {
  const { t } = useTranslation();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const activeNodes = nodes.filter((n) => !n.DeletedOn).sort((a, b) => a.SortOrder - b.SortOrder);
  const activeAssignments = assignments.filter((a) => !a.ReleasedOn);
  const selectedAssignment = activeAssignments.find((assignment) => assignment.ResourceAssignmentId === selectedAssignmentId);

  const handleSelectResource = useCallback((assignmentId: string) => {
    setSelectedAssignmentId((current) => (current === assignmentId ? null : assignmentId));
  }, []);

  const handleLanePress = useCallback(
    async (targetNodeId: string) => {
      if (!selectedAssignmentId) {
        return;
      }
      const assignment = activeAssignments.find((item) => item.ResourceAssignmentId === selectedAssignmentId);
      setSelectedAssignmentId(null);
      if (assignment && assignment.CommandStructureNodeId !== targetNodeId) {
        await onMoveResource(assignment.ResourceAssignmentId, targetNodeId);
      }
    },
    [activeAssignments, onMoveResource, selectedAssignmentId]
  );

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-structure-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.structure_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({activeNodes.length})</Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={onAddLane} testID="command-structure-add">
          <ButtonIcon as={Plus} />
          <ButtonText>{t('command.add_lane')}</ButtonText>
        </Button>
      </HStack>

      {activeAssignments.length > 0 ? (
        <Text className={`mb-3 text-sm ${selectedAssignment ? 'font-medium text-primary-600 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}>
          {selectedAssignment ? t('command.move_selected_hint', { resource: resolveResourceName(selectedAssignment.ResourceKind, selectedAssignment.ResourceId) }) : t('command.drag_move_hint')}
        </Text>
      ) : null}

      {activeNodes.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_structure')}</Text>
      ) : (
        <VStack space="md">
          {activeNodes.map((node) => {
            const laneAssignments = activeAssignments.filter((a) => a.CommandStructureNodeId === node.CommandStructureNodeId);
            const laneUnitCount = laneAssignments.filter((a) => a.ResourceKind === 0 || a.ResourceKind === 2 || a.ResourceKind === 4).length;
            const isUnderstaffed = !!node.MinUnits && laneUnitCount < node.MinUnits;
            return (
              <Pressable
                key={node.CommandStructureNodeId}
                accessibilityHint={selectedAssignment ? t('command.move_resource_to_lane', { resource: resolveResourceName(selectedAssignment.ResourceKind, selectedAssignment.ResourceId), lane: node.Name }) : undefined}
                style={node.Color ? { borderLeftWidth: 4, borderLeftColor: node.Color } : undefined}
                className={`rounded-lg border p-3 ${selectedAssignment && selectedAssignment.CommandStructureNodeId !== node.CommandStructureNodeId ? 'border-primary-400 bg-primary-50 dark:bg-primary-950' : 'border-gray-200 dark:border-gray-700'}`}
                onPress={() => void handleLanePress(node.CommandStructureNodeId)}
                testID={`lane-${node.CommandStructureNodeId}`}
              >
                <HStack className="mb-2 items-center justify-between">
                  <VStack className="flex-1">
                    <HStack space="sm" className="items-center">
                      <Text className="text-base font-semibold text-gray-900 dark:text-white">{node.Name}</Text>
                      {isUnderstaffed ? (
                        <Badge action="warning" variant="solid" testID={`lane-understaffed-${node.CommandStructureNodeId}`}>
                          <BadgeText className="text-white">{t('command.lane_understaffed', { count: laneUnitCount, min: node.MinUnits })}</BadgeText>
                        </Badge>
                      ) : null}
                      {node.CommandStructureNodeId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                    </HStack>
                    <Text className="text-xs uppercase text-gray-500 dark:text-gray-400">
                      {getCommandNodeTypeName(t, node.NodeType)}
                      {node.MaxUnits ? ` • ${t('command.lane_unit_capacity', { count: laneUnitCount, max: node.MaxUnits })}` : ''}
                    </Text>
                    {resolveLeadName && (node.PrimaryLeadUserId || node.PrimaryLeadName || node.SecondaryLeadUserId || node.SecondaryLeadName) ? (
                      <Text className="text-xs text-gray-500 dark:text-gray-400" testID={`lane-leads-${node.CommandStructureNodeId}`}>
                        {[resolveLeadName(node.PrimaryLeadUserId, node.PrimaryLeadName), resolveLeadName(node.SecondaryLeadUserId, node.SecondaryLeadName)]
                          .filter(Boolean)
                          .map((name, index) => `${index === 0 ? t('command.primary_lead_short') : t('command.secondary_lead_short')}: ${name}`)
                          .join(' • ')}
                      </Text>
                    ) : null}
                  </VStack>
                  <HStack space="sm" className="items-center">
                    {onEditLane ? (
                      <Pressable onPress={() => onEditLane(node.CommandStructureNodeId)} className="p-2" testID={`lane-edit-${node.CommandStructureNodeId}`}>
                        <Icon as={Pencil} size="sm" className="text-gray-400" />
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => onAssignResource(node.CommandStructureNodeId)} className="p-2" testID={`lane-assign-${node.CommandStructureNodeId}`}>
                      <Icon as={UserPlus} size="sm" className="text-primary-500" />
                    </Pressable>
                    <Pressable onPress={() => onDeleteLane(node.CommandStructureNodeId)} className="p-2" testID={`lane-delete-${node.CommandStructureNodeId}`}>
                      <Icon as={Trash2} size="sm" className="text-gray-400" />
                    </Pressable>
                  </HStack>
                </HStack>

                {laneAssignments.length === 0 ? (
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.no_resources_in_lane')}</Text>
                ) : (
                  <VStack space="xs">
                    {laneAssignments.map((assignment) => {
                      const isSelected = selectedAssignmentId === assignment.ResourceAssignmentId;
                      return (
                        <Pressable
                          key={assignment.ResourceAssignmentId}
                          accessibilityHint={t('command.drag_move_hint')}
                          className={`rounded border px-2 py-1.5 ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : assignment.RequirementsWarning ? 'border-2 border-amber-500 bg-gray-50 dark:bg-gray-900' : 'border-transparent bg-gray-50 dark:bg-gray-900'}`}
                          onLongPress={() => setSelectedAssignmentId(assignment.ResourceAssignmentId)}
                          onPress={() => handleSelectResource(assignment.ResourceAssignmentId)}
                          testID={`lane-resource-${assignment.ResourceAssignmentId}`}
                        >
                          <HStack className="items-center justify-between">
                            <HStack space="sm" className="flex-1 items-center">
                              <Text className="text-sm text-gray-900 dark:text-white">{resolveResourceName(assignment.ResourceKind, assignment.ResourceId)}</Text>
                              {assignment.ResourceAssignmentId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                              {assignment.RequirementsWarning ? (
                                <Badge action="warning" variant="solid" size="sm">
                                  <BadgeText className="text-white">{t('command.requirements_warning')}</BadgeText>
                                </Badge>
                              ) : null}
                              {isSelected ? (
                                <Badge action="info" variant="solid" size="sm">
                                  <BadgeText className="text-white">{t('command.selected')}</BadgeText>
                                </Badge>
                              ) : null}
                            </HStack>
                            <WorkTimeLight assignedOn={assignment.AssignedOn} rotationAfterMinutes={node.MaxTimeInRole} testID={`lane-worktime-${assignment.ResourceAssignmentId}`} />
                            <Pressable onPress={() => onReleaseResource(assignment.ResourceAssignmentId)} className="p-1" testID={`lane-resource-release-${assignment.ResourceAssignmentId}`}>
                              <Icon as={Trash2} size="sm" className="text-gray-400" />
                            </Pressable>
                          </HStack>
                        </Pressable>
                      );
                    })}
                  </VStack>
                )}
              </Pressable>
            );
          })}
        </VStack>
      )}
    </Box>
  );
};
