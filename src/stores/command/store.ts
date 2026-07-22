import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  acknowledgeIncidentTimer,
  addIncidentAttachment,
  addIncidentNote,
  assignResource,
  closeCommand,
  completeObjective,
  deleteCommandNode,
  deleteIncidentMap,
  deleteMapAnnotation,
  establishCommand,
  evaluateAccountability,
  getAccountability,
  getCommandBoard,
  getCommandTimeline,
  getNeedEntities,
  getNeedUpdates,
  moveResource,
  releaseResource,
  removeIncidentAttachment,
  reopenCommand,
  requestNeedEntities,
  saveCommandNode,
  saveIncidentMap,
  saveMapAnnotation,
  saveNeed,
  saveObjective,
  setNeedStatus,
  startIncidentTimer,
  transferCommand,
  updateCommandDetails,
  updateCommandInfo,
  updateMapView,
  updateObjectiveProgress,
} from '@/api/incidentCommand/incidentCommand';
import { createAdHocPersonnel, createAdHocUnit, getAdHocPersonnel, getAdHocUnits, releaseAdHocPersonnel, releaseAdHocUnit } from '@/api/incidentCommand/incidentResources';
import { assignIncidentRole, removeIncidentRole } from '@/api/incidentCommand/incidentRoles';
import { closeIncidentChannels, createIncidentChannel, getChannelsForCall, getTransmissionLog, logTransmission } from '@/api/incidentCommand/incidentVoice';
import { getSyncBundle } from '@/api/incidentCommand/sync';
import { type LaneLimits } from '@/components/command/add-lane-sheet';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';
import { uuidv4 } from '@/lib/utils';
import { QueuedEventStatus, QueuedEventType } from '@/models/offline-queue/queued-event';
import {
  type CommandLogEntry,
  type CommandNodeType,
  type CommandStructureNode,
  type IncidentAdHocPersonnel,
  type IncidentAdHocUnit,
  type IncidentCommandBoard,
  type IncidentMap,
  type IncidentMapAnnotation,
  type IncidentNeed,
  type IncidentNeedEntity,
  IncidentNeedStatus,
  type IncidentNeedUpdate,
  type IncidentRoleType,
  type IncidentVoiceChannel,
  type ResourceAssignmentKind,
  TacticalObjectiveStatus,
  type TacticalObjectiveType,
  type UpdateCommandInfoInput,
  type VoiceTransmissionLog,
} from '@/models/v4/incidentCommand/incidentCommandModels';
import { useCoreStore } from '@/stores/app/core-store';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';

/** Result of a lane assign/move: advisory requirements warning, or a forced-requirements rejection. */
export interface AssignmentOutcome {
  warning?: string;
  blocked?: string;
}

/** Locally-tracked state for one incident's command board. */
export interface CommandBoardState {
  callId: string;
  /** Server board — null only for a provisional board established offline. */
  board: IncidentCommandBoard | null;
  /** Ad-hoc (non-Resgrid) units tracked against this incident. */
  adHocUnits: IncidentAdHocUnit[];
  /** Ad-hoc (external / temp / volunteer) personnel tracked against this incident. */
  adHocPersonnel: IncidentAdHocPersonnel[];
  /** True when the command was established offline and hasn't reached the server yet. */
  isProvisional: boolean;
  lastRefreshed: number | null;
  /** Server-side auto-logged incident log (fetched on demand, newest first). */
  timeline?: CommandLogEntry[];
  /** Open on-demand PTT channels for this incident. */
  voiceChannels?: IncidentVoiceChannel[];
  /** PTT transmission log (who keyed up when), newest first. */
  transmissionLog?: VoiceTransmissionLog[];
}

interface CommandState {
  /** One board per call — an IC can run multiple incidents at once. */
  boards: Record<string, CommandBoardState>;
  /** The board currently shown on the Command Board tab. */
  activeCallId: string | null;
  /** Server sync cursor from the last Sync Bundle/Changes pull (unix epoch ms). */
  lastSyncTimestampMs: number;
  isRefreshing: boolean;

  startCommand: (callId: string, commandDefinitionId?: number | null) => Promise<void>;
  switchCommand: (callId: string) => Promise<void>;
  endCommand: (callId: string) => Promise<void>;
  refreshBoard: (callId: string) => Promise<void>;
  /** Pull the full active-incident bundle from the server (shift-start / reconnect). */
  syncFromServer: () => Promise<void>;

  assignRole: (callId: string, roleType: IncidentRoleType, userId: string) => Promise<void>;
  removeRole: (callId: string, incidentRoleAssignmentId: string) => Promise<void>;
  addAdHocUnit: (callId: string, name: string, type?: string) => Promise<void>;
  releaseAdHocUnitEntry: (callId: string, incidentAdHocUnitId: string) => Promise<void>;
  addAdHocPersonnel: (callId: string, name: string, role?: string, agency?: string) => Promise<void>;
  releaseAdHocPersonnelEntry: (callId: string, incidentAdHocPersonnelId: string) => Promise<void>;
  refreshAccountability: (callId: string) => Promise<void>;

  addNode: (callId: string, name: string, nodeType: CommandNodeType, color?: string, limits?: LaneLimits) => Promise<void>;
  deleteNode: (callId: string, commandStructureNodeId: string) => Promise<void>;
  /**
   * Assign a resource to a lane. Returns null on clean success, { warning } when the lane's
   * requirements are advisory-violated, or { blocked } when the lane forces requirements the
   * resource doesn't meet (the assignment was rejected server-side).
   */
  assignResourceToNode: (callId: string, commandStructureNodeId: string, resourceKind: ResourceAssignmentKind, resourceId: string) => Promise<AssignmentOutcome | null>;
  /** Move an existing resource assignment to another lane. Same outcome semantics as assignResourceToNode. */
  moveResourceAssignment: (callId: string, resourceAssignmentId: string, targetNodeId: string) => Promise<AssignmentOutcome | null>;
  releaseResourceAssignment: (callId: string, resourceAssignmentId: string) => Promise<void>;
  addObjective: (callId: string, name: string, objectiveType: TacticalObjectiveType) => Promise<void>;
  /** Complete (close out) an objective with how it turned out (TacticalObjectiveOutcome) and an optional note. */
  completeObjectiveEntry: (callId: string, tacticalObjectiveId: string, outcome?: number, note?: string | null) => Promise<void>;
  /** Set an objective's progress (0-100; 100 completes it server-side). */
  updateObjectiveProgressEntry: (callId: string, tacticalObjectiveId: string, progressPercent: number) => Promise<void>;

  /** Add a command-level need (resources/logistics/etc.). */
  addNeed: (callId: string, name: string, category: number, options?: { description?: string; quantityRequested?: number; priority?: number }) => Promise<void>;
  /**
   * Transition a need's fulfillment status (Open/PartiallyMet/Met/Cancelled). The fill quantity may
   * move DOWN as well as up; the optional note lands on the server-side audit trail and incident log.
   */
  setNeedStatusEntry: (callId: string, incidentNeedId: string, status: IncidentNeedStatus, quantityFulfilled?: number, note?: string | null) => Promise<void>;

  /** Audit trail for one need (newest first): fill/status changes with note, author name, timestamp. */
  fetchNeedUpdates: (incidentNeedId: string) => Promise<IncidentNeedUpdate[]>;

