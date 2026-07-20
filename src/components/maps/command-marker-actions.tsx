import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { useCommandMapOverlay } from '@/hooks/use-command-map-overlay';
import { ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandModels';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useCommandStore } from '@/stores/command/store';
import { useToastStore } from '@/stores/toast/store';

interface CommandMarkerActionsProps {
  pin: MapMakerInfoData;
  /** Close the parent sheet after a successful action. */
  onDone?: () => void;
}

/**
 * Command-board actions for a tapped unit/personnel map marker while a command is active:
 * shows the resource's lane, moves it between lanes, releases it, or adds an untracked
 * department resource to the board.
 */
export const CommandMarkerActions: React.FC<CommandMarkerActionsProps> = ({ pin, onDone }) => {
  const { t } = useTranslation();
  const overlay = useCommandMapOverlay();
  const boards = useCommandStore((state) => state.boards);
  const activeCallId = useCommandStore((state) => state.activeCallId);
  const moveResourceAssignment = useCommandStore((state) => state.moveResourceAssignment);
  const releaseResourceAssignment = useCommandStore((state) => state.releaseResourceAssignment);
  const assignResourceToNode = useCommandStore((state) => state.assignResourceToNode);
  const showToast = useToastStore((state) => state.showToast);

  const board = activeCallId ? boards[activeCallId]?.board : undefined;
  const info = overlay[pin.Id];
  // GetMapDataAndMarkers: units are Type 1 with `u{unitId}` ids, personnel Type 3 with `p{userId}` —
  // prefix alone is not enough (POI ids can also start with 'p').
  const isUnitMarker = pin.Type === 1 && pin.Id.startsWith('u');
  const isPersonnelMarker = pin.Type === 3 && pin.Id.startsWith('p');

  const lanes = (board?.Nodes ?? []).filter((n) => !n.DeletedOn);

  const handleMove = useCallback(
    async (targetNodeId: string) => {
      if (!activeCallId || !info || info.nodeId === targetNodeId) {
        return;
      }
      const outcome = await moveResourceAssignment(activeCallId, info.assignmentId, targetNodeId);
      if (outcome?.blocked) {
        showToast('error', outcome.blocked);
        return;
      }
      if (outcome?.warning) {
        showToast('warning', outcome.warning);
      }
      onDone?.();
    },
    [activeCallId, info, moveResourceAssignment, showToast, onDone]
  );

  const handleRelease = useCallback(async () => {
    if (!activeCallId || !info) {
      return;
    }
    await releaseResourceAssignment(activeCallId, info.assignmentId);
    onDone?.();
  }, [activeCallId, info, releaseResourceAssignment, onDone]);

  const handleAddToCommand = useCallback(async () => {
    if (!activeCallId) {
      return;
    }
    const kind = isUnitMarker ? ResourceAssignmentKind.RealUnit : ResourceAssignmentKind.RealPersonnel;
    const outcome = await assignResourceToNode(activeCallId, '', kind, pin.Id.slice(1));
    if (outcome?.blocked) {
      showToast('error', outcome.blocked);
      return;
    }
    if (outcome?.warning) {
      showToast('warning', outcome.warning);
    }
    showToast('success', t('command.added_to_command'));
  }, [activeCallId, isUnitMarker, assignResourceToNode, pin.Id, showToast, t]);

  // Only unit/personnel markers get command actions, and only while a board is active
  if (!board || (!isUnitMarker && !isPersonnelMarker)) {
    return null;
  }

  return (
    <VStack space="sm" className="mt-2" testID="command-marker-actions">
      <Heading size="xs">{t('command.map_command_section')}</Heading>

      {info ? (
        <>
          <HStack className="flex-wrap items-center" space="sm">
            {/* Unassigned pool chip + one chip per lane; the current location is highlighted */}
            <Pressable
              className={`mb-1 rounded-full px-3 py-1.5 ${info.nodeId === '' ? 'bg-primary-500' : 'bg-gray-100 dark:bg-gray-800'}`}
              onPress={() => handleMove('')}
              disabled={info.nodeId === ''}
              testID="marker-lane-unassigned"
            >
              <Text className={info.nodeId === '' ? 'text-xs font-semibold text-white' : 'text-xs text-gray-700 dark:text-gray-200'}>{t('command.unassigned')}</Text>
            </Pressable>
            {lanes.map((lane) => {
              const isCurrent = info.nodeId === lane.CommandStructureNodeId;
              return (
                <Pressable
                  key={lane.CommandStructureNodeId}
                  className={`mb-1 flex-row items-center rounded-full px-3 py-1.5 ${isCurrent ? 'bg-primary-500' : 'bg-gray-100 dark:bg-gray-800'}`}
                  onPress={() => handleMove(lane.CommandStructureNodeId)}
                  disabled={isCurrent}
                  testID={`marker-lane-${lane.CommandStructureNodeId}`}
                >
                  {lane.Color ? <View style={[styles.laneDot, { backgroundColor: lane.Color }]} /> : null}
                  <Text className={isCurrent ? 'text-xs font-semibold text-white' : 'text-xs text-gray-700 dark:text-gray-200'}>{lane.Name}</Text>
                </Pressable>
              );
            })}
          </HStack>
          <Button size="xs" variant="outline" action="negative" onPress={handleRelease} testID="marker-release">
            <ButtonText>{t('command.release_from_command')}</ButtonText>
          </Button>
        </>
      ) : (
        <HStack className="items-center justify-between" space="sm">
          <Badge action="muted" variant="outline">
            <BadgeText>{t('command.not_on_board')}</BadgeText>
          </Badge>
          <Button size="xs" onPress={handleAddToCommand} testID="marker-add-to-command">
            <ButtonText>{t('command.add_to_command')}</ButtonText>
          </Button>
        </HStack>
      )}
    </VStack>
  );
};

const styles = StyleSheet.create({
  laneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
});
