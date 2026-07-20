import { CloudOff, GripVertical, Plus, Trash2, UserPlus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, PanResponder, ScrollView, View as NativeView } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getCommandNodeTypeName } from '@/lib/incident-command-utils';
import { isWeb } from '@/lib/platform';
import { parseUtcMs } from '@/lib/utils';
import type { CommandStructureNode, ResourceAssignment } from '@/models/v4/incidentCommand/incidentCommandModels';

/**
 * Lane and resource cards are pressable containers that hold their own action buttons.
 * On web a "button" role renders a semantic <button>, and nested <button> elements are
 * invalid HTML (hydration errors) — so containers only carry the role on native.
 */
const containerButtonRole = isWeb ? undefined : ('button' as const);

/** Two-line clamp: numberOfLines leaks to the DOM through the styling pipeline on web, so use CSS line-clamp there. */
const twoLine = isWeb ? {} : ({ numberOfLines: 2 } as const);

/** Work-time light thresholds (Tablet Command-style crew fatigue): green under 20m, amber under 40m, red past that. */
const WORK_TIME_AMBER_MINUTES = 20;
const WORK_TIME_RED_MINUTES = 40;

export const workTimeColor = (minutes: number) => (minutes < WORK_TIME_AMBER_MINUTES ? '#22c55e' : minutes < WORK_TIME_RED_MINUTES ? '#f59e0b' : '#ef4444');

/**
 * Elapsed minutes since a resource was assigned, ticking once a minute. When the lane sets a
 * MaxTimeInRole, exceeding it turns the light red and flags the resource as rotation-due.
 */
export const WorkTimeLight: React.FC<{ assignedOn?: string | null; rotationAfterMinutes?: number; testID?: string }> = ({ assignedOn, rotationAfterMinutes, testID }) => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!assignedOn) {
      return;
    }
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [assignedOn]);

  const assignedMs = parseUtcMs(assignedOn);
  if (assignedMs === null) {
    return null;
  }
  const minutes = Math.max(0, Math.floor((nowMs - assignedMs) / 60_000));
  const isRotationDue = !!rotationAfterMinutes && rotationAfterMinutes > 0 && minutes >= rotationAfterMinutes;

  return (
    <HStack className="items-center" space="xs" testID={testID}>
      <NativeView style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isRotationDue ? '#ef4444' : workTimeColor(minutes) }} />
      <Text className={`text-xs tabular-nums ${isRotationDue ? 'font-semibold text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'}`}>{`${minutes}m`}</Text>
      {isRotationDue ? (
        <Badge action="error" variant="solid" testID={testID ? `${testID}-rotation` : undefined}>
          <BadgeText className="text-white">{t('command.rotation_due')}</BadgeText>
        </Badge>
      ) : null}
    </HStack>
  );
};

const LONG_PRESS_DELAY_MS = 350;
const DROP_MOVEMENT_THRESHOLD = 8;

interface LandscapeStructureBoardProps {
  nodes: CommandStructureNode[];
  assignments: ResourceAssignment[];
  viewportHeight: number;
  viewportWidth: number;
  resolveResourceName: (kind: number, resourceId: string) => string;
  onAddLane: () => void;
  onDeleteLane: (nodeId: string) => void;
  onAssignResource: (nodeId: string) => void;
  onMoveResource: (assignmentId: string, targetNodeId: string) => void | Promise<void>;
  onReleaseResource: (assignmentId: string) => void;
}

interface DraggableResourceCardProps {
  assignment: ResourceAssignment;
  name: string;
  /** Lane MaxTimeInRole (minutes) — flags the resource rotation-due when exceeded. */
  rotationAfterMinutes?: number;
  isSelected: boolean;
  onSelect: (assignmentId: string) => void;
  onDragStart: (assignmentId: string) => void;
  onDragEnd: () => void;
  onDrop: (assignmentId: string, pageX: number, pageY: number) => void;
  onRelease: (assignmentId: string) => void;
}