  /**
   * Create an Entity need: the selected units/users/roles/groups are added to the call and
   * dispatched individually by the server as "Requested by Incident Command". Online-only.
   */
  requestNeedEntitiesEntry: (callId: string, name: string, description: string | null, entities: { EntityKind: number; EntityId: string }[]) => Promise<boolean>;

  /** The requested entities under one Entity-category need. Online-only. */
  fetchNeedEntities: (incidentNeedId: string) => Promise<IncidentNeedEntity[]>;

  /** Update command-level details every resource sees: estimated end + important information. */
  updateCommandDetailsEntry: (callId: string, estimatedEndOn: string | null, importantInformation: string | null) => Promise<void>;

  /**
   * Update core incident info (name, start time, locations, ...). Online-only — the server geocodes
   * any location whose text is set without coordinates. Returns false on failure.
   */
  updateCommandInfoEntry: (callId: string, info: Omit<UpdateCommandInfoInput, 'IncidentCommandId'>) => Promise<boolean>;

  /**
   * Add an operational status note (internal or public). Online-only; the server writes the matching
   * incident-log entry (public notes verbatim, private notes as an attributed marker).
   */
  addIncidentNoteEntry: (callId: string, body: string, visibility: number, title?: string | null) => Promise<boolean>;

  /** Reopen a previously closed command for this call with a reason. Online-only. */
  reopenCommandForCall: (callId: string, incidentCommandId: string, reason: string | null) => Promise<boolean>;

  /** Create/update the incident map's saved view (center + zoom). Online-only. */
  updateMapViewEntry: (callId: string, centerLatitude: string, centerLongitude: string, zoomLevel: string) => Promise<boolean>;

  /** Save (create or update) an incident-map markup annotation. Online-only. */
  saveMapAnnotationEntry: (callId: string, annotation: Partial<IncidentMapAnnotation>) => Promise<boolean>;

  /** Save (create or update) a NAMED incident map — audit stamps + log entry happen server-side. Online-only. */
  saveIncidentMapEntry: (callId: string, map: Partial<IncidentMap>) => Promise<boolean>;

  /** Soft-delete a named incident map. Online-only. */
  deleteIncidentMapEntry: (callId: string, incidentMapId: string) => Promise<boolean>;

  /** Upload an incident file (report/image/document). Online-only. */
  addIncidentAttachmentEntry: (callId: string, visibility: number, description: string | null, file: { uri: string; name: string; type: string }) => Promise<boolean>;

  /** Remove an incident file. Online-only. */
  removeIncidentAttachmentEntry: (callId: string, incidentAttachmentId: string) => Promise<boolean>;

  /** Delete an incident-map markup annotation. Online-only. */
  deleteMapAnnotationEntry: (callId: string, incidentMapAnnotationId: string) => Promise<boolean>;

  /** Edit an existing lane (rename, leads, linked objectives/need). Merges the patch into the stored lane. */
  updateNodeDetails: (callId: string, commandStructureNodeId: string, patch: Partial<CommandStructureNode>) => Promise<void>;

  /** Start a repeating incident timer (PAR check, benchmark reminder). Online-only. */
  startTimer: (callId: string, name: string, intervalSeconds: number) => Promise<void>;
  /** Acknowledge a due timer — the server resets its next-due time. Online-only. */
  acknowledgeTimer: (callId: string, incidentTimerId: string) => Promise<void>;
  /** Transfer command of this incident to another user. Online-only. */
  transferIncidentCommand: (callId: string, toUserId: string) => Promise<boolean>;
  /** Pull the server-side incident log for this board. */
  fetchTimeline: (callId: string) => Promise<void>;

  /** Open tactical/command PTT channels for this incident (voice addon). Online-only. */
  createVoiceChannel: (callId: string, name: string) => Promise<boolean>;
  fetchVoiceChannels: (callId: string) => Promise<void>;
  closeVoiceChannels: (callId: string) => Promise<void>;
  fetchTransmissionLog: (callId: string) => Promise<void>;
  /** Record one completed local PTT transmission against a channel. */
  recordTransmission: (callId: string, departmentVoiceChannelId: string, startedOn: string, endedOn: string) => Promise<void>;
}

const isOffline = () => {
  const queue = useOfflineQueueStore.getState();
  return !queue.isConnected || !queue.isNetworkReachable;
};

const queueEvent = (type: QueuedEventType, data: Record<string, unknown>) => useOfflineQueueStore.getState().addEvent(type, data);

