import { router } from 'expo-router';
import { ClipboardList, CloudOff, ExternalLink, Image as ImageIcon, Info, MapPin, Paperclip, Pencil, RefreshCw, StickyNote, Trash2, UserCog, Video as VideoIcon, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions } from 'react-native';

import { VideoFeedTabContent } from '@/components/call-video-feeds/video-feed-tab-content';
import CallFilesModal from '@/components/calls/call-files-modal';
import CallImagesModal from '@/components/calls/call-images-modal';
import CallNotesModal from '@/components/calls/call-notes-modal';
import { AddAssignmentSheet } from '@/components/command/add-assignment-sheet';
import { AddLaneSheet } from '@/components/command/add-lane-sheet';
import { AddResourceSheet } from '@/components/command/add-resource-sheet';
import { type AssignableResourceOption, AssignResourceSheet } from '@/components/command/assign-resource-sheet';
import { CommandDetailsSheet } from '@/components/command/command-details-sheet';
import { CommandSection } from '@/components/command/command-section';
import { IncidentFilesSection } from '@/components/command/incident-files-section';
import IncidentMapCard from '@/components/command/incident-map-card';
import { IncidentMapsSection } from '@/components/command/incident-maps-section';
import { IncidentWeatherSection } from '@/components/command/incident-weather-section';
import { LandscapeStructureBoard } from '@/components/command/landscape-structure-board';
import { LaneDetailsSheet } from '@/components/command/lane-details-sheet';
import { NeedsSection } from '@/components/command/needs-section';
import { NotesSection } from '@/components/command/notes-section';
import { ObjectivesSection } from '@/components/command/objectives-section';
import { PersonnelResourceCard, UnitResourceCard } from '@/components/command/resource-cards';
import { StructureSection } from '@/components/command/structure-section';
import { SceneClock, TimelineSection } from '@/components/command/timeline-section';
import { TimersSection } from '@/components/command/timers-section';
import { TransferCommandSheet } from '@/components/command/transfer-command-sheet';
import { VoiceSection } from '@/components/command/voice-section';
import ZeroState from '@/components/common/zero-state';
import { View } from '@/components/ui';
import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getIncidentRoleName, getParBadgeAction } from '@/lib/incident-command-utils';
import { isWeb } from '@/lib/platform';
import { getTimeAgoUtc } from '@/lib/utils';
import { type IncidentNeedStatus, ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { type AssignmentOutcome } from '@/stores/command/store';
import { useCommandStore } from '@/stores/command/store';
import { useRolesStore } from '@/stores/roles/store';
import { useToastStore } from '@/stores/toast/store';
import { useUnitsStore } from '@/stores/units/store';

/** One-line truncation: numberOfLines leaks to the DOM through the styling pipeline on web, so use CSS ellipsis there. */
const oneLine = isWeb ? ({ isTruncated: true } as const) : ({ numberOfLines: 1 } as const);

export default function CommandBoard() {
  const { t } = useTranslation();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const boards = useCommandStore((state) => state.boards);
  const activeBoardCallId = useCommandStore((state) => state.activeCallId);
  const switchCommand = useCommandStore((state) => state.switchCommand);
  const endCommand = useCommandStore((state) => state.endCommand);
  const refreshBoard = useCommandStore((state) => state.refreshBoard);
  const isRefreshing = useCommandStore((state) => state.isRefreshing);
  const assignRole = useCommandStore((state) => state.assignRole);
  const removeRole = useCommandStore((state) => state.removeRole);
  const addAdHocUnit = useCommandStore((state) => state.addAdHocUnit);
  const releaseAdHocUnitEntry = useCommandStore((state) => state.releaseAdHocUnitEntry);
  const addAdHocPersonnel = useCommandStore((state) => state.addAdHocPersonnel);
  const releaseAdHocPersonnelEntry = useCommandStore((state) => state.releaseAdHocPersonnelEntry);
  const refreshAccountability = useCommandStore((state) => state.refreshAccountability);
  const addNode = useCommandStore((state) => state.addNode);
  const deleteNode = useCommandStore((state) => state.deleteNode);
  const assignResourceToNode = useCommandStore((state) => state.assignResourceToNode);
  const moveResourceAssignment = useCommandStore((state) => state.moveResourceAssignment);
  const releaseResourceAssignment = useCommandStore((state) => state.releaseResourceAssignment);
  const addObjective = useCommandStore((state) => state.addObjective);
  const completeObjectiveEntry = useCommandStore((state) => state.completeObjectiveEntry);
  const updateObjectiveProgressEntry = useCommandStore((state) => state.updateObjectiveProgressEntry);
  const addNeed = useCommandStore((state) => state.addNeed);
  const setNeedStatusEntry = useCommandStore((state) => state.setNeedStatusEntry);
  const fetchNeedUpdates = useCommandStore((state) => state.fetchNeedUpdates);
  const requestNeedEntitiesEntry = useCommandStore((state) => state.requestNeedEntitiesEntry);
  const fetchNeedEntities = useCommandStore((state) => state.fetchNeedEntities);
  const saveIncidentMapEntry = useCommandStore((state) => state.saveIncidentMapEntry);
  const deleteIncidentMapEntry = useCommandStore((state) => state.deleteIncidentMapEntry);
  const addIncidentAttachmentEntry = useCommandStore((state) => state.addIncidentAttachmentEntry);
  const removeIncidentAttachmentEntry = useCommandStore((state) => state.removeIncidentAttachmentEntry);
  const updateCommandInfoEntry = useCommandStore((state) => state.updateCommandInfoEntry);
  const addIncidentNoteEntry = useCommandStore((state) => state.addIncidentNoteEntry);
  const updateNodeDetails = useCommandStore((state) => state.updateNodeDetails);
  const startTimer = useCommandStore((state) => state.startTimer);
  const acknowledgeTimer = useCommandStore((state) => state.acknowledgeTimer);
  const transferIncidentCommand = useCommandStore((state) => state.transferIncidentCommand);
  const fetchTimeline = useCommandStore((state) => state.fetchTimeline);
  const createVoiceChannel = useCommandStore((state) => state.createVoiceChannel);
  const fetchVoiceChannels = useCommandStore((state) => state.fetchVoiceChannels);
  const closeVoiceChannels = useCommandStore((state) => state.closeVoiceChannels);
  const fetchTransmissionLog = useCommandStore((state) => state.fetchTransmissionLog);
  const recordTransmission = useCommandStore((state) => state.recordTransmission);

  const activeCall = useCoreStore((state) => state.activeCall);
  const activePriority = useCoreStore((state) => state.activePriority);
  const calls = useCallsStore((state) => state.calls);
  const users = useRolesStore((state) => state.users);
  const fetchUsers = useRolesStore((state) => state.fetchUsers);
  const unitRoles = useRolesStore((state) => state.roles);
  const units = useUnitsStore((state) => state.units);
  const unitCurrentStatuses = useUnitsStore((state) => state.unitCurrentStatuses);
  const fetchUnits = useUnitsStore((state) => state.fetchUnits);
  const showToast = useToastStore((state) => state.showToast);

  // Advisory requirement violations warn; forced ones were rejected server-side and error.
  const notifyAssignmentOutcome = useCallback(
    (outcome: AssignmentOutcome | null) => {
      if (outcome?.blocked) {
        showToast('error', outcome.blocked);
      } else if (outcome?.warning) {
        showToast('warning', outcome.warning);
      }
    },
    [showToast]
  );

  const [isAssignmentSheetOpen, setIsAssignmentSheetOpen] = useState(false);
  const [isResourceSheetOpen, setIsResourceSheetOpen] = useState(false);
  const [isLaneSheetOpen, setIsLaneSheetOpen] = useState(false);
  const [assignTargetNodeId, setAssignTargetNodeId] = useState<string | null>(null);
  /** Pending "already assigned elsewhere — move it?" confirmation. */
  const [moveConflict, setMoveConflict] = useState<{ assignmentId: string; resourceName: string; fromLane: string; toLane: string; targetNodeId: string } | null>(null);
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false);
  const [editLaneNodeId, setEditLaneNodeId] = useState<string | null>(null);
  const [isCommandDetailsOpen, setIsCommandDetailsOpen] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  /** Which call-resource viewer (from the underlying call) is open on top of the board. */
  const [callResourceModal, setCallResourceModal] = useState<'notes' | 'images' | 'files' | 'video' | null>(null);

  const boardList = useMemo(() => Object.values(boards), [boards]);
  const boardState = activeBoardCallId ? boards[activeBoardCallId] : undefined;
  const isLandscapeBoard = viewportWidth > viewportHeight && Math.min(viewportWidth, viewportHeight) >= 600;

  // Unit and personnel rosters back the resource pool — load once when a board is open
  useEffect(() => {
    if (boardState && units.length === 0) {
      fetchUnits();
    }
  }, [boardState, units.length, fetchUnits]);

  useEffect(() => {
    if (boardState && users.length === 0) {
      fetchUsers();
    }
  }, [boardState, users.length, fetchUsers]);

  // Incident log + voice channels load alongside the board
  const boardCallId = boardState?.callId;
  useEffect(() => {
    if (boardCallId) {
      fetchTimeline(boardCallId);
      fetchVoiceChannels(boardCallId);
      fetchTransmissionLog(boardCallId);
    }
  }, [boardCallId, fetchTimeline, fetchVoiceChannels, fetchTransmissionLog]);

  const personName = useCallback(
    (userId: string) => {
      const user = users.find((u) => u.UserId === userId);
      return user ? `${user.FirstName} ${user.LastName}` : userId;
    },
    [users]
  );

  // Lane lead display: a Resgrid user resolves to their name; external leads use the entered name.
  const resolveLeadName = useCallback(
    (userId?: string | null, externalName?: string | null) => {
      if (userId) {
        return personName(userId);
      }
      return externalName ?? null;
    },
    [personName]
  );

  const boardLabel = useCallback(
    (callId: string) => {
      const call = calls.find((c) => c.CallId === callId);
      return call ? `#${call.Number}` : `#${callId}`;
    },
    [calls]
  );

  const handleViewCall = useCallback(() => {
    if (activeBoardCallId) {
      router.push(`/call/${activeBoardCallId}`);
    }
  }, [activeBoardCallId]);

  const handleEndCommand = useCallback(() => {
    setIsEndConfirmOpen(false);
    if (activeBoardCallId) {
      endCommand(activeBoardCallId);
    }
  }, [activeBoardCallId, endCommand]);

  const handleSaveCommandInfo = useCallback(
    async (info: Parameters<typeof updateCommandInfoEntry>[1]) => {
      if (!activeBoardCallId) {
        return;
      }
      const ok = await updateCommandInfoEntry(activeBoardCallId, info);
      showToast(ok ? 'success' : 'error', ok ? t('command.info_save_success') : t('command.info_save_error'));
    },
    [activeBoardCallId, updateCommandInfoEntry, showToast, t]
  );

  const handleAddNote = useCallback(
    async (body: string, visibility: number) => {
      if (!activeBoardCallId) {
        return;
      }
      const ok = await addIncidentNoteEntry(activeBoardCallId, body, visibility);
      showToast(ok ? 'success' : 'error', ok ? t('command.note_save_success') : t('command.note_save_error'));
    },
    [activeBoardCallId, addIncidentNoteEntry, showToast, t]
  );

  const handleRefresh = useCallback(() => {
    if (activeBoardCallId) {
      refreshBoard(activeBoardCallId);
      refreshAccountability(activeBoardCallId);
      fetchTimeline(activeBoardCallId);
      fetchVoiceChannels(activeBoardCallId);
      fetchTransmissionLog(activeBoardCallId);
    }
  }, [activeBoardCallId, refreshBoard, refreshAccountability, fetchTimeline, fetchVoiceChannels, fetchTransmissionLog]);

  const handleTransferCommand = useCallback(
    async (toUserId: string) => {
      if (!activeBoardCallId) {
        return;
      }
      const ok = await transferIncidentCommand(activeBoardCallId, toUserId);
      showToast(ok ? 'success' : 'error', ok ? t('command.transfer_success') : t('command.transfer_error'));
    },
    [activeBoardCallId, transferIncidentCommand, showToast, t]
  );

  const handleGoToCalls = useCallback(() => {
    router.push('/calls');
  }, []);

  // Resolve a resource assignment (kind + id) to a display name using the loaded rosters
  const resolveResourceName = useCallback(
    (kind: number, resourceId: string) => {
      if (kind === ResourceAssignmentKind.RealUnit || kind === ResourceAssignmentKind.LinkedDeptUnit) {
        return units.find((u) => u.UnitId === resourceId)?.Name ?? resourceId;
      }
      if (kind === ResourceAssignmentKind.RealPersonnel || kind === ResourceAssignmentKind.LinkedDeptPersonnel) {
        const user = users.find((u) => u.UserId === resourceId);
        return user ? `${user.FirstName} ${user.LastName}` : resourceId;
      }
      const boardEntry = activeBoardCallId ? boards[activeBoardCallId] : undefined;
      if (kind === ResourceAssignmentKind.AdHocPersonnel) {
        return boardEntry?.adHocPersonnel.find((person) => person.IncidentAdHocPersonnelId === resourceId)?.Name ?? resourceId;
      }
      return boardEntry?.adHocUnits.find((u) => u.IncidentAdHocUnitId === resourceId)?.Name ?? resourceId;
    },
    [units, users, boards, activeBoardCallId]
  );

  const resourceOptions = useMemo<AssignableResourceOption[]>(() => {
    const entry = activeBoardCallId ? boards[activeBoardCallId] : undefined;
    const activeAssignments = (entry?.board?.Assignments ?? []).filter((a) => !a.ReleasedOn);
    const assignedNodeOf = (kind: ResourceAssignmentKind, id: string) => activeAssignments.find((a) => a.ResourceKind === kind && a.ResourceId === id)?.CommandStructureNodeId;

    const unitOptions = units.map((u) => ({
      kind: ResourceAssignmentKind.RealUnit,
      id: u.UnitId,
      name: u.Name,
      detail: [u.Type, u.GroupName].filter(Boolean).join(' • '),
      statusLabel: unitCurrentStatuses.find((s) => s.UnitId === u.UnitId)?.State,
      assignedNodeId: assignedNodeOf(ResourceAssignmentKind.RealUnit, u.UnitId),
    }));
    const personnelOptions = users.map((u) => ({
      kind: ResourceAssignmentKind.RealPersonnel,
      id: u.UserId,
      name: `${u.FirstName} ${u.LastName}`,
      detail: [u.GroupName, u.Status].filter(Boolean).join(' • '),
      chips: u.Roles ?? [],
      assignedNodeId: assignedNodeOf(ResourceAssignmentKind.RealPersonnel, u.UserId),
    }));
    const adHocOptions = (entry?.adHocUnits ?? []).map((u) => ({
      kind: ResourceAssignmentKind.AdHocUnit,
      id: u.IncidentAdHocUnitId,
      name: u.Name,
      detail: [u.Type, u.ExternalAgencyName].filter(Boolean).join(' • '),
      assignedNodeId: assignedNodeOf(ResourceAssignmentKind.AdHocUnit, u.IncidentAdHocUnitId),
    }));
    const adHocPersonnelOptions = (entry?.adHocPersonnel ?? []).map((person) => ({
      kind: ResourceAssignmentKind.AdHocPersonnel,
      id: person.IncidentAdHocPersonnelId,
      name: person.Name,
      detail: [person.Role, person.ExternalAgencyName].filter(Boolean).join(' • '),
      assignedNodeId: assignedNodeOf(ResourceAssignmentKind.AdHocPersonnel, person.IncidentAdHocPersonnelId),
    }));
    return [...unitOptions, ...personnelOptions, ...adHocOptions, ...adHocPersonnelOptions];
  }, [units, users, unitCurrentStatuses, boards, activeBoardCallId]);

  // Department units/personnel tracked on this incident — every active assignment pointing at a
  // Resgrid resource, whether it sits in a lane or in the unassigned pool (empty node id).
  const deptAssignments = useMemo(() => {
    const entry = activeBoardCallId ? boards[activeBoardCallId] : undefined;
    const unitKinds = [ResourceAssignmentKind.RealUnit, ResourceAssignmentKind.LinkedDeptUnit, ResourceAssignmentKind.RealPersonnel, ResourceAssignmentKind.LinkedDeptPersonnel];
    return (entry?.board?.Assignments ?? []).filter((a) => !a.ReleasedOn && unitKinds.includes(a.ResourceKind));
  }, [boards, activeBoardCallId]);

  const isUnitKind = useCallback((kind: number) => kind === ResourceAssignmentKind.RealUnit || kind === ResourceAssignmentKind.LinkedDeptUnit, []);

  const trackedUnitIds = useMemo(() => deptAssignments.filter((a) => isUnitKind(a.ResourceKind)).map((a) => a.ResourceId), [deptAssignments, isUnitKind]);
  const trackedUserIds = useMemo(() => deptAssignments.filter((a) => !isUnitKind(a.ResourceKind)).map((a) => a.ResourceId), [deptAssignments, isUnitKind]);

  const laneName = useCallback(
    (nodeId?: string | null) => {
      if (!nodeId) {
        return t('command.unassigned');
      }
      const entry = activeBoardCallId ? boards[activeBoardCallId] : undefined;
      return entry?.board?.Nodes.find((n) => n.CommandStructureNodeId === nodeId)?.Name ?? t('command.unassigned');
    },
    [boards, activeBoardCallId, t]
  );

  // Track a department resource on the incident: an assignment with no lane (the unassigned pool)
  const handleAddDeptUnit = useCallback(
    async (unitId: string) => {
      if (!activeBoardCallId) {
        return;
      }
      const outcome = await assignResourceToNode(activeBoardCallId, '', ResourceAssignmentKind.RealUnit, unitId);
      notifyAssignmentOutcome(outcome);
    },
    [activeBoardCallId, assignResourceToNode, notifyAssignmentOutcome]
  );

  const handleAddDeptPersonnel = useCallback(
    async (userId: string) => {
      if (!activeBoardCallId) {
        return;
      }
      const outcome = await assignResourceToNode(activeBoardCallId, '', ResourceAssignmentKind.RealPersonnel, userId);
      notifyAssignmentOutcome(outcome);
    },
    [activeBoardCallId, assignResourceToNode, notifyAssignmentOutcome]
  );

  const handleAssignResourceSave = useCallback(
    async (kind: ResourceAssignmentKind, resourceId: string) => {
      if (!activeBoardCallId || !assignTargetNodeId) {
        return;
      }
      const targetNodeId = assignTargetNodeId;
      setAssignTargetNodeId(null);

      const entry = boards[activeBoardCallId];
      const existing = (entry?.board?.Assignments ?? []).find((a) => !a.ReleasedOn && a.ResourceKind === kind && a.ResourceId === resourceId);

      if (existing) {
        // Already in this lane — the picker disables these rows; nothing to do.
        if (existing.CommandStructureNodeId === targetNodeId) {
          return;
        }
        // Sitting in the unassigned pool — moving it into a lane needs no confirmation.
        if (!existing.CommandStructureNodeId) {
          const outcome = await moveResourceAssignment(activeBoardCallId, existing.ResourceAssignmentId, targetNodeId);
          notifyAssignmentOutcome(outcome);
          return;
        }
        // In another lane — ask before moving.
        setMoveConflict({
          assignmentId: existing.ResourceAssignmentId,
          resourceName: resolveResourceName(kind, resourceId),
          fromLane: laneName(existing.CommandStructureNodeId),
          toLane: laneName(targetNodeId),
          targetNodeId,
        });
        return;
      }

      const outcome = await assignResourceToNode(activeBoardCallId, targetNodeId, kind, resourceId);
      notifyAssignmentOutcome(outcome);
    },
    [activeBoardCallId, assignTargetNodeId, boards, assignResourceToNode, moveResourceAssignment, resolveResourceName, laneName, notifyAssignmentOutcome]
  );

  const handleConfirmMove = useCallback(async () => {
    if (!moveConflict || !activeBoardCallId) {
      setMoveConflict(null);
      return;
    }
    const { assignmentId, targetNodeId } = moveConflict;
    setMoveConflict(null);
    const outcome = await moveResourceAssignment(activeBoardCallId, assignmentId, targetNodeId);
    notifyAssignmentOutcome(outcome);
  }, [moveConflict, activeBoardCallId, moveResourceAssignment, notifyAssignmentOutcome]);

  const handleMoveResource = useCallback(
    async (assignmentId: string, targetNodeId: string) => {
      if (!activeBoardCallId) {
        return;
      }
      const outcome = await moveResourceAssignment(activeBoardCallId, assignmentId, targetNodeId);
      notifyAssignmentOutcome(outcome);
    },
    [activeBoardCallId, moveResourceAssignment, notifyAssignmentOutcome]
  );

  if (!boardState) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-900" testID="command-board-screen">
        <FocusAwareStatusBar />
        <ZeroState icon={ClipboardList} heading={t('command.empty_heading')} description={t('command.empty_description')}>
          <Button onPress={handleGoToCalls} className="mt-2 bg-primary-500" testID="command-go-to-calls">
            <ButtonText className="text-white">{t('command.go_to_calls')}</ButtonText>
          </Button>
        </ZeroState>
      </View>
    );
  }

  const activeRoles = (boardState.board?.Roles ?? []).filter((r) => !r.RemovedOn);
  const accountability = boardState.board?.Accountability ?? [];
  const summaryCall = activeCall?.CallId === boardState.callId ? activeCall : (calls.find((c) => c.CallId === boardState.callId) ?? null);

  // Weather location: the ICP when set, otherwise the call's own coordinates.
  const icpLatitude = parseFloat(boardState.board?.Command?.CommandPostLatitude ?? '');
  const icpLongitude = parseFloat(boardState.board?.Command?.CommandPostLongitude ?? '');
  const callLatitude = parseFloat(summaryCall?.Latitude ?? '');
  const callLongitude = parseFloat(summaryCall?.Longitude ?? '');
  const incidentWeatherCoords =
    Number.isFinite(icpLatitude) && Number.isFinite(icpLongitude)
      ? { latitude: icpLatitude, longitude: icpLongitude, isIcp: true }
      : Number.isFinite(callLatitude) && Number.isFinite(callLongitude)
        ? { latitude: callLatitude, longitude: callLongitude, isIcp: false }
        : null;
  const summaryPriority = activeCall?.CallId === boardState.callId ? activePriority : null;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900" testID="command-board-screen">
      <FocusAwareStatusBar />
      <ScrollView className="flex-1">
        <VStack space="md" className="px-3 pb-3 pt-2">
          {/* Board switcher — the IC may be running several incidents at once */}
          {boardList.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="command-board-switcher">
              <HStack space="sm">
                {boardList.map((b) => (
                  <Pressable
                    key={b.callId}
                    testID={`command-board-tab-${b.callId}`}
                    className={`rounded-full px-4 py-2 ${b.callId === activeBoardCallId ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                    onPress={() => switchCommand(b.callId)}
                  >
                    <Text className={`text-sm font-semibold ${b.callId === activeBoardCallId ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>{boardLabel(b.callId)}</Text>
                  </Pressable>
                ))}
              </HStack>
            </ScrollView>
          ) : null}

          {/* Active call summary — compact one-liner so command info gets the screen */}
          <Box className="rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-gray-800" testID="command-active-call">
            <HStack space="sm" className="items-center justify-between">
              <HStack space="sm" className="min-w-0 flex-1 items-center">
                <Heading size="sm">{boardLabel(boardState.callId)}</Heading>
                {boardState.board?.Command?.Name || summaryCall ? (
                  <Text className="min-w-0 flex-1 font-medium text-gray-900 dark:text-white" {...oneLine}>
                    {boardState.board?.Command?.Name || summaryCall?.Name}
                  </Text>
                ) : null}
              </HStack>
              <HStack space="xs" className="items-center">
                {boardState.isProvisional ? (
                  <Badge action="warning" variant="solid" testID="command-provisional-badge">
                    <BadgeText className="text-white">{t('command.provisional_badge')}</BadgeText>
                  </Badge>
                ) : null}
                {summaryPriority ? (
                  <Badge style={summaryPriority.Color ? { backgroundColor: summaryPriority.Color } : undefined} variant="solid">
                    <BadgeText className="text-white">{summaryPriority.Name}</BadgeText>
                  </Badge>
                ) : null}
                {/* Master scene timer — elapsed time since the call was logged */}
                <SceneClock startedOn={summaryCall?.LoggedOnUtc} />
              </HStack>
            </HStack>

            {summaryCall ? (
              <HStack space="sm" className="mt-1 items-center">
                {summaryCall.Address ? (
                  <>
                    <Icon as={MapPin} size="sm" className="text-gray-500" />
                    <Text className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300" {...oneLine}>
                      {summaryCall.Address}
                    </Text>
                  </>
                ) : (
                  <Box className="flex-1" />
                )}
                {boardState.board?.Command?.CurrentCommanderUserId ? (
                  <Badge action="info" variant="outline" testID="command-commander-badge">
                    <BadgeText>{`${t('command.current_commander')}: ${personName(boardState.board.Command.CurrentCommanderUserId)}`}</BadgeText>
                  </Badge>
                ) : null}
              </HStack>
            ) : null}

            <HStack space="sm" className="mt-2">
              <Button onPress={handleViewCall} variant="outline" size="xs" testID="command-view-call">
                <ButtonIcon as={ExternalLink} />
                <ButtonText>{t('command.view_call')}</ButtonText>
              </Button>
              <Button onPress={() => setIsCommandDetailsOpen(true)} variant="outline" size="xs" testID="command-edit-details">
                <ButtonIcon as={Pencil} />
              </Button>
              <Button onPress={() => setIsTransferSheetOpen(true)} variant="outline" size="xs" testID="command-transfer">
                <ButtonIcon as={UserCog} />
              </Button>
              <Button onPress={handleRefresh} variant="outline" size="xs" isDisabled={isRefreshing} testID="command-refresh">
                <ButtonIcon as={RefreshCw} />
              </Button>
              {/* Icon-only by design; a confirmation dialog guards against accidental taps. */}
              <Button onPress={() => setIsEndConfirmOpen(true)} action="negative" variant="solid" size="xs" accessibilityLabel={t('command.end_command')} testID="command-end-command">
                <ButtonIcon as={XCircle} className="text-white" />
              </Button>
            </HStack>

            {/* Quick access to the underlying call's notes/images/files/video without leaving the board */}
            <HStack space="sm" className="mt-2">
              <Button onPress={() => setCallResourceModal('notes')} variant="outline" size="xs" testID="command-call-notes">
                <ButtonIcon as={StickyNote} />
                <ButtonText>{t('call_detail.notes')}</ButtonText>
              </Button>
              <Button onPress={() => setCallResourceModal('images')} variant="outline" size="xs" testID="command-call-images">
                <ButtonIcon as={ImageIcon} />
                <ButtonText>{t('call_detail.images')}</ButtonText>
              </Button>
              <Button onPress={() => setCallResourceModal('files')} variant="outline" size="xs" testID="command-call-files">
                <ButtonIcon as={Paperclip} />
                <ButtonText>{t('call_detail.files.button')}</ButtonText>
              </Button>
              <Button onPress={() => setCallResourceModal('video')} variant="outline" size="xs" testID="command-call-video">
                <ButtonIcon as={VideoIcon} />
                <ButtonText>{t('video_feeds.tab_title')}</ButtonText>
              </Button>
            </HStack>

            {boardState.board?.Command?.CommandPostLocationText || boardState.board?.Command?.StagingLocationText || boardState.board?.Command?.RehabLocationText ? (
              <VStack space="xs" className="mt-2" testID="command-locations">
                {boardState.board?.Command?.CommandPostLocationText ? (
                  <Text className="text-sm text-gray-600 dark:text-gray-300" {...oneLine}>
                    {`${t('command.icp_location_label')}: ${boardState.board.Command.CommandPostLocationText}`}
                  </Text>
                ) : null}
                {boardState.board?.Command?.StagingLocationText ? (
                  <Text className="text-sm text-gray-600 dark:text-gray-300" {...oneLine}>
                    {`${t('command.staging_location_label')}: ${boardState.board.Command.StagingLocationText}`}
                  </Text>
                ) : null}
                {boardState.board?.Command?.RehabLocationText ? (
                  <Text className="text-sm text-gray-600 dark:text-gray-300" {...oneLine}>
                    {`${t('command.rehab_location_label')}: ${boardState.board.Command.RehabLocationText}`}
                  </Text>
                ) : null}
              </VStack>
            ) : null}

            {boardState.board?.Command?.EstimatedEndOn ? (
              <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300" testID="command-estimated-end">
                {`${t('command.estimated_end_label')}: ${new Date(boardState.board.Command.EstimatedEndOn).toLocaleString()}`}
              </Text>
            ) : null}
            {boardState.board?.Command?.ImportantInformation ? (
              <HStack space="sm" className="mt-2 items-start rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950" testID="command-important-info">
                <Icon as={Info} size="sm" className="mt-0.5 text-amber-600 dark:text-amber-400" />
                <Text className="flex-1 text-sm text-amber-800 dark:text-amber-200">{boardState.board.Command.ImportantInformation}</Text>
              </HStack>
            ) : null}
          </Box>

          {/* Incident tactical map — saved framing, markup, ICP/Staging/Rehab, live incident resources */}
          {boardState.board?.Command ? (
            <IncidentMapCard callId={boardState.callId} command={boardState.board.Command} annotations={(boardState.board.Annotations ?? []).filter((a) => !a.DeletedOn && !a.IncidentMapId)} />
          ) : null}

          {/* Named tactical maps (areas of operation, cleanup zones, ...) */}
          <IncidentMapsSection
            callId={boardState.callId}
            maps={boardState.board?.Maps ?? []}
            onCreate={(name, description, expiresOn) => saveIncidentMapEntry(boardState.callId, { Name: name, Description: description, ExpiresOn: expiresOn })}
            onDelete={(incidentMapId) => deleteIncidentMapEntry(boardState.callId, incidentMapId)}
            resolveUserName={personName}
          />

          {/* Command structure lanes (Division/Group/Branch/...) with assigned resources */}
          {isLandscapeBoard ? (
            <LandscapeStructureBoard
              assignments={boardState.board?.Assignments ?? []}
              nodes={boardState.board?.Nodes ?? []}
              onAddLane={() => setIsLaneSheetOpen(true)}
              onAssignResource={(nodeId) => setAssignTargetNodeId(nodeId)}
              onDeleteLane={(nodeId) => deleteNode(boardState.callId, nodeId)}
              onMoveResource={handleMoveResource}
              onReleaseResource={(assignmentId) => releaseResourceAssignment(boardState.callId, assignmentId)}
              resolveResourceName={resolveResourceName}
              viewportHeight={viewportHeight}
              viewportWidth={viewportWidth}
            />
          ) : (
            <StructureSection
              assignments={boardState.board?.Assignments ?? []}
              nodes={boardState.board?.Nodes ?? []}
              onAddLane={() => setIsLaneSheetOpen(true)}
              onAssignResource={(nodeId) => setAssignTargetNodeId(nodeId)}
              onDeleteLane={(nodeId) => deleteNode(boardState.callId, nodeId)}
              onEditLane={(nodeId) => setEditLaneNodeId(nodeId)}
              onMoveResource={handleMoveResource}
              onReleaseResource={(assignmentId) => releaseResourceAssignment(boardState.callId, assignmentId)}
              resolveLeadName={resolveLeadName}
              resolveResourceName={resolveResourceName}
            />
          )}

          {/* PAR / benchmark reminder timers with live countdowns */}
          <TimersSection timers={boardState.board?.Timers ?? []} onStartTimer={(name, seconds) => startTimer(boardState.callId, name, seconds)} onAcknowledge={(timerId) => acknowledgeTimer(boardState.callId, timerId)} />

          {/* Tactical & command PTT channels + transmission log */}
          <VoiceSection
            callId={boardState.callId}
            channels={boardState.voiceChannels ?? []}
            transmissionLog={boardState.transmissionLog ?? []}
            personName={personName}
            onCreateChannel={(name) => createVoiceChannel(boardState.callId, name)}
            onCloseChannels={() => closeVoiceChannels(boardState.callId)}
            onTransmission={(channelId, startedOn, endedOn) => recordTransmission(boardState.callId, channelId, startedOn, endedOn)}
          />

          {/* Tactical objectives / benchmarks */}
          <ObjectivesSection
            objectives={boardState.board?.Objectives ?? []}
            onAdd={(name, type) => addObjective(boardState.callId, name, type)}
            onComplete={(objectiveId, outcome, note) => completeObjectiveEntry(boardState.callId, objectiveId, outcome, note)}
            onUpdateProgress={(objectiveId, progress) => updateObjectiveProgressEntry(boardState.callId, objectiveId, progress)}
            resolveUserName={personName}
          />

          {/* Command-level needs (resources/logistics/etc.) tracked to fulfillment */}
          <NeedsSection
            needs={boardState.board?.Needs ?? []}
            onAdd={(name, category, options) => addNeed(boardState.callId, name, category, options)}
            onSetStatus={(needId, status: IncidentNeedStatus, quantityFulfilled, note) => setNeedStatusEntry(boardState.callId, needId, status, quantityFulfilled, note)}
            fetchNeedUpdates={fetchNeedUpdates}
            onRequestEntities={(name, description, entities) =>
              requestNeedEntitiesEntry(
                boardState.callId,
                name,
                description,
                entities.map((e) => ({ EntityKind: e.kind, EntityId: e.id }))
              )
            }
            fetchNeedEntities={fetchNeedEntities}
            unitStatuses={unitCurrentStatuses}
            personnel={users}
          />

          {/* Weather alerts at the incident's own location (ICP first, call fallback) */}
          {incidentWeatherCoords ? <IncidentWeatherSection latitude={incidentWeatherCoords.latitude} longitude={incidentWeatherCoords.longitude} isIcpLocation={incidentWeatherCoords.isIcp} /> : null}

          {/* Incident files: reports, images, documents */}
          <IncidentFilesSection
            attachments={(boardState.board?.Attachments ?? []).filter((a) => !a.DeletedOn)}
            onUpload={(visibility, description, file) => addIncidentAttachmentEntry(boardState.callId, visibility, description, file)}
            onRemove={(incidentAttachmentId) => removeIncidentAttachmentEntry(boardState.callId, incidentAttachmentId)}
          />

          {/* Operational status notes — public ones land verbatim on the incident log */}
          <NotesSection notes={boardState.board?.Notes ?? []} onAdd={handleAddNote} />

          {/* ICS role assignments — synced with IncidentRoles API */}
          <CommandSection
            title={t('command.roles_section')}
            count={activeRoles.length}
            addLabel={t('command.add')}
            emptyText={t('command.empty_roles')}
            onAdd={() => setIsAssignmentSheetOpen(true)}
            testID="command-roles-section"
          >
            {activeRoles.map((assignment) => (
              <HStack key={assignment.IncidentRoleAssignmentId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`assignment-${assignment.IncidentRoleAssignmentId}`}>
                <VStack className="flex-1">
                  <Text className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{getIncidentRoleName(t, assignment.RoleType)}</Text>
                  <Text className="text-base text-gray-900 dark:text-white">{personName(assignment.UserId)}</Text>
                </VStack>
                <HStack space="sm" className="items-center">
                  {assignment.IncidentRoleAssignmentId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                  <Pressable onPress={() => removeRole(boardState.callId, assignment.IncidentRoleAssignmentId)} className="p-2" testID={`assignment-remove-${assignment.IncidentRoleAssignmentId}`}>
                    <Icon as={Trash2} size="sm" className="text-gray-400" />
                  </Pressable>
                </HStack>
              </HStack>
            ))}
          </CommandSection>

          {/* Incident resources — department units/personnel plus external (ad-hoc) entries */}
          <CommandSection
            title={t('command.resources_section')}
            count={deptAssignments.length + boardState.adHocUnits.length + boardState.adHocPersonnel.length}
            addLabel={t('command.add')}
            emptyText={t('command.empty_resources')}
            onAdd={() => setIsResourceSheetOpen(true)}
            testID="command-resources-section"
          >
            {deptAssignments.map((assignment) =>
              isUnitKind(assignment.ResourceKind) ? (
                <UnitResourceCard
                  key={assignment.ResourceAssignmentId}
                  isLocal={assignment.ResourceAssignmentId.startsWith('local-')}
                  laneLabel={laneName(assignment.CommandStructureNodeId)}
                  name={resolveResourceName(assignment.ResourceKind, assignment.ResourceId)}
                  onRelease={() => releaseResourceAssignment(boardState.callId, assignment.ResourceAssignmentId)}
                  removeTestID={`resource-dept-remove-${assignment.ResourceAssignmentId}`}
                  roles={unitRoles.filter((role) => role.UnitId === assignment.ResourceId)}
                  status={unitCurrentStatuses.find((s) => s.UnitId === assignment.ResourceId)}
                  testID={`resource-dept-${assignment.ResourceAssignmentId}`}
                  unit={units.find((u) => u.UnitId === assignment.ResourceId)}
                />
              ) : (
                <PersonnelResourceCard
                  key={assignment.ResourceAssignmentId}
                  isLocal={assignment.ResourceAssignmentId.startsWith('local-')}
                  laneLabel={laneName(assignment.CommandStructureNodeId)}
                  name={resolveResourceName(assignment.ResourceKind, assignment.ResourceId)}
                  onRelease={() => releaseResourceAssignment(boardState.callId, assignment.ResourceAssignmentId)}
                  person={users.find((u) => u.UserId === assignment.ResourceId)}
                  removeTestID={`resource-dept-remove-${assignment.ResourceAssignmentId}`}
                  testID={`resource-dept-${assignment.ResourceAssignmentId}`}
                />
              )
            )}
            {boardState.adHocPersonnel.map((person) => (
              <HStack key={person.IncidentAdHocPersonnelId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`resource-person-${person.IncidentAdHocPersonnelId}`}>
                <VStack className="flex-1">
                  <Text className="text-base text-gray-900 dark:text-white">{person.Name}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{[person.Role, person.ExternalAgencyName].filter(Boolean).join(' — ') || t('command.resource_person')}</Text>
                </VStack>
                <HStack space="sm" className="items-center">
                  {person.IncidentAdHocPersonnelId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                  <Pressable onPress={() => releaseAdHocPersonnelEntry(boardState.callId, person.IncidentAdHocPersonnelId)} className="p-2" testID={`resource-person-remove-${person.IncidentAdHocPersonnelId}`}>
                    <Icon as={Trash2} size="sm" className="text-gray-400" />
                  </Pressable>
                </HStack>
              </HStack>
            ))}
            {boardState.adHocUnits.map((unit) => (
              <HStack key={unit.IncidentAdHocUnitId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`resource-${unit.IncidentAdHocUnitId}`}>
                <VStack className="flex-1">
                  <Text className="text-base text-gray-900 dark:text-white">{unit.Name}</Text>
                  {unit.Type ? <Text className="text-sm text-gray-500 dark:text-gray-400">{unit.Type}</Text> : null}
                </VStack>
                <HStack space="sm" className="items-center">
                  {unit.IncidentAdHocUnitId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                  <Pressable onPress={() => releaseAdHocUnitEntry(boardState.callId, unit.IncidentAdHocUnitId)} className="p-2" testID={`resource-remove-${unit.IncidentAdHocUnitId}`}>
                    <Icon as={Trash2} size="sm" className="text-gray-400" />
                  </Pressable>
                </HStack>
              </HStack>
            ))}
          </CommandSection>

          {/* Accountability / PAR — computed server-side from check-in timers (read-only) */}
          <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-accountability-section">
            <HStack className="mb-3 items-center justify-between">
              <HStack space="sm" className="items-center">
                <Heading size="sm">{t('command.accountability_section')}</Heading>
                <Text className="text-sm text-gray-500 dark:text-gray-400">({accountability.length})</Text>
              </HStack>
              <Button size="xs" variant="outline" onPress={() => refreshAccountability(boardState.callId)} testID="command-accountability-evaluate">
                <ButtonIcon as={RefreshCw} />
                <ButtonText>{t('command.evaluate')}</ButtonText>
              </Button>
            </HStack>

            {accountability.length === 0 ? (
              <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.no_accountability')}</Text>
            ) : (
              <VStack space="sm">
                {accountability.map((entry) => (
                  <HStack key={entry.UserId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`accountability-${entry.UserId}`}>
                    <VStack className="flex-1">
                      <Text className="text-base text-gray-900 dark:text-white">{entry.FullName}</Text>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{entry.LastCheckIn ? `${t('command.last_check_in')}: ${getTimeAgoUtc(entry.LastCheckIn)}` : t('command.no_check_in_yet')}</Text>
                    </VStack>
                    <Badge action={getParBadgeAction(entry.Status)} variant="solid">
                      <BadgeText className="text-white">{entry.Status === 'Green' ? t('command.par_green') : entry.Status === 'Warning' ? t('command.par_warning') : t('command.par_critical')}</BadgeText>
                    </Badge>
                  </HStack>
                ))}
              </VStack>
            )}
          </Box>

          {/* Auto-logged, time-stamped incident log */}
          <TimelineSection entries={boardState.timeline ?? []} onRefresh={() => fetchTimeline(boardState.callId)} />
        </VStack>
      </ScrollView>

      <AddAssignmentSheet isOpen={isAssignmentSheetOpen} onClose={() => setIsAssignmentSheetOpen(false)} onSave={(roleType, userId) => assignRole(boardState.callId, roleType, userId)} />
      <AddResourceSheet
        isOpen={isResourceSheetOpen}
        onClose={() => setIsResourceSheetOpen(false)}
        units={units}
        personnel={users}
        unitCurrentStatuses={unitCurrentStatuses}
        trackedUnitIds={trackedUnitIds}
        trackedUserIds={trackedUserIds}
        onAddUnit={handleAddDeptUnit}
        onAddPersonnel={handleAddDeptPersonnel}
        onSaveExternal={(kind, name, detail, agency) => (kind === 'person' ? addAdHocPersonnel(boardState.callId, name, detail, agency) : addAdHocUnit(boardState.callId, name, detail))}
      />
      <AddLaneSheet isOpen={isLaneSheetOpen} onClose={() => setIsLaneSheetOpen(false)} onSave={(name, nodeType, color, limits) => addNode(boardState.callId, name, nodeType, color, limits)} />
      <LaneDetailsSheet
        isOpen={editLaneNodeId !== null}
        onClose={() => setEditLaneNodeId(null)}
        node={boardState.board?.Nodes.find((n) => n.CommandStructureNodeId === editLaneNodeId) ?? null}
        objectives={boardState.board?.Objectives ?? []}
        needs={boardState.board?.Needs ?? []}
        maps={boardState.board?.Maps ?? []}
        users={users}
        onSave={(nodeId, patch) => updateNodeDetails(boardState.callId, nodeId, patch)}
      />
      <CommandDetailsSheet isOpen={isCommandDetailsOpen} onClose={() => setIsCommandDetailsOpen(false)} command={boardState.board?.Command ?? null} onSave={handleSaveCommandInfo} />
      <TransferCommandSheet
        isOpen={isTransferSheetOpen}
        onClose={() => setIsTransferSheetOpen(false)}
        personnel={users}
        currentCommanderUserId={boardState.board?.Command?.CurrentCommanderUserId}
        onTransfer={handleTransferCommand}
      />
      <AssignResourceSheet
        isOpen={assignTargetNodeId !== null}
        onClose={() => setAssignTargetNodeId(null)}
        options={resourceOptions}
        resolveLaneName={laneName}
        targetNodeId={assignTargetNodeId}
        onSave={handleAssignResourceSave}
      />

      {/* Call resource viewers — the same modals the call detail screen uses, opened in place */}
      <CallNotesModal isOpen={callResourceModal === 'notes'} onClose={() => setCallResourceModal(null)} callId={boardState.callId} />
      <CallImagesModal isOpen={callResourceModal === 'images'} onClose={() => setCallResourceModal(null)} callId={boardState.callId} />
      <CallFilesModal isOpen={callResourceModal === 'files'} onClose={() => setCallResourceModal(null)} callId={boardState.callId} />
      <CustomBottomSheet isOpen={callResourceModal === 'video'} onClose={() => setCallResourceModal(null)} snapPoints={[85]} testID="command-video-sheet">
        <VStack space="md" className="w-full">
          <Heading size="md">{t('video_feeds.tab_title')}</Heading>
          <VideoFeedTabContent callId={parseInt(boardState.callId, 10) || 0} />
        </VStack>
      </CustomBottomSheet>

      {/* End-command confirmation — ending closes the command server-side and drops the local board */}
      <AlertDialog isOpen={isEndConfirmOpen} onClose={() => setIsEndConfirmOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="end-command-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('command.end_command_confirm_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">{t('command.end_command_confirm_message')}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setIsEndConfirmOpen(false)} testID="end-command-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button action="negative" onPress={handleEndCommand} testID="end-command-confirm">
              <ButtonText>{t('command.end_command')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* "Already assigned to another lane" confirmation */}
      <AlertDialog isOpen={moveConflict !== null} onClose={() => setMoveConflict(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="move-conflict-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('command.move_conflict_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">
              {moveConflict ? t('command.move_conflict_message', { resource: moveConflict.resourceName, lane: moveConflict.fromLane, target: moveConflict.toLane }) : ''}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setMoveConflict(null)} testID="move-conflict-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button onPress={handleConfirmMove} testID="move-conflict-confirm">
              <ButtonText>{t('command.move')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