interface LaneRect {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DraggableResourceCard: React.FC<DraggableResourceCardProps> = React.memo(({ assignment, name, rotationAfterMinutes, isSelected, onSelect, onDragStart, onDragEnd, onDrop, onRelease }) => {
  const { t } = useTranslation();
  const translation = useRef(new Animated.ValueXY()).current;
  const dragReadyRef = useRef(false);
  const panActiveRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const resetDrag = useCallback(() => {
    dragReadyRef.current = false;
    panActiveRef.current = false;
    longPressTriggeredRef.current = false;
    setIsDragging(false);
    translation.setValue({ x: 0, y: 0 });
    onDragEnd();
  }, [onDragEnd, translation]);

  const finishDrag = useCallback(
    (pageX: number, pageY: number, distanceX: number, distanceY: number) => {
      const wasMoved = Math.abs(distanceX) >= DROP_MOVEMENT_THRESHOLD || Math.abs(distanceY) >= DROP_MOVEMENT_THRESHOLD;
      if (wasMoved) {
        onDrop(assignment.ResourceAssignmentId, pageX, pageY);
      }
      resetDrag();
    },
    [assignment.ResourceAssignmentId, onDrop, resetDrag]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: () => dragReadyRef.current,
        onPanResponderGrant: () => {
          panActiveRef.current = true;
        },
        onPanResponderMove: (_event, gestureState) => {
          translation.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (_event, gestureState) => {
          finishDrag(gestureState.moveX, gestureState.moveY, gestureState.dx, gestureState.dy);
        },
        onPanResponderTerminate: () => resetDrag(),
        onPanResponderTerminationRequest: () => false,
      }),
    [finishDrag, resetDrag, translation]
  );

  const handleLongPress = useCallback(() => {
    longPressTriggeredRef.current = true;
    dragReadyRef.current = true;
    setIsDragging(true);
    onDragStart(assignment.ResourceAssignmentId);
  }, [assignment.ResourceAssignmentId, onDragStart]);

  const handlePress = useCallback(() => {
    if (longPressTriggeredRef.current) {
      return;
    }
    onSelect(assignment.ResourceAssignmentId);
  }, [assignment.ResourceAssignmentId, onSelect]);

  const handlePressOut = useCallback(() => {
    if (dragReadyRef.current && !panActiveRef.current) {
      setTimeout(resetDrag, 0);
    }
  }, [resetDrag]);

  const handleRelease = useCallback(() => onRelease(assignment.ResourceAssignmentId), [assignment.ResourceAssignmentId, onRelease]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        zIndex: isDragging ? 100 : 1,
        elevation: isDragging ? 12 : 0,
        transform: translation.getTranslateTransform(),
      }}
    >
      <Pressable
        accessibilityHint={t('command.drag_move_hint')}
        accessibilityLabel={name}
        accessibilityRole={containerButtonRole}
        className={`rounded-lg border px-3 py-2 ${isSelected || isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : assignment.RequirementsWarning ? 'border-2 border-amber-500 bg-white dark:bg-gray-900' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'}`}
        delayLongPress={LONG_PRESS_DELAY_MS}
        onLongPress={handleLongPress}
        onPress={handlePress}
        onPressOut={handlePressOut}
        testID={`landscape-resource-${assignment.ResourceAssignmentId}`}
      >
        <HStack className="items-center justify-between" space="xs">
          <HStack className="flex-1 items-center" space="xs">
            <GripVertical aria-hidden={true} className="text-gray-400" size={16} />
            <Text className="flex-1 text-sm font-medium text-gray-900 web:line-clamp-2 dark:text-white" {...twoLine}>
              {name}
            </Text>
          </HStack>
          <WorkTimeLight assignedOn={assignment.AssignedOn} rotationAfterMinutes={rotationAfterMinutes} testID={`landscape-worktime-${assignment.ResourceAssignmentId}`} />
          <Pressable accessibilityLabel={t('common.remove')} accessibilityRole="button" className="p-1" onPress={handleRelease} testID={`landscape-resource-release-${assignment.ResourceAssignmentId}`}>
            <Trash2 className="text-gray-400" size={16} />
          </Pressable>
        </HStack>
        {assignment.ResourceAssignmentId.startsWith('local-') || assignment.RequirementsWarning || isSelected ? (
          <HStack className="mt-1 items-center" space="xs">
            {assignment.ResourceAssignmentId.startsWith('local-') ? <CloudOff className="text-amber-500" size={14} /> : null}
            {assignment.RequirementsWarning ? (
              <Badge action="warning" size="sm" variant="solid">
                <BadgeText className="text-white">{t('command.requirements_warning')}</BadgeText>
              </Badge>
            ) : null}
            {isSelected ? (
              <Badge action="info" size="sm" variant="solid">
                <BadgeText className="text-white">{t('command.selected')}</BadgeText>
              </Badge>
            ) : null}
          </HStack>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

DraggableResourceCard.displayName = 'DraggableResourceCard';

/** Trello-style horizontal swimlane board used on landscape tablets and larger landscape viewports. */
export const LandscapeStructureBoard: React.FC<LandscapeStructureBoardProps> = ({
  nodes,
  assignments,
  viewportHeight,
  viewportWidth,
  resolveResourceName,
  onAddLane,
  onDeleteLane,
  onAssignResource,
  onMoveResource,
  onReleaseResource,
}) => {
  const { t } = useTranslation();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [draggingAssignmentId, setDraggingAssignmentId] = useState<string | null>(null);
  const laneRefs = useRef<Record<string, NativeView | null>>({});

  const activeNodes = useMemo(() => nodes.filter((node) => !node.DeletedOn).sort((a, b) => a.SortOrder - b.SortOrder), [nodes]);
  const activeAssignments = useMemo(() => assignments.filter((assignment) => !assignment.ReleasedOn), [assignments]);
  const selectedAssignment = activeAssignments.find((assignment) => assignment.ResourceAssignmentId === selectedAssignmentId);
  const totalGapWidth = Math.max(activeNodes.length - 1, 0) * 12;
  const laneWidth = Math.min(320, Math.max(220, (viewportWidth - 64 - totalGapWidth) / Math.max(activeNodes.length, 1)));
  const laneHeight = Math.max(320, viewportHeight - 360);

  const moveAssignment = useCallback(
    async (assignmentId: string, targetNodeId: string) => {
      const assignment = activeAssignments.find((item) => item.ResourceAssignmentId === assignmentId);
      setSelectedAssignmentId(null);
      if (!assignment || assignment.CommandStructureNodeId === targetNodeId) {
        return;
      }
      await onMoveResource(assignmentId, targetNodeId);
    },
    [activeAssignments, onMoveResource]
  );

  const handleSelect = useCallback((assignmentId: string) => {
    setSelectedAssignmentId((current) => (current === assignmentId ? null : assignmentId));
  }, []);

  const handleLanePress = useCallback(
    (targetNodeId: string) => {
      if (selectedAssignmentId) {
        void moveAssignment(selectedAssignmentId, targetNodeId);
      }
    },
    [moveAssignment, selectedAssignmentId]
  );

  const measureLane = useCallback(
    (nodeId: string) =>
      new Promise<LaneRect | null>((resolve) => {
        const lane = laneRefs.current[nodeId];
        if (!lane) {
          resolve(null);
          return;
        }
        lane.measureInWindow((x, y, width, height) => resolve({ nodeId, x, y, width, height }));
      }),
    []
  );

  const handleDrop = useCallback(
    async (assignmentId: string, pageX: number, pageY: number) => {
      const laneRects = await Promise.all(activeNodes.map((node) => measureLane(node.CommandStructureNodeId)));
      const target = laneRects.find((lane): lane is LaneRect => lane !== null && pageX >= lane.x && pageX <= lane.x + lane.width && pageY >= lane.y && pageY <= lane.y + lane.height);
      if (target) {
        await moveAssignment(assignmentId, target.nodeId);
      }
    },
    [activeNodes, measureLane, moveAssignment]
  );

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-landscape-structure-board">
      <HStack className="mb-2 items-center justify-between">
        <HStack className="items-center" space="sm">
          <Heading size="sm">{t('command.structure_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({activeNodes.length})</Text>
        </HStack>
        <Button onPress={onAddLane} size="xs" testID="command-landscape-structure-add" variant="outline">
          <ButtonIcon as={Plus} />
          <ButtonText>{t('command.add_lane')}</ButtonText>
        </Button>
      </HStack>

      <Text className={`mb-3 text-sm ${selectedAssignment ? 'font-medium text-primary-600 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`} testID="command-move-hint">
        {selectedAssignment ? t('command.move_selected_hint', { resource: resolveResourceName(selectedAssignment.ResourceKind, selectedAssignment.ResourceId) }) : t('command.drag_move_hint')}
      </Text>

      {activeNodes.length === 0 ? (
        <Text className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_structure')}</Text>
      ) : (
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator testID="command-landscape-lanes">
          <NativeView style={{ flexDirection: 'row', gap: 12, paddingBottom: 4 }}>
            {activeNodes.map((node) => {
              const laneAssignments = activeAssignments.filter((assignment) => assignment.CommandStructureNodeId === node.CommandStructureNodeId);
              const laneUnitCount = laneAssignments.filter((a) => a.ResourceKind === 0 || a.ResourceKind === 2 || a.ResourceKind === 4).length;
              const isUnderstaffed = !!node.MinUnits && laneUnitCount < node.MinUnits;
              const isMoveTarget = selectedAssignment ? selectedAssignment.CommandStructureNodeId !== node.CommandStructureNodeId : false;
              return (
                <NativeView
                  key={node.CommandStructureNodeId}
                  ref={(lane) => {
                    laneRefs.current[node.CommandStructureNodeId] = lane;
                  }}
                  style={{ minHeight: laneHeight, width: laneWidth }}
                >
                  <Pressable
                    accessibilityHint={
                      selectedAssignment ? t('command.move_resource_to_lane', { resource: resolveResourceName(selectedAssignment.ResourceKind, selectedAssignment.ResourceId), lane: node.Name }) : undefined
                    }
                    accessibilityRole={containerButtonRole}
                    style={node.Color ? { borderTopWidth: 4, borderTopColor: node.Color } : undefined}
                    className={`h-full rounded-xl border p-3 ${isMoveTarget ? 'border-primary-400 bg-primary-50 dark:bg-primary-950' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'}`}
                    onPress={() => handleLanePress(node.CommandStructureNodeId)}
                    testID={`landscape-lane-${node.CommandStructureNodeId}`}
                  >
                    <HStack className="mb-3 items-start justify-between">
                      <VStack className="flex-1">
                        <Text className="text-base font-semibold text-gray-900 web:line-clamp-2 dark:text-white" {...twoLine}>
                          {node.Name}
                        </Text>
                        <Text className="text-xs uppercase text-gray-500 dark:text-gray-400">
                          {getCommandNodeTypeName(t, node.NodeType)}
                          {node.MaxUnits ? ` • ${t('command.lane_unit_capacity', { count: laneUnitCount, max: node.MaxUnits })}` : ''}
                        </Text>
                      </VStack>
                      <HStack className="items-center" space="xs">
                        {isUnderstaffed ? (
                          <Badge action="warning" variant="solid" testID={`landscape-lane-understaffed-${node.CommandStructureNodeId}`}>
                            <BadgeText className="text-white">{t('command.lane_understaffed', { count: laneUnitCount, min: node.MinUnits })}</BadgeText>
                          </Badge>
                        ) : null}
                        {node.CommandStructureNodeId.startsWith('local-') ? <CloudOff className="text-amber-500" size={16} /> : null}
                        <Pressable
                          accessibilityLabel={t('command.assign_resource')}
                          accessibilityRole="button"
                          className="p-2"
                          onPress={() => onAssignResource(node.CommandStructureNodeId)}
                          testID={`landscape-lane-assign-${node.CommandStructureNodeId}`}
                        >
                          <UserPlus className="text-primary-500" size={18} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={t('common.delete')}
                          accessibilityRole="button"
                          className="p-2"
                          onPress={() => onDeleteLane(node.CommandStructureNodeId)}
                          testID={`landscape-lane-delete-${node.CommandStructureNodeId}`}
                        >
                          <Trash2 className="text-gray-400" size={18} />
                        </Pressable>
                      </HStack>
                    </HStack>

                    {laneAssignments.length === 0 ? (
                      <Text className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">{t('command.no_resources_in_lane')}</Text>
                    ) : (
                      <VStack space="sm">
                        {laneAssignments.map((assignment) => (
                          <DraggableResourceCard
                            key={assignment.ResourceAssignmentId}
                            assignment={assignment}
                            rotationAfterMinutes={node.MaxTimeInRole}
                            isSelected={selectedAssignmentId === assignment.ResourceAssignmentId}
                            name={resolveResourceName(assignment.ResourceKind, assignment.ResourceId)}
                            onDragEnd={() => setDraggingAssignmentId(null)}
                            onDragStart={setDraggingAssignmentId}
                            onDrop={(assignmentId, pageX, pageY) => void handleDrop(assignmentId, pageX, pageY)}
                            onRelease={onReleaseResource}
                            onSelect={handleSelect}
                          />
                        ))}
                      </VStack>
                    )}
                    {draggingAssignmentId && laneAssignments.every((assignment) => assignment.ResourceAssignmentId !== draggingAssignmentId) ? (
                      <NativeView className="absolute inset-0 rounded-xl border-2 border-dashed border-primary-500" pointerEvents="none" testID={`landscape-drop-target-${node.CommandStructureNodeId}`} />
                    ) : null}
                  </Pressable>
                </NativeView>
              );
            })}
          </NativeView>
        </ScrollView>
      )}
    </Box>
  );
};