const toNumericCallId = (callId: string) => {
  const parsed = parseInt(callId, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const localId = (prefix: string) => `local-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const emptyBoardState = (callId: string, provisional: boolean): CommandBoardState => ({
  callId,
  board: null,
  adHocUnits: [],
  adHocPersonnel: [],
  isProvisional: provisional,
  lastRefreshed: null,
});

/**
 * A server board refresh must NOT wipe optimistic `local-` rows whose queued offline writes have not
 * completed yet (adds made offline, or online adds that failed and were queued for retry) — otherwise
 * an app restart "loses" the work until the queue drains. Carries those rows forward from the previous
 * board; once the queued event completes, the refreshed server board contains the real row and the
 * matching queue entry is gone, so the local row stops being carried.
 */
const preserveQueuedLocalRows = (callId: string, serverBoard: IncidentCommandBoard | null, previousBoard: IncidentCommandBoard | null | undefined): IncidentCommandBoard | null => {
  if (!serverBoard || !previousBoard) {
    return serverBoard;
  }

  const queuedEvents = useOfflineQueueStore.getState().queuedEvents ?? [];
  const hasQueued = (types: QueuedEventType[]) => queuedEvents.some((event) => event.status !== QueuedEventStatus.COMPLETED && String(event.data?.callId) === callId && types.includes(event.type));

  const carryLocal = <T>(previous: T[] | undefined, server: T[], idOf: (row: T) => string, types: QueuedEventType[]): T[] => {
    if (!hasQueued(types)) {
      return server;
    }
    const localRows = (previous ?? []).filter((row) => idOf(row).startsWith('local-'));
    return localRows.length > 0 ? [...server, ...localRows] : server;
  };

  return {
    ...serverBoard,
    Needs: carryLocal(previousBoard.Needs, serverBoard.Needs ?? [], (row) => row.IncidentNeedId, [QueuedEventType.SAVE_NEED]),
    Objectives: carryLocal(previousBoard.Objectives, serverBoard.Objectives ?? [], (row) => row.TacticalObjectiveId, [QueuedEventType.SAVE_OBJECTIVE]),
    Nodes: carryLocal(previousBoard.Nodes, serverBoard.Nodes ?? [], (row) => row.CommandStructureNodeId, [QueuedEventType.SAVE_COMMAND_NODE]),
    Roles: carryLocal(previousBoard.Roles, serverBoard.Roles ?? [], (row) => row.IncidentRoleAssignmentId, [QueuedEventType.ASSIGN_INCIDENT_ROLE]),
    Assignments: carryLocal(previousBoard.Assignments, serverBoard.Assignments ?? [], (row) => row.ResourceAssignmentId, [QueuedEventType.ASSIGN_COMMAND_RESOURCE]),
  };
};

/** Online-only per-need list fetch with the shared offline/local-id guards. */
const fetchNeedListSafe = async <T>(label: string, incidentNeedId: string, loader: () => Promise<{ Data?: T[] | null }>): Promise<T[]> => {
  if (isOffline() || incidentNeedId.startsWith('local-')) {
    return [];
  }
  try {
    const result = await loader();
    return result.Data ?? [];
  } catch (error) {
    logger.warn({ message: label, context: { error, incidentNeedId } });
    return [];
  }
};

/** Applies a board transform for one call (no-op when the board isn't loaded) — shared by map/file actions. */
const mutateBoard = (set: (partial: Partial<CommandState>) => void, get: () => CommandState, callId: string, transform: (board: IncidentCommandBoard) => IncidentCommandBoard) => {
  const current = get().boards[callId];
  if (!current?.board) {
    return;
  }
  set({ boards: { ...get().boards, [callId]: { ...current, board: transform(current.board) } } });
};

export const useCommandStore = create<CommandState>()(
  persist(
    (set, get) => ({
      boards: {},
      activeCallId: null,
      lastSyncTimestampMs: 0,
      isRefreshing: false,

      startCommand: async (callId: string, commandDefinitionId?: number | null) => {
        const existing = get().boards[callId];

        if (!existing) {
          if (isOffline()) {
            // Establish offline: provisional board now, replayed to the server on reconnect
            queueEvent(QueuedEventType.ESTABLISH_COMMAND, { callId, commandDefinitionId: commandDefinitionId ?? null });
            set({ boards: { ...get().boards, [callId]: emptyBoardState(callId, true) }, activeCallId: callId });
          } else {
            try {
              await establishCommand({ CallId: toNumericCallId(callId), CommandDefinitionId: commandDefinitionId ?? null });
            } catch (error) {
              logger.warn({
                message: 'EstablishCommand failed — queueing for retry and continuing with a provisional board',
                context: { error, callId },
              });
              queueEvent(QueuedEventType.ESTABLISH_COMMAND, { callId, commandDefinitionId: commandDefinitionId ?? null });
            }
            set({ boards: { ...get().boards, [callId]: emptyBoardState(callId, false) }, activeCallId: callId });
            await get().refreshBoard(callId);
          }
        } else {
          set({ activeCallId: callId });
        }

        // Keep the core active call in sync so call summaries and badges follow the board
        await useCoreStore.getState().setActiveCall(callId);
      },

      switchCommand: async (callId: string) => {
        if (!get().boards[callId]) {
          return;
        }
        set({ activeCallId: callId });
        await useCoreStore.getState().setActiveCall(callId);
        // Best-effort refresh; harmless offline
        get()
          .refreshBoard(callId)
          .catch(() => {});
      },

      endCommand: async (callId: string) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;

        if (incidentCommandId && !entry?.isProvisional) {
          if (isOffline()) {
            queueEvent(QueuedEventType.CLOSE_COMMAND, { callId, incidentCommandId });
          } else {
            try {
              await closeCommand(incidentCommandId);
            } catch (error) {
              logger.warn({
                message: 'CloseCommand failed — queueing for retry',
                context: { error, callId, incidentCommandId },
              });
              queueEvent(QueuedEventType.CLOSE_COMMAND, { callId, incidentCommandId });
            }
          }
        }
        // A provisional board that never reached the server just gets dropped locally.

        const boards = { ...get().boards };
        delete boards[callId];
        const remaining = Object.keys(boards);
        const nextActive = get().activeCallId === callId ? (remaining.length > 0 ? remaining[0] : null) : get().activeCallId;

        set({ boards, activeCallId: nextActive });
        await useCoreStore.getState().setActiveCall(nextActive);
      },

      refreshBoard: async (callId: string) => {
        if (isOffline()) {
          return;
        }
        try {
          set({ isRefreshing: true });
          const [boardResult, adHocResult, adHocPersonnelResult] = await Promise.all([getCommandBoard(callId), getAdHocUnits(callId), getAdHocPersonnel(callId)]);
          const existing = get().boards[callId] ?? emptyBoardState(callId, false);
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...existing,
                board: preserveQueuedLocalRows(callId, boardResult.Data, existing.board),
                adHocUnits: (adHocResult.Data ?? []).filter((u) => !u.ReleasedOn),
                adHocPersonnel: (adHocPersonnelResult.Data ?? []).filter((p) => !p.ReleasedOn),
                isProvisional: false,
                lastRefreshed: Date.now(),
              },
            },
            isRefreshing: false,
          });
        } catch (error) {
          set({ isRefreshing: false });
          logger.warn({
            message: 'Failed to refresh command board',
            context: { error, callId },
          });
        }
      },

      syncFromServer: async () => {
        if (isOffline()) {
          return;
        }
        try {
          set({ isRefreshing: true });
          const bundle = await getSyncBundle(true);
          const boards = { ...get().boards };

          for (const board of bundle.Data?.Boards ?? []) {
            const callId = String(board.Command.CallId);
            const existing = boards[callId] ?? emptyBoardState(callId, false);
            boards[callId] = {
              ...existing,
              board: preserveQueuedLocalRows(callId, board, existing.board) ?? board,
              adHocUnits: (bundle.Data?.AdHocUnits ?? []).filter((u) => String(u.CallId) === callId && !u.ReleasedOn),
              adHocPersonnel: (bundle.Data?.AdHocPersonnel ?? []).filter((p) => String(p.CallId) === callId && !p.ReleasedOn),
              isProvisional: false,
              lastRefreshed: Date.now(),
            };
          }

          set({
            boards,
            lastSyncTimestampMs: bundle.Data?.ServerTimestampMs ?? get().lastSyncTimestampMs,
            isRefreshing: false,
          });
        } catch (error) {
          set({ isRefreshing: false });
          logger.warn({
            message: 'Failed to sync command boards from server',
            context: { error },
          });
        }
      },

      assignRole: async (callId: string, roleType: IncidentRoleType, userId: string) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId ?? '';

        const applyOptimistic = () => {
          const current = get().boards[callId];
          if (!current?.board) return;
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Roles: [
                    ...current.board.Roles,
                    {
                      IncidentRoleAssignmentId: localId('role'),
                      IncidentCommandId: incidentCommandId,
                      DepartmentId: 0,
                      CallId: toNumericCallId(callId),
                      UserId: userId,
                      RoleType: roleType,
                      AssignedByUserId: '',
                      AssignedOn: new Date().toISOString(),
                    },
                  ],
                },
              },
            },
          });
        };

        if (isOffline()) {
          queueEvent(QueuedEventType.ASSIGN_INCIDENT_ROLE, { callId, roleType, userId });
          applyOptimistic();
          return;
        }

        try {
          await assignIncidentRole({ IncidentCommandId: incidentCommandId, CallId: toNumericCallId(callId), UserId: userId, RoleType: roleType });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'AssignRole failed — queueing for retry',
            context: { error, callId, roleType, userId },
          });
          queueEvent(QueuedEventType.ASSIGN_INCIDENT_ROLE, { callId, roleType, userId });
          applyOptimistic();
        }
      },

      removeRole: async (callId: string, incidentRoleAssignmentId: string) => {
        // Optimistically drop the row locally
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: { ...current.board, Roles: current.board.Roles.filter((r) => r.IncidentRoleAssignmentId !== incidentRoleAssignmentId) },
              },
            },
          });
        }

        // Locally-created assignments never reached the server — nothing to replay
        if (incidentRoleAssignmentId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.REMOVE_INCIDENT_ROLE, { callId, incidentRoleAssignmentId });
          return;
        }

        try {
          await removeIncidentRole(incidentRoleAssignmentId);
        } catch (error) {
          logger.warn({
            message: 'RemoveRole failed — queueing for retry',
            context: { error, callId, incidentRoleAssignmentId },
          });
          queueEvent(QueuedEventType.REMOVE_INCIDENT_ROLE, { callId, incidentRoleAssignmentId });
        }
      },

      addAdHocUnit: async (callId: string, name: string, type?: string) => {
        const applyOptimistic = () => {
          const current = get().boards[callId] ?? emptyBoardState(callId, true);
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                adHocUnits: [
                  ...current.adHocUnits,
                  {
                    IncidentAdHocUnitId: localId('unit'),
                    DepartmentId: 0,
                    CallId: toNumericCallId(callId),
                    Name: name,
                    Type: type ?? null,
                    CreatedByUserId: '',
                    CreatedOn: new Date().toISOString(),
                  } as IncidentAdHocUnit,
                ],
              },
            },
          });
        };

        if (isOffline()) {
          queueEvent(QueuedEventType.CREATE_ADHOC_UNIT, { callId, name, type });
          applyOptimistic();
          return;
        }

        try {
          await createAdHocUnit({ CallId: toNumericCallId(callId), Name: name, Type: type });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'CreateAdHocUnit failed — queueing for retry',
            context: { error, callId, name },
          });
          queueEvent(QueuedEventType.CREATE_ADHOC_UNIT, { callId, name, type });
          applyOptimistic();
        }
      },

      releaseAdHocUnitEntry: async (callId: string, incidentAdHocUnitId: string) => {
        const current = get().boards[callId];
        if (current) {
          set({
            boards: {
              ...get().boards,
              [callId]: { ...current, adHocUnits: current.adHocUnits.filter((u) => u.IncidentAdHocUnitId !== incidentAdHocUnitId) },
            },
          });
        }

        if (incidentAdHocUnitId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.RELEASE_ADHOC_UNIT, { callId, incidentAdHocUnitId });
          return;
        }

        try {
          await releaseAdHocUnit(incidentAdHocUnitId);
        } catch (error) {
          logger.warn({
            message: 'ReleaseAdHocUnit failed — queueing for retry',
            context: { error, callId, incidentAdHocUnitId },
          });
          queueEvent(QueuedEventType.RELEASE_ADHOC_UNIT, { callId, incidentAdHocUnitId });
        }
      },

      addNode: async (callId: string, name: string, nodeType: CommandNodeType, color?: string, limits?: LaneLimits) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId ?? '';

        const applyOptimistic = () => {
          const current = get().boards[callId];
          if (!current?.board) return;
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Nodes: [
                    ...current.board.Nodes,
                    {
                      CommandStructureNodeId: localId('node'),
                      IncidentCommandId: incidentCommandId,
                      DepartmentId: 0,
                      CallId: toNumericCallId(callId),
                      NodeType: nodeType,
                      Name: name,
                      Color: color ?? null,
                      MinUnits: limits?.minUnits ?? 0,
                      MaxUnits: limits?.maxUnits ?? 0,
                      MinUnitPersonnel: limits?.minUnitPersonnel ?? 0,
                      MaxUnitPersonnel: limits?.maxUnitPersonnel ?? 0,
                      MinTimeInRole: limits?.minTimeInRole ?? 0,
                      MaxTimeInRole: limits?.maxTimeInRole ?? 0,
                      SortOrder: current.board.Nodes.length,
                    },
                  ],
                },
              },
            },
          });
        };

        if (isOffline()) {
          queueEvent(QueuedEventType.SAVE_COMMAND_NODE, { callId, name, nodeType, color, limits });
          applyOptimistic();
          return;
        }

        try {
          await saveCommandNode({
            IncidentCommandId: incidentCommandId,
            CallId: toNumericCallId(callId),
            Name: name,
            NodeType: nodeType,
            Color: color,
            MinUnits: limits?.minUnits ?? 0,
            MaxUnits: limits?.maxUnits ?? 0,
            MinUnitPersonnel: limits?.minUnitPersonnel ?? 0,
            MaxUnitPersonnel: limits?.maxUnitPersonnel ?? 0,
            MinTimeInRole: limits?.minTimeInRole ?? 0,
            MaxTimeInRole: limits?.maxTimeInRole ?? 0,
            SortOrder: entry?.board?.Nodes.length ?? 0,
          });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'SaveNode failed — queueing for retry',
            context: { error, callId, name },
          });
          queueEvent(QueuedEventType.SAVE_COMMAND_NODE, { callId, name, nodeType, color, limits });
          applyOptimistic();
        }
      },

      deleteNode: async (callId: string, commandStructureNodeId: string) => {
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Nodes: current.board.Nodes.filter((n) => n.CommandStructureNodeId !== commandStructureNodeId),
                  Assignments: current.board.Assignments.filter((a) => a.CommandStructureNodeId !== commandStructureNodeId),
                },
              },
            },
          });
        }

        if (commandStructureNodeId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.DELETE_COMMAND_NODE, { callId, commandStructureNodeId });
          return;
        }

        try {
          await deleteCommandNode(commandStructureNodeId);
        } catch (error) {
          logger.warn({
            message: 'DeleteNode failed — queueing for retry',
            context: { error, callId, commandStructureNodeId },
          });
          queueEvent(QueuedEventType.DELETE_COMMAND_NODE, { callId, commandStructureNodeId });
        }
      },

      assignResourceToNode: async (callId: string, commandStructureNodeId: string, resourceKind: ResourceAssignmentKind, resourceId: string) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId ?? '';

        const applyOptimistic = () => {
          const current = get().boards[callId];
          if (!current?.board) return;
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Assignments: [
                    ...current.board.Assignments,
                    {
                      ResourceAssignmentId: localId('assignment'),
                      IncidentCommandId: incidentCommandId,
                      DepartmentId: 0,
                      CallId: toNumericCallId(callId),
                      CommandStructureNodeId: commandStructureNodeId,
                      ResourceKind: resourceKind,
                      ResourceId: resourceId,
                      AssignedByUserId: '',
                      AssignedOn: new Date().toISOString(),
                      RequirementsWarning: false,
                    },
                  ],
                },
              },
            },
          });
        };

        if (isOffline()) {
          queueEvent(QueuedEventType.ASSIGN_COMMAND_RESOURCE, { callId, commandStructureNodeId, resourceKind, resourceId });
          applyOptimistic();
          return null;
        }

        try {
          const result = await assignResource({
            IncidentCommandId: incidentCommandId,
            CallId: toNumericCallId(callId),
            CommandStructureNodeId: commandStructureNodeId,
            ResourceKind: resourceKind,
            ResourceId: resourceId,
          });
          // Forced requirements rejection: HTTP 200 with no Data and the reason in Message.
          if (!result.Data && result.Message) {
            return { blocked: result.Message };
          }
          await get().refreshBoard(callId);
          return result.Data?.RequirementsWarning ? { warning: result.Data.RequirementsWarningMessage ?? result.Message ?? undefined } : null;
        } catch (error) {
          logger.warn({
            message: 'AssignResource failed — queueing for retry',
            context: { error, callId, commandStructureNodeId, resourceId },
          });
          queueEvent(QueuedEventType.ASSIGN_COMMAND_RESOURCE, { callId, commandStructureNodeId, resourceKind, resourceId });
          applyOptimistic();
          return null;
        }
      },

      moveResourceAssignment: async (callId: string, resourceAssignmentId: string, targetNodeId: string) => {
        const entry = get().boards[callId];
        const assignment = entry?.board?.Assignments.find((item) => item.ResourceAssignmentId === resourceAssignmentId && !item.ReleasedOn);
        if (!assignment || assignment.CommandStructureNodeId === targetNodeId) {
          return null;
        }

        const sourceNodeId = assignment.CommandStructureNodeId;
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Assignments: current.board.Assignments.map((item) => (item.ResourceAssignmentId === resourceAssignmentId ? { ...item, CommandStructureNodeId: targetNodeId } : item)),
                },
              },
            },
          });
        }

        if (resourceAssignmentId.startsWith('local-')) {
          const queuedAssignments = useOfflineQueueStore
            .getState()
            .getPendingEvents()
            .filter(
              (event) =>
                event.type === QueuedEventType.ASSIGN_COMMAND_RESOURCE &&
                event.data.callId === callId &&
                event.data.commandStructureNodeId === sourceNodeId &&
                event.data.resourceKind === assignment.ResourceKind &&
                event.data.resourceId === assignment.ResourceId
            );
          const queuedAssignment = queuedAssignments[queuedAssignments.length - 1];
          if (queuedAssignment) {
            useOfflineQueueStore.setState((state) => ({
              queuedEvents: state.queuedEvents.map((event) => (event.id === queuedAssignment.id ? { ...event, data: { ...event.data, commandStructureNodeId: targetNodeId } } : event)),
            }));
          }
          return null;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.MOVE_COMMAND_RESOURCE, { callId, resourceAssignmentId, targetNodeId });
          return null;
        }

        try {
          const result = await moveResource({ ResourceAssignmentId: resourceAssignmentId, TargetNodeId: targetNodeId });
          // Forced requirements rejection — undo the optimistic lane change and report the reason.
          if (!result.Data && result.Message) {
            const after = get().boards[callId];
            if (after?.board) {
              set({
                boards: {
                  ...get().boards,
                  [callId]: {
                    ...after,
                    board: {
                      ...after.board,
                      Assignments: after.board.Assignments.map((item) => (item.ResourceAssignmentId === resourceAssignmentId ? { ...item, CommandStructureNodeId: sourceNodeId } : item)),
                    },
                  },
                },
              });
            }
            return { blocked: result.Message };
          }
          await get().refreshBoard(callId);
          return result.Data?.RequirementsWarning ? { warning: result.Data.RequirementsWarningMessage ?? result.Message ?? undefined } : null;
        } catch (error) {
          logger.warn({
            message: 'MoveResource failed — queueing for retry',
            context: { error, callId, resourceAssignmentId, targetNodeId },
          });
          queueEvent(QueuedEventType.MOVE_COMMAND_RESOURCE, { callId, resourceAssignmentId, targetNodeId });
          return null;
        }
      },

      releaseResourceAssignment: async (callId: string, resourceAssignmentId: string) => {
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: { ...current.board, Assignments: current.board.Assignments.filter((a) => a.ResourceAssignmentId !== resourceAssignmentId) },
              },
            },
          });
        }

        if (resourceAssignmentId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.RELEASE_COMMAND_RESOURCE, { callId, resourceAssignmentId });
          return;
        }

        try {
          await releaseResource(resourceAssignmentId);
        } catch (error) {
          logger.warn({
            message: 'ReleaseResource failed — queueing for retry',
            context: { error, callId, resourceAssignmentId },
          });
          queueEvent(QueuedEventType.RELEASE_COMMAND_RESOURCE, { callId, resourceAssignmentId });
        }
      },

      addObjective: async (callId: string, name: string, objectiveType: TacticalObjectiveType) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId ?? '';

        const applyOptimistic = () => {
          const current = get().boards[callId];
          if (!current?.board) return;
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Objectives: [
                    ...current.board.Objectives,
                    {
                      TacticalObjectiveId: localId('objective'),
                      IncidentCommandId: incidentCommandId,
                      DepartmentId: 0,
                      CallId: toNumericCallId(callId),
                      Name: name,
                      ObjectiveType: objectiveType,
                      Status: TacticalObjectiveStatus.Pending,
                      AutoPopulated: false,
                      ProgressPercent: 0,
                      Priority: 0,
                      SortOrder: current.board.Objectives.length,
                    },
                  ],
                },
              },
            },
          });
        };

        if (isOffline()) {
          queueEvent(QueuedEventType.SAVE_OBJECTIVE, { callId, name, objectiveType });
          applyOptimistic();
          return;
        }

        try {
          await saveObjective({ IncidentCommandId: incidentCommandId, CallId: toNumericCallId(callId), Name: name, ObjectiveType: objectiveType, SortOrder: entry?.board?.Objectives.length ?? 0 });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'SaveObjective failed — queueing for retry',
            context: { error, callId, name },
          });
          queueEvent(QueuedEventType.SAVE_OBJECTIVE, { callId, name, objectiveType });
          applyOptimistic();
        }
      },

      completeObjectiveEntry: async (callId: string, tacticalObjectiveId: string, outcome?: number, note?: string | null) => {
        // Optimistically flip the row to Complete with its close-out outcome/note
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Objectives: current.board.Objectives.map((o) =>
                    o.TacticalObjectiveId === tacticalObjectiveId ? { ...o, Status: TacticalObjectiveStatus.Complete, CompletedOn: new Date().toISOString(), Outcome: outcome ?? 0, CompletionNote: note ?? null } : o
                  ),
                },
              },
            },
          });
        }

        if (tacticalObjectiveId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.COMPLETE_OBJECTIVE, { callId, tacticalObjectiveId, outcome, note });
          return;
        }

        try {
          await completeObjective(tacticalObjectiveId, outcome, note);
          get()
            .fetchTimeline(callId)
            .catch(() => {});
        } catch (error) {
          logger.warn({
            message: 'CompleteObjective failed — queueing for retry',
            context: { error, callId, tacticalObjectiveId },
          });
          queueEvent(QueuedEventType.COMPLETE_OBJECTIVE, { callId, tacticalObjectiveId, outcome, note });
        }
      },

      updateObjectiveProgressEntry: async (callId: string, tacticalObjectiveId: string, progressPercent: number) => {
        const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));

        // Optimistically stamp progress (and the implied status transition) on the row
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Objectives: current.board.Objectives.map((o) => {
                    if (o.TacticalObjectiveId !== tacticalObjectiveId) return o;
                    if (clamped === 100) {
                      return { ...o, ProgressPercent: 100, Status: TacticalObjectiveStatus.Complete, CompletedOn: new Date().toISOString() };
                    }
                    const status = o.Status === TacticalObjectiveStatus.Complete ? o.Status : clamped > 0 ? TacticalObjectiveStatus.InProgress : TacticalObjectiveStatus.Pending;
                    return { ...o, ProgressPercent: clamped, Status: status };
                  }),
                },
              },
            },
          });
        }

        if (tacticalObjectiveId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.UPDATE_OBJECTIVE_PROGRESS, { callId, tacticalObjectiveId, progressPercent: clamped });
          return;
        }

        try {
          await updateObjectiveProgress({ TacticalObjectiveId: tacticalObjectiveId, ProgressPercent: clamped });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'UpdateObjectiveProgress failed — queueing for retry',
            context: { error, callId, tacticalObjectiveId },
          });
          queueEvent(QueuedEventType.UPDATE_OBJECTIVE_PROGRESS, { callId, tacticalObjectiveId, progressPercent: clamped });
        }
      },

      addNeed: async (callId: string, name: string, category: number, options?: { description?: string; quantityRequested?: number; priority?: number }) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId ?? '';

        const applyOptimistic = () => {
          const current = get().boards[callId];
          if (!current?.board) return;
          const needs = current.board.Needs ?? [];
          const optimistic: IncidentNeed = {
            IncidentNeedId: localId('need'),
            IncidentCommandId: incidentCommandId,
            DepartmentId: 0,
            CallId: toNumericCallId(callId),
            Name: name,
            Description: options?.description ?? null,
            Category: category,
            Status: IncidentNeedStatus.Open,
            QuantityRequested: options?.quantityRequested ?? 0,
            QuantityFulfilled: 0,
            Priority: options?.priority ?? 0,
            CreatedOn: new Date().toISOString(),
            SortOrder: needs.length,
          };
          set({
            boards: {
              ...get().boards,
              [callId]: { ...current, board: { ...current.board, Needs: [...needs, optimistic] } },
            },
          });
        };

        const queueData = { callId, name, category, description: options?.description, quantityRequested: options?.quantityRequested, priority: options?.priority };

        if (isOffline()) {
          queueEvent(QueuedEventType.SAVE_NEED, queueData);
          applyOptimistic();
          return;
        }

        try {
          await saveNeed({
            IncidentCommandId: incidentCommandId,
            CallId: toNumericCallId(callId),
            Name: name,
            Category: category,
            Description: options?.description,
            QuantityRequested: options?.quantityRequested ?? 0,
            Priority: options?.priority ?? 0,
            SortOrder: entry?.board?.Needs?.length ?? 0,
          });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'SaveNeed failed — queueing for retry',
            context: { error, callId, name },
          });
          queueEvent(QueuedEventType.SAVE_NEED, queueData);
          applyOptimistic();
        }
      },

      setNeedStatusEntry: async (callId: string, incidentNeedId: string, status: IncidentNeedStatus, quantityFulfilled?: number, note?: string | null) => {
        // Optimistically flip the row
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Needs: (current.board.Needs ?? []).map((n) => {
                    if (n.IncidentNeedId !== incidentNeedId) return n;
                    const fulfilled = quantityFulfilled ?? (status === IncidentNeedStatus.Met && n.QuantityRequested > 0 ? n.QuantityRequested : n.QuantityFulfilled);
                    return {
                      ...n,
                      Status: status,
                      QuantityFulfilled: fulfilled,
                      MetOn: status === IncidentNeedStatus.Met ? new Date().toISOString() : null,
                    };
                  }),
                },
              },
            },
          });
        }

        if (incidentNeedId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.SET_NEED_STATUS, { callId, incidentNeedId, status, quantityFulfilled, note });
          return;
        }

        try {
          await setNeedStatus({ IncidentNeedId: incidentNeedId, Status: status, QuantityFulfilled: quantityFulfilled, Note: note });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'SetNeedStatus failed — queueing for retry',
            context: { error, callId, incidentNeedId },
          });
          queueEvent(QueuedEventType.SET_NEED_STATUS, { callId, incidentNeedId, status, quantityFulfilled, note });
        }
      },

      requestNeedEntitiesEntry: async (callId: string, name: string, description: string | null, entities: { EntityKind: number; EntityId: string }[]) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId || entities.length === 0) {
          return false;
        }
        try {
          const result = await requestNeedEntities(incidentCommandId, name, description, entities);
          if (!result.Data) {
            return false;
          }
          await get().refreshBoard(callId);
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'RequestNeedEntities failed',
            context: { error, callId, name },
          });
          return false;
        }
      },

      fetchNeedEntities: async (incidentNeedId: string) => fetchNeedListSafe('Failed to fetch need entities', incidentNeedId, () => getNeedEntities(incidentNeedId)),

      fetchNeedUpdates: async (incidentNeedId: string) => fetchNeedListSafe('Failed to fetch need updates', incidentNeedId, () => getNeedUpdates(incidentNeedId)),

      updateCommandDetailsEntry: async (callId: string, estimatedEndOn: string | null, importantInformation: string | null) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId ?? '';

        // Optimistically stamp the command header
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: { ...current.board, Command: { ...current.board.Command, EstimatedEndOn: estimatedEndOn, ImportantInformation: importantInformation } },
              },
            },
          });
        }

        if (isOffline() || !incidentCommandId) {
          queueEvent(QueuedEventType.UPDATE_COMMAND_DETAILS, { callId, estimatedEndOn, importantInformation });
          return;
        }

        try {
          await updateCommandDetails({ IncidentCommandId: incidentCommandId, EstimatedEndOn: estimatedEndOn, ImportantInformation: importantInformation });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'UpdateCommandDetails failed — queueing for retry',
            context: { error, callId },
          });
          queueEvent(QueuedEventType.UPDATE_COMMAND_DETAILS, { callId, estimatedEndOn, importantInformation });
        }
      },

      updateMapViewEntry: async (callId: string, centerLatitude: string, centerLongitude: string, zoomLevel: string) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId) {
          return false;
        }
        try {
          await updateMapView(incidentCommandId, centerLatitude, centerLongitude, zoomLevel);
          // Optimistically stamp the saved view so the map card reframes immediately
          const current = get().boards[callId];
          if (current?.board) {
            set({
              boards: {
                ...get().boards,
                [callId]: {
                  ...current,
                  board: { ...current.board, Command: { ...current.board.Command, MapCenterLatitude: centerLatitude, MapCenterLongitude: centerLongitude, MapZoomLevel: zoomLevel } },
                },
              },
            });
          }
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'UpdateMapView failed',
            context: { error, callId },
          });
          return false;
        }
      },

      saveMapAnnotationEntry: async (callId: string, annotation: Partial<IncidentMapAnnotation>) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId) {
          return false;
        }
        try {
          const result = await saveMapAnnotation({ ...annotation, IncidentCommandId: incidentCommandId, CallId: toNumericCallId(callId) });
          const saved = result.Data;
          if (!saved) {
            return false;
          }
          mutateBoard(set, get, callId, (board) => {
            const annotations = board.Annotations ?? [];
            const exists = annotations.some((a) => a.IncidentMapAnnotationId === saved.IncidentMapAnnotationId);
            return { ...board, Annotations: exists ? annotations.map((a) => (a.IncidentMapAnnotationId === saved.IncidentMapAnnotationId ? saved : a)) : [...annotations, saved] };
          });
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'SaveMapAnnotation failed',
            context: { error, callId },
          });
          return false;
        }
      },

      saveIncidentMapEntry: async (callId: string, map: Partial<IncidentMap>) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId) {
          return false;
        }
        try {
          const result = await saveIncidentMap({ ...map, IncidentCommandId: incidentCommandId, CallId: toNumericCallId(callId) });
          const saved = result.Data;
          if (!saved) {
            return false;
          }
          mutateBoard(set, get, callId, (board) => {
            const maps = board.Maps ?? [];
            const exists = maps.some((m) => m.IncidentMapId === saved.IncidentMapId);
            return { ...board, Maps: exists ? maps.map((m) => (m.IncidentMapId === saved.IncidentMapId ? saved : m)) : [...maps, saved] };
          });
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'SaveIncidentMap failed',
            context: { error, callId },
          });
          return false;
        }
      },

      deleteIncidentMapEntry: async (callId: string, incidentMapId: string) => {
        try {
          await deleteIncidentMap(incidentMapId);
          mutateBoard(set, get, callId, (board) => ({ ...board, Maps: (board.Maps ?? []).filter((m) => m.IncidentMapId !== incidentMapId) }));
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'DeleteIncidentMap failed',
            context: { error, callId, incidentMapId },
          });
          return false;
        }
      },

      addIncidentAttachmentEntry: async (callId: string, visibility: number, description: string | null, file: { uri: string; name: string; type: string }) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId) {
          return false;
        }
        try {
          const result = await addIncidentAttachment(incidentCommandId, visibility, description, file);
          if (!result.Data) {
            return false;
          }
          await get().refreshBoard(callId);
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'AddIncidentAttachment failed',
            context: { error, callId, fileName: file.name },
          });
          return false;
        }
      },

      removeIncidentAttachmentEntry: async (callId: string, incidentAttachmentId: string) => {
        try {
          await removeIncidentAttachment(incidentAttachmentId);
          mutateBoard(set, get, callId, (board) => ({ ...board, Attachments: (board.Attachments ?? []).filter((a) => a.IncidentAttachmentId !== incidentAttachmentId) }));
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'RemoveIncidentAttachment failed',
            context: { error, callId, incidentAttachmentId },
          });
          return false;
        }
      },

      deleteMapAnnotationEntry: async (callId: string, incidentMapAnnotationId: string) => {
        try {
          await deleteMapAnnotation(incidentMapAnnotationId);
          mutateBoard(set, get, callId, (board) => ({ ...board, Annotations: (board.Annotations ?? []).filter((a) => a.IncidentMapAnnotationId !== incidentMapAnnotationId) }));
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'DeleteMapAnnotation failed',
            context: { error, callId, incidentMapAnnotationId },
          });
          return false;
        }
      },

      updateCommandInfoEntry: async (callId: string, info: Omit<UpdateCommandInfoInput, 'IncidentCommandId'>) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId) {
          return false;
        }
        try {
          await updateCommandInfo({ IncidentCommandId: incidentCommandId, ...info });
          await get().refreshBoard(callId);
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'UpdateCommandInfo failed',
            context: { error, callId },
          });
          return false;
        }
      },

      addIncidentNoteEntry: async (callId: string, body: string, visibility: number, title?: string | null) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId || !body.trim()) {
          return false;
        }
        try {
          await addIncidentNote({ IncidentCommandId: incidentCommandId, NoteType: 0, Visibility: visibility, Title: title ?? null, Body: body.trim() });
          await get().refreshBoard(callId);
          get()
            .fetchTimeline(callId)
            .catch(() => {});
          return true;
        } catch (error) {
          logger.warn({
            message: 'AddIncidentNote failed',
            context: { error, callId },
          });
          return false;
        }
      },

      reopenCommandForCall: async (callId: string, incidentCommandId: string, reason: string | null) => {
        try {
          const result = await reopenCommand({ IncidentCommandId: incidentCommandId, Reason: reason });
          if (!result.Data) {
            return false;
          }
          set({ boards: { ...get().boards, [callId]: get().boards[callId] ?? emptyBoardState(callId, false) }, activeCallId: callId });
          await get().refreshBoard(callId);
          await useCoreStore.getState().setActiveCall(callId);
          return true;
        } catch (error) {
          logger.warn({
            message: 'ReopenCommand failed',
            context: { error, callId, incidentCommandId },
          });
          return false;
        }
      },

      updateNodeDetails: async (callId: string, commandStructureNodeId: string, patch: Partial<CommandStructureNode>) => {
        const entry = get().boards[callId];
        const stored = entry?.board?.Nodes.find((n) => n.CommandStructureNodeId === commandStructureNodeId);
        if (!stored) {
          return;
        }
        const merged = { ...stored, ...patch, CommandStructureNodeId: commandStructureNodeId };

        // Optimistically replace the lane on the board
        const current = get().boards[callId];
        if (current?.board) {
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: { ...current.board, Nodes: current.board.Nodes.map((n) => (n.CommandStructureNodeId === commandStructureNodeId ? merged : n)) },
              },
            },
          });
        }

        // A lane created offline replays through SAVE_COMMAND_NODE; its local id has no server row to update.
        if (commandStructureNodeId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.UPDATE_COMMAND_NODE, { callId, node: merged });
          return;
        }

        try {
          await saveCommandNode(merged);
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'SaveCommandNode (lane edit) failed — queueing for retry',
            context: { error, callId, commandStructureNodeId },
          });
          queueEvent(QueuedEventType.UPDATE_COMMAND_NODE, { callId, node: merged });
        }
      },

      addAdHocPersonnel: async (callId: string, name: string, role?: string, agency?: string) => {
        const applyOptimistic = () => {
          const current = get().boards[callId] ?? emptyBoardState(callId, true);
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                adHocPersonnel: [
                  ...current.adHocPersonnel,
                  {
                    IncidentAdHocPersonnelId: localId('person'),
                    DepartmentId: 0,
                    CallId: toNumericCallId(callId),
                    Name: name,
                    Role: role ?? null,
                    ExternalAgencyName: agency ?? null,
                    RidingResourceKind: 0,
                    CreatedByUserId: '',
                    CreatedOn: new Date().toISOString(),
                  } as IncidentAdHocPersonnel,
                ],
              },
            },
          });
        };

        if (isOffline()) {
          queueEvent(QueuedEventType.CREATE_ADHOC_PERSONNEL, { callId, name, role, agency });
          applyOptimistic();
          return;
        }

        try {
          await createAdHocPersonnel({ CallId: toNumericCallId(callId), Name: name, Role: role, ExternalAgencyName: agency });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'CreateAdHocPersonnel failed — queueing for retry',
            context: { error, callId, name },
          });
          queueEvent(QueuedEventType.CREATE_ADHOC_PERSONNEL, { callId, name, role, agency });
          applyOptimistic();
        }
      },

      releaseAdHocPersonnelEntry: async (callId: string, incidentAdHocPersonnelId: string) => {
        const current = get().boards[callId];
        if (current) {
          set({
            boards: {
              ...get().boards,
              [callId]: { ...current, adHocPersonnel: current.adHocPersonnel.filter((p) => p.IncidentAdHocPersonnelId !== incidentAdHocPersonnelId) },
            },
          });
        }

        if (incidentAdHocPersonnelId.startsWith('local-')) {
          return;
        }

        if (isOffline()) {
          queueEvent(QueuedEventType.RELEASE_ADHOC_PERSONNEL, { callId, incidentAdHocPersonnelId });
          return;
        }

        try {
          await releaseAdHocPersonnel(incidentAdHocPersonnelId);
        } catch (error) {
          logger.warn({
            message: 'ReleaseAdHocPersonnel failed — queueing for retry',
            context: { error, callId, incidentAdHocPersonnelId },
          });
          queueEvent(QueuedEventType.RELEASE_ADHOC_PERSONNEL, { callId, incidentAdHocPersonnelId });
        }
      },

      startTimer: async (callId: string, name: string, intervalSeconds: number) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId) {
          return;
        }
        try {
          await startIncidentTimer({
            IncidentTimerId: uuidv4(),
            IncidentCommandId: incidentCommandId,
            CallId: toNumericCallId(callId),
            TimerType: 3, // Custom
            ScopeType: 0, // Incident
            Name: name,
            IntervalSeconds: intervalSeconds,
            Status: 0,
            StartedOn: new Date().toISOString(),
          });
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'StartTimer failed',
            context: { error, callId, name },
          });
        }
      },

      acknowledgeTimer: async (callId: string, incidentTimerId: string) => {
        // Optimistically bump the next-due time so the row leaves its overdue state immediately
        const current = get().boards[callId];
        const timer = current?.board?.Timers.find((item) => item.IncidentTimerId === incidentTimerId);
        if (current?.board && timer) {
          const nextDue = timer.IntervalSeconds > 0 ? new Date(Date.now() + timer.IntervalSeconds * 1000).toISOString() : timer.NextDueOn;
          set({
            boards: {
              ...get().boards,
              [callId]: {
                ...current,
                board: {
                  ...current.board,
                  Timers: current.board.Timers.map((item) => (item.IncidentTimerId === incidentTimerId ? { ...item, Status: 2, AcknowledgedOn: new Date().toISOString(), NextDueOn: nextDue } : item)),
                },
              },
            },
          });
        }
        try {
          await acknowledgeIncidentTimer(incidentTimerId);
          await get().refreshBoard(callId);
        } catch (error) {
          logger.warn({
            message: 'AcknowledgeTimer failed',
            context: { error, callId, incidentTimerId },
          });
        }
      },

      transferIncidentCommand: async (callId: string, toUserId: string) => {
        const entry = get().boards[callId];
        const incidentCommandId = entry?.board?.Command?.IncidentCommandId;
        if (!incidentCommandId) {
          return false;
        }
        try {
          await transferCommand({ IncidentCommandId: incidentCommandId, ToUserId: toUserId });
          await get().refreshBoard(callId);
          return true;
        } catch (error) {
          logger.warn({
            message: 'TransferCommand failed',
            context: { error, callId, toUserId },
          });
          return false;
        }
      },

      fetchTimeline: async (callId: string) => {
        if (isOffline()) {
          return;
        }
        try {
          const result = await getCommandTimeline(callId);
          const current = get().boards[callId];
          if (current) {
            const entries = [...(result.Data ?? [])].sort((a, b) => new Date(b.OccurredOn).getTime() - new Date(a.OccurredOn).getTime());
            set({
              boards: {
                ...get().boards,
                [callId]: { ...current, timeline: entries },
              },
            });
          }
        } catch (error) {
          logger.warn({
            message: 'Failed to fetch command timeline',
            context: { error, callId },
          });
        }
      },

      createVoiceChannel: async (callId: string, name: string) => {
        try {
          const result = await createIncidentChannel({ CallId: toNumericCallId(callId), Name: name });
          if (!result.Data) {
            return false;
          }
          await get().fetchVoiceChannels(callId);
          return true;
        } catch (error) {
          logger.warn({
            message: 'CreateIncidentChannel failed',
            context: { error, callId, name },
          });
          return false;
        }
      },

      fetchVoiceChannels: async (callId: string) => {
        if (isOffline()) {
          return;
        }
        try {
          const result = await getChannelsForCall(callId);
          const current = get().boards[callId];
          if (current) {
            set({ boards: { ...get().boards, [callId]: { ...current, voiceChannels: result.Data ?? [] } } });
          }
        } catch (error) {
          logger.warn({
            message: 'Failed to fetch incident voice channels',
            context: { error, callId },
          });
        }
      },

      closeVoiceChannels: async (callId: string) => {
        try {
          await closeIncidentChannels(callId);
          await get().fetchVoiceChannels(callId);
        } catch (error) {
          logger.warn({
            message: 'CloseIncidentChannels failed',
            context: { error, callId },
          });
        }
      },

      fetchTransmissionLog: async (callId: string) => {
        if (isOffline()) {
          return;
        }
        try {
          const result = await getTransmissionLog(callId);
          const current = get().boards[callId];
          if (current) {
            set({ boards: { ...get().boards, [callId]: { ...current, transmissionLog: result.Data ?? [] } } });
          }
        } catch (error) {
          logger.warn({
            message: 'Failed to fetch transmission log',
            context: { error, callId },
          });
        }
      },

      recordTransmission: async (callId: string, departmentVoiceChannelId: string, startedOn: string, endedOn: string) => {
        try {
          await logTransmission({ CallId: toNumericCallId(callId), DepartmentVoiceChannelId: departmentVoiceChannelId, StartedOn: startedOn, EndedOn: endedOn });
          await get().fetchTransmissionLog(callId);
        } catch (error) {
          logger.warn({
            message: 'LogTransmission failed',
            context: { error, callId, departmentVoiceChannelId },
          });
        }
      },

      refreshAccountability: async (callId: string) => {
        if (isOffline()) {
          return;
        }
        try {
          await evaluateAccountability(callId);
          const result = await getAccountability(callId);
          const current = get().boards[callId];
          if (current?.board) {
            set({
              boards: {
                ...get().boards,
                [callId]: { ...current, board: { ...current.board, Accountability: result.Data ?? [] } },
              },
            });
          }
        } catch (error) {
          logger.warn({
            message: 'Failed to refresh accountability',
            context: { error, callId },
          });
        }
      },
    }),
    {
      name: 'command-storage',
      storage: createJSONStorage(() => zustandStorage),
      version: 4,
      // v1 stored device-local boards (assignments/resources arrays); v2 boards wrap the
      // server IncidentCommandBoard; v3 adds adHocPersonnel; v4 adds board.Needs. Drop v1
      // entries, backfill v2/v3.
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as { boards?: Record<string, unknown>; activeCallId?: string | null; lastSyncTimestampMs?: number };
        const boards: Record<string, CommandBoardState> = {};
        for (const [callId, entry] of Object.entries(state.boards ?? {})) {
          if (entry && typeof entry === 'object' && Array.isArray((entry as CommandBoardState).adHocUnits)) {
            const board = entry as CommandBoardState;
            boards[callId] = {
              ...board,
              adHocPersonnel: Array.isArray(board.adHocPersonnel) ? board.adHocPersonnel : [],
              board: board.board ? { ...board.board, Needs: Array.isArray(board.board.Needs) ? board.board.Needs : [] } : board.board,
            };
          }
        }
        return {
          boards,
          activeCallId: state.activeCallId && boards[state.activeCallId] ? state.activeCallId : (Object.keys(boards)[0] ?? null),
          lastSyncTimestampMs: state.lastSyncTimestampMs ?? 0,
        };
      },
      partialize: (state) => ({
        boards: state.boards,
        activeCallId: state.activeCallId,
        lastSyncTimestampMs: state.lastSyncTimestampMs,
      }),
    }
  )
);
