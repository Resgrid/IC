import { router } from 'expo-router';
import {
  ClipboardList,
  CloudOff,
  ExternalLink,
  Image as ImageIcon,
  Info,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Pencil,
  Radio,
  RefreshCw,
  Sparkles,
  StickyNote,
  Trash2,
  UserCog,
  Users,
  Video as VideoIcon,
  XCircle,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { VideoFeedTabContent } from '@/components/call-video-feeds/video-feed-tab-content';
import CallFilesModal from '@/components/calls/call-files-modal';
import CallImagesModal from '@/components/calls/call-images-modal';
import CallNotesModal from '@/components/calls/call-notes-modal';
import { AccountabilitySection } from '@/components/command/accountability-section';
import { AddAssignmentSheet } from '@/components/command/add-assignment-sheet';
import { AddLaneSheet } from '@/components/command/add-lane-sheet';
import { AddResourceSheet } from '@/components/command/add-resource-sheet';
import { type AssignableResourceOption, AssignResourceSheet } from '@/components/command/assign-resource-sheet';
import { IncidentAssistantSheet } from '@/components/command/assistant-sheet';
import { CommandDetailsSheet } from '@/components/command/command-details-sheet';
import { CommandSection } from '@/components/command/command-section';
import { IncidentFilesSection } from '@/components/command/incident-files-section';
import { IncidentWeatherSection } from '@/components/command/incident-weather-section';
import { LandscapeStructureBoard } from '@/components/command/landscape-structure-board';
import { LaneDetailsSheet } from '@/components/command/lane-details-sheet';
import { MapsTabbedCard } from '@/components/command/maps-tabbed-card';
import { NeedsSection } from '@/components/command/needs-section';
import { NotesSection } from '@/components/command/notes-section';
import { ObjectivesSection } from '@/components/command/objectives-section';
import { PersonnelResourceCard, UnitResourceCard } from '@/components/command/resource-cards';
import { ResourceDetailsSheet } from '@/components/command/resource-details-sheet';
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
import { useCommandBoardLayout } from '@/hooks/use-command-board-layout';
import { useDirectMessage } from '@/hooks/use-direct-message';
import { getIncidentRoleName } from '@/lib/incident-command-utils';
import { isWeb } from '@/lib/platform';
import { ChatChannelType } from '@/models/v4/chat';
import { type IncidentNeedStatus, type ResourceAssignment, ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useChatStore } from '@/stores/chat/store';
import { type AssignmentOutcome } from '@/stores/command/store';
import { useCommandStore } from '@/stores/command/store';
import { useRolesStore } from '@/stores/roles/store';
import { useToastStore } from '@/stores/toast/store';
import { useUnitsStore } from '@/stores/units/store';

/** One-line truncation: numberOfLines leaks to the DOM through the styling pipeline on web, so use CSS ellipsis there. */
const oneLine = isWeb ? ({ isTruncated: true } as const) : ({ numberOfLines: 1 } as const);

export default function CommandBoard() {
  const { t } = useTranslation();
  const { height: viewportHeight, width: viewportWidth, isRoomy, isLandscapeBoard } = useCommandBoardLayout();

  // Phones in portrait keep the compact controls so the header doesn't crowd out the board; tablets,
  // landscape and desktop-sized windows get full-height buttons that are actually easy to hit.
  const controlSize = isRoomy ? 'md' : 'xs';
  const iconButtonClass = isRoomy ? 'px-4' : 'px-3';
  const showLabels = isRoomy;
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
  const fetchCalls = useCallsStore((state) => state.fetchCalls);
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
  /** Resource being inspected in the details sheet; context decides lane-remove vs pool-release. */
  const [viewResource, setViewResource] = useState<{ assignment: ResourceAssignment; context: 'lane' | 'pool' } | null>(null);
  /** Resources list filter: pool-only, lane-only, or everything. */
  const [resourceFilter, setResourceFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [isCommandDetailsOpen, setIsCommandDetailsOpen] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  /** Which call-resource viewer (from the underlying call) is open on top of the board. */
  const [callResourceModal, setCallResourceModal] = useState<'notes' | 'images' | 'files' | 'video' | null>(null);

  const boardList = useMemo(() => Object.values(boards), [boards]);
  const boardState = activeBoardCallId ? boards[activeBoardCallId] : undefined;

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
      // Chat channels for the incident (command + one per lane). Archived ones are included so a
      // closed incident's conversation is still readable.
      void useChatStore.getState().loadIncidentChannels(boardCallId);
    }
  }, [boardCallId, fetchTimeline, fetchVoiceChannels, fetchTransmissionLog]);

  const incidentChannels = useChatStore((state) => (boardCallId ? state.incidentChannelsByCallId[boardCallId] : undefined));

  const incidentChannelsLoadFlag = useChatStore((state) => (boardCallId ? state.incidentChannelsLoadingByCallId[boardCallId] : undefined));

  // The channel map holds undefined both before the fetch lands and for an incident that genuinely
  // has no such channel, so a tap mid-load would otherwise claim chat is unavailable. The flag is
  // still undefined between the board opening and the load effect firing — treat that as loading
  // too, and only fall through to "unavailable" once a request has actually finished.
  const isLoadingIncidentChannels = boardCallId ? (incidentChannelsLoadFlag ?? incidentChannels === undefined) : false;

  const commandChatChannelId = useMemo(() => incidentChannels?.find((channel) => channel.ChannelType === ChatChannelType.IncidentCommand)?.ChatChannelId ?? null, [incidentChannels]);

  const laneChatChannelId = useCallback((nodeId: string) => incidentChannels?.find((channel) => channel.CommandStructureNodeId === nodeId)?.ChatChannelId ?? null, [incidentChannels]);

  const openChatChannel = useCallback(
    (channelId: string | null, unavailableMessage: string) => {
      if (!channelId) {
        // Still fetching: stay silent rather than report a channel missing that may yet arrive.
        if (isLoadingIncidentChannels) {
          return;
        }
        showToast('info', unavailableMessage);
        return;
      }
      router.push(`/chat/${channelId}`);
    },
    [showToast, isLoadingIncidentChannels]
  );

  const handleOpenCommandChat = useCallback(() => openChatChannel(commandChatChannelId, t('command.command_chat_unavailable')), [openChatChannel, commandChatChannelId, t]);

  const leadsChatChannelId = useMemo(() => incidentChannels?.find((channel) => channel.ChannelType === ChatChannelType.IncidentLeads)?.ChatChannelId ?? null, [incidentChannels]);

  const handleOpenLeadsChat = useCallback(() => openChatChannel(leadsChatChannelId, t('command.leads_chat_unavailable')), [openChatChannel, leadsChatChannelId, t]);

  const dispatchChatChannelId = useMemo(() => incidentChannels?.find((channel) => channel.ChannelType === ChatChannelType.IncidentDispatch)?.ChatChannelId ?? null, [incidentChannels]);

  const handleOpenDispatchChat = useCallback(() => openChatChannel(dispatchChatChannelId, t('command.dispatch_chat_unavailable')), [openChatChannel, dispatchChatChannelId, t]);

  const { openDirectMessage } = useDirectMessage();

  const handleOpenLaneChat = useCallback((nodeId: string) => openChatChannel(laneChatChannelId(nodeId), t('command.lane_chat_unavailable')), [openChatChannel, laneChatChannelId, t]);

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

  const handleOpenAssistant = useCallback(() => setIsAssistantOpen(true), []);
  const handleCloseAssistant = useCallback(() => setIsAssistantOpen(false), []);
  const handleOpenCommandDetails = useCallback(() => setIsCommandDetailsOpen(true), []);
  const handleOpenTransfer = useCallback(() => setIsTransferSheetOpen(true), []);
  const handleOpenEndConfirm = useCallback(() => setIsEndConfirmOpen(true), []);

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
      fetchTimeline(activeBoardCallId);
      fetchVoiceChannels(activeBoardCallId);
      fetchTransmissionLog(activeBoardCallId);
    }
  }, [activeBoardCallId, refreshBoard, fetchTimeline, fetchVoiceChannels, fetchTransmissionLog]);

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

  const filteredDeptAssignments = useMemo(
    () =>
      deptAssignments.filter((a) => {
        if (resourceFilter === 'unassigned') {
          return !a.CommandStructureNodeId;
        }
        if (resourceFilter === 'assigned') {
          return !!a.CommandStructureNodeId;
        }
        return true;
      }),
    [deptAssignments, resourceFilter]
  );

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

  // Lane item action — pull the resource out of its lane back into the unassigned pool
  const handleRemoveFromLane = useCallback(
    async (assignmentId: string) => {
      if (!activeBoardCallId) {
        return;
      }
      const outcome = await moveResourceAssignment(activeBoardCallId, assignmentId, '');
      notifyAssignmentOutcome(outcome);
    },
    [activeBoardCallId, moveResourceAssignment, notifyAssignmentOutcome]
  );

  // Pool item action — release the resource off the incident entirely
  const handleReleaseFromIncident = useCallback(
    async (assignmentId: string) => {
      if (!activeBoardCallId) {
        return;
      }
      await releaseResourceAssignment(activeBoardCallId, assignmentId);
    },
    [activeBoardCallId, releaseResourceAssignment]
  );

  // Delete a lane — its resources are either moved back to the pool or released first
  const handleDeleteLane = useCallback(
    async (nodeId: string, disposition: 'pool' | 'release') => {
      if (!activeBoardCallId) {
        return;
      }
      const laneAssignments = (boards[activeBoardCallId]?.board?.Assignments ?? []).filter((a) => !a.ReleasedOn && a.CommandStructureNodeId === nodeId);
      if (disposition === 'pool') {
        const outcomes = await Promise.all(laneAssignments.map((assignment) => moveResourceAssignment(activeBoardCallId, assignment.ResourceAssignmentId, '')));
        outcomes.forEach(notifyAssignmentOutcome);
        if (outcomes.some((outcome) => outcome?.blocked)) {
          return;
        }
      } else {
        await Promise.all(laneAssignments.map((assignment) => releaseResourceAssignment(activeBoardCallId, assignment.ResourceAssignmentId)));
      }
      await deleteNode(activeBoardCallId, nodeId);
    },
    [activeBoardCallId, boards, moveResourceAssignment, releaseResourceAssignment, deleteNode, notifyAssignmentOutcome]
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
  const summaryCall = calls.find((c) => c.CallId === boardState.callId) ?? (activeCall?.CallId === boardState.callId ? activeCall : null);

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
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" testID="command-board-scroll">
        <VStack space="md" className="px-3 pb-3 pt-2">
          {/* Board switcher — the IC may be running several incidents at once */}
          {boardList.length > 1 ? (
            <ScrollView horizontal directionalLockEnabled showsHorizontalScrollIndicator={false} testID="command-board-switcher">
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
          <Box className="rounded-xl bg-white px-3 py-2 shadow-xs dark:bg-gray-800" testID="command-active-call">
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

            {/* Labels on roomy surfaces where there is width for them; icon-only on a phone in
                portrait, where six labelled buttons would wrap into three rows and push the board
                off screen. Every button keeps its accessibilityLabel either way. */}
            <HStack space="sm" className="mt-2 flex-wrap">
              <Button onPress={handleViewCall} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('command.view_call')} testID="command-view-call">
                <ButtonIcon as={ExternalLink} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('command.view_call')}</ButtonText> : null}
              </Button>
              <Button onPress={handleOpenCommandDetails} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('command.command_details')} testID="command-edit-details">
                <ButtonIcon as={Pencil} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('command.command_details')}</ButtonText> : null}
              </Button>
              <Button onPress={handleOpenTransfer} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('command.transfer_command')} testID="command-transfer">
                <ButtonIcon as={UserCog} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('command.transfer_command')}</ButtonText> : null}
              </Button>
              <Button onPress={handleRefresh} variant="outline" size={controlSize} className={iconButtonClass} isDisabled={isRefreshing} accessibilityLabel={t('common.refresh')} testID="command-refresh">
                <ButtonIcon as={RefreshCw} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('common.refresh')}</ButtonText> : null}
              </Button>
              {/* Assistant: answers board questions on-device first, so it stays useful with no signal.
                  Filled purple rather than an outline so it reads as its own thing among the actions. */}
              <Button
                onPress={handleOpenAssistant}
                variant="solid"
                size={controlSize}
                className={`bg-purple-600 data-[hover=true]:bg-purple-700 data-[active=true]:bg-purple-800 ${iconButtonClass}`}
                accessibilityLabel={t('incident_assistant.title')}
                testID="command-assistant"
              >
                <ButtonIcon as={Sparkles} className="text-white" />
                {showLabels ? <ButtonText className="text-white">{t('incident_assistant.title')}</ButtonText> : null}
              </Button>
              <Button onPress={handleOpenCommandChat} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('command.command_chat')} testID="command-open-chat">
                <ButtonIcon as={MessagesSquare} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('command.command_chat')}</ButtonText> : null}
              </Button>
              <Button onPress={handleOpenLeadsChat} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('command.leads_chat')} testID="command-open-leads-chat">
                <ButtonIcon as={Users} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('command.leads_chat')}</ButtonText> : null}
              </Button>
              {/* Whichever dispatcher is on shift sees this — it is the desk, not a person. */}
              <Button onPress={handleOpenDispatchChat} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('command.dispatch_chat')} testID="command-open-dispatch-chat">
                <ButtonIcon as={Radio} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('command.dispatch_chat')}</ButtonText> : null}
              </Button>
              {/* A confirmation dialog guards against accidental taps. */}
              <Button onPress={handleOpenEndConfirm} action="negative" variant="solid" size={controlSize} className={iconButtonClass} accessibilityLabel={t('command.end_command')} testID="command-end-command">
                <ButtonIcon as={XCircle} className="text-white" />
                {showLabels ? <ButtonText className="text-white">{t('command.end_command')}</ButtonText> : null}
              </Button>
            </HStack>

            {/* Quick access to the underlying call's notes/images/files/video without leaving the board */}
            <HStack space="sm" className="mt-2 flex-wrap">
              <Button onPress={() => setCallResourceModal('notes')} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('call_detail.notes')} testID="command-call-notes">
                <ButtonIcon as={StickyNote} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('call_detail.notes')}</ButtonText> : null}
              </Button>
              <Button onPress={() => setCallResourceModal('images')} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('call_detail.images')} testID="command-call-images">
                <ButtonIcon as={ImageIcon} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('call_detail.images')}</ButtonText> : null}
              </Button>
              <Button onPress={() => setCallResourceModal('files')} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('call_detail.files.button')} testID="command-call-files">
                <ButtonIcon as={Paperclip} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('call_detail.files.button')}</ButtonText> : null}
              </Button>
              <Button onPress={() => setCallResourceModal('video')} variant="outline" size={controlSize} className={iconButtonClass} accessibilityLabel={t('video_feeds.tab_title')} testID="command-call-video">
                <ButtonIcon as={VideoIcon} className="text-gray-700 dark:text-gray-200" />
                {showLabels ? <ButtonText>{t('video_feeds.tab_title')}</ButtonText> : null}
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

          {/* Maps pane — incident map (default) and named tactical maps under tabs */}
          {boardState.board?.Command ? (
            <MapsTabbedCard
              callId={boardState.callId}
              command={boardState.board.Command}
              annotations={(boardState.board.Annotations ?? []).filter((a) => !a.DeletedOn && !a.IncidentMapId)}
              maps={boardState.board.Maps ?? []}
              onCreateMap={(name, description, expiresOn) => saveIncidentMapEntry(boardState.callId, { Name: name, Description: description, ExpiresOn: expiresOn })}
              onDeleteMap={(incidentMapId) => deleteIncidentMapEntry(boardState.callId, incidentMapId)}
              resolveUserName={personName}
            />
          ) : null}

          {/* Command structure lanes (Division/Group/Branch/...) with assigned resources */}
          {isLandscapeBoard ? (
            <LandscapeStructureBoard
              assignments={boardState.board?.Assignments ?? []}
              nodes={boardState.board?.Nodes ?? []}
              onAddLane={() => setIsLaneSheetOpen(true)}
              onAssignResource={(nodeId) => setAssignTargetNodeId(nodeId)}
              onEditLane={(nodeId) => setEditLaneNodeId(nodeId)}
              onOpenLaneChat={handleOpenLaneChat}
              onMoveResource={handleMoveResource}
              onViewResource={(assignment) => setViewResource({ assignment, context: 'lane' })}
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
              onEditLane={(nodeId) => setEditLaneNodeId(nodeId)}
              onOpenLaneChat={handleOpenLaneChat}
              onMoveResource={handleMoveResource}
              onViewResource={(assignment) => setViewResource({ assignment, context: 'lane' })}
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
                  {/* 1:1 with whoever holds this ICS position. */}
                  <Pressable
                    accessibilityLabel={t('command.message_role_holder')}
                    onPress={() => void openDirectMessage(assignment.UserId)}
                    className="p-3"
                    hitSlop={8}
                    testID={`assignment-message-${assignment.IncidentRoleAssignmentId}`}
                  >
                    <Icon as={MessageCircle} size="md" className="text-blue-600 dark:text-blue-400" />
                  </Pressable>
                  <Pressable onPress={() => removeRole(boardState.callId, assignment.IncidentRoleAssignmentId)} className="p-3" hitSlop={8} testID={`assignment-remove-${assignment.IncidentRoleAssignmentId}`}>
                    <Icon as={Trash2} size="md" className="text-gray-600 dark:text-gray-300" />
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
            onAdd={() => {
              // Retry a failed/empty roster load when the user actually needs it
              if (units.length === 0) {
                fetchUnits();
              }
              setIsResourceSheetOpen(true);
            }}
            testID="command-resources-section"
          >
            {deptAssignments.length > 0 ? (
              <HStack space="sm" className="mb-1" testID="resource-filter-row">
                <Button size="xs" variant={resourceFilter === 'unassigned' ? 'solid' : 'outline'} onPress={() => setResourceFilter('unassigned')} testID="resource-filter-unassigned">
                  <ButtonText>{t('command.unassigned')}</ButtonText>
                </Button>
                <Button size="xs" variant={resourceFilter === 'assigned' ? 'solid' : 'outline'} onPress={() => setResourceFilter('assigned')} testID="resource-filter-assigned">
                  <ButtonText>{t('command.assigned')}</ButtonText>
                </Button>
                <Button size="xs" variant={resourceFilter === 'all' ? 'solid' : 'outline'} onPress={() => setResourceFilter('all')} testID="resource-filter-all">
                  <ButtonText>{t('command.all')}</ButtonText>
                </Button>
              </HStack>
            ) : null}
            {filteredDeptAssignments.map((assignment) =>
              isUnitKind(assignment.ResourceKind) ? (
                <UnitResourceCard
                  key={assignment.ResourceAssignmentId}
                  isLocal={assignment.ResourceAssignmentId.startsWith('local-')}
                  laneLabel={laneName(assignment.CommandStructureNodeId)}
                  name={resolveResourceName(assignment.ResourceKind, assignment.ResourceId)}
                  onView={() => setViewResource({ assignment, context: 'pool' })}
                  roles={unitRoles.filter((role) => role.UnitId === assignment.ResourceId)}
                  status={unitCurrentStatuses.find((s) => s.UnitId === assignment.ResourceId)}
                  testID={`resource-dept-${assignment.ResourceAssignmentId}`}
                  unit={units.find((u) => u.UnitId === assignment.ResourceId)}
                  viewTestID={`resource-dept-view-${assignment.ResourceAssignmentId}`}
                />
              ) : (
                <PersonnelResourceCard
                  key={assignment.ResourceAssignmentId}
                  isLocal={assignment.ResourceAssignmentId.startsWith('local-')}
                  laneLabel={laneName(assignment.CommandStructureNodeId)}
                  name={resolveResourceName(assignment.ResourceKind, assignment.ResourceId)}
                  onView={() => setViewResource({ assignment, context: 'pool' })}
                  person={users.find((u) => u.UserId === assignment.ResourceId)}
                  testID={`resource-dept-${assignment.ResourceAssignmentId}`}
                  viewTestID={`resource-dept-view-${assignment.ResourceAssignmentId}`}
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

          <AccountabilitySection
            callId={parseInt(boardState.callId, 10)}
            initialTimersEnabled={summaryCall?.CheckInTimersEnabled ?? false}
            units={units.filter((unit) => trackedUnitIds.includes(unit.UnitId))}
            onTimersActivated={fetchCalls}
          />

          {/* Auto-logged, time-stamped incident log */}
          <TimelineSection callId={boardState.callId} entries={boardState.timeline ?? []} onRefresh={() => fetchTimeline(boardState.callId)} />
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
        onMessageLead={(userId: string) => void openDirectMessage(userId)}
        resourceCount={(boardState.board?.Assignments ?? []).filter((a) => !a.ReleasedOn && a.CommandStructureNodeId === editLaneNodeId).length}
        onDelete={(nodeId, disposition) => void handleDeleteLane(nodeId, disposition)}
      />
      <CommandDetailsSheet isOpen={isCommandDetailsOpen} onClose={() => setIsCommandDetailsOpen(false)} command={boardState.board?.Command ?? null} onSave={handleSaveCommandInfo} />
      <ResourceDetailsSheet
        actionLabel={viewResource?.context === 'lane' ? t('command.remove_from_lane') : t('command.release_from_incident')}
        actionTestID="resource-details-action"
        isOpen={viewResource !== null}
        kind={viewResource && isUnitKind(viewResource.assignment.ResourceKind) ? 'unit' : 'person'}
        laneColor={viewResource ? (boardState.board?.Nodes.find((n) => n.CommandStructureNodeId === viewResource.assignment.CommandStructureNodeId)?.Color ?? null) : null}
        laneName={viewResource ? laneName(viewResource.assignment.CommandStructureNodeId) : null}
        name={viewResource ? resolveResourceName(viewResource.assignment.ResourceKind, viewResource.assignment.ResourceId) : ''}
        onAction={() => {
          if (!viewResource) {
            return;
          }
          if (viewResource.context === 'lane') {
            void handleRemoveFromLane(viewResource.assignment.ResourceAssignmentId);
          } else {
            void handleReleaseFromIncident(viewResource.assignment.ResourceAssignmentId);
          }
        }}
        onClose={() => setViewResource(null)}
        onSecondaryAction={viewResource?.context === 'lane' ? () => void handleReleaseFromIncident(viewResource.assignment.ResourceAssignmentId) : undefined}
        person={viewResource ? users.find((u) => u.UserId === viewResource.assignment.ResourceId) : undefined}
        resourceId={viewResource?.assignment.ResourceId ?? ''}
        secondaryActionLabel={viewResource?.context === 'lane' ? t('command.release_from_incident') : undefined}
        secondaryActionTestID={viewResource?.context === 'lane' ? 'resource-details-secondary-action' : undefined}
        status={viewResource ? unitCurrentStatuses.find((s) => s.UnitId === viewResource.assignment.ResourceId) : undefined}
        unit={viewResource ? units.find((u) => u.UnitId === viewResource.assignment.ResourceId) : undefined}
        unitRoles={viewResource ? unitRoles.filter((role) => role.UnitId === viewResource.assignment.ResourceId) : []}
      />
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

      <IncidentAssistantSheet isOpen={isAssistantOpen} onClose={handleCloseAssistant} callId={boardState.callId} />

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
