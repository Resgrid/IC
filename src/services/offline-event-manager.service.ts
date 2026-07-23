import { AppState, type AppStateStatus } from 'react-native';

import { saveCallImage } from '@/api/calls/callFiles';
import { performCheckIn } from '@/api/check-in-timers/check-in-timers';
import {
  assignResource,
  closeCommand,
  completeObjective,
  deleteCommandNode,
  establishCommand,
  getCommandBoard,
  moveResource,
  releaseResource,
  saveCommandNode,
  saveNeed,
  saveObjective,
  setNeedStatus,
  updateCommandDetails,
  updateObjectiveProgress,
} from '@/api/incidentCommand/incidentCommand';
import { createAdHocPersonnel, createAdHocUnit, releaseAdHocPersonnel, releaseAdHocUnit } from '@/api/incidentCommand/incidentResources';
import { assignIncidentRole, removeIncidentRole } from '@/api/incidentCommand/incidentRoles';
import { setUnitLocation } from '@/api/units/unitLocation';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { logger } from '@/lib/logging';
import {
  type QueuedAssignCommandResourceEvent,
  type QueuedAssignIncidentRoleEvent,
  type QueuedCallImageUploadEvent,
  type QueuedCheckInEvent,
  type QueuedCloseCommandEvent,
  type QueuedCompleteObjectiveEvent,
  type QueuedCreateAdHocPersonnelEvent,
  type QueuedCreateAdHocUnitEvent,
  type QueuedDeleteCommandNodeEvent,
  type QueuedEstablishCommandEvent,
  type QueuedEvent,
  QueuedEventStatus,
  QueuedEventType,
  type QueuedLocationUpdateEvent,
  type QueuedMoveCommandResourceEvent,
  type QueuedReleaseAdHocPersonnelEvent,
  type QueuedReleaseAdHocUnitEvent,
  type QueuedReleaseCommandResourceEvent,
  type QueuedRemoveIncidentRoleEvent,
  type QueuedSaveCommandNodeEvent,
  type QueuedSaveNeedEvent,
  type QueuedSaveObjectiveEvent,
  type QueuedSetNeedStatusEvent,
  type QueuedUnitStatusEvent,
  type QueuedUpdateCommandDetailsEvent,
  type QueuedUpdateCommandNodeEvent,
  type QueuedUpdateObjectiveProgressEvent,
} from '@/models/offline-queue/queued-event';
import { SaveUnitLocationInput } from '@/models/v4/unitLocation/saveUnitLocationInput';
import { SaveUnitStatusInput, SaveUnitStatusRoleInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import type * as CommandStoreModule from '@/stores/command/store';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';

class OfflineEventManager {
  private static instance: OfflineEventManager;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private appStateSubscription: { remove: () => void } | null = null;
  private reconnectUnsubscribe: (() => void) | null = null;
  private readonly PROCESSING_INTERVAL = 10000; // 10 seconds
  private readonly MAX_CONCURRENT_EVENTS = 3;

  private constructor() {
    this.initializeAppStateListener();
  }

  static getInstance(): OfflineEventManager {
    if (!OfflineEventManager.instance) {
      OfflineEventManager.instance = new OfflineEventManager();
    }
    return OfflineEventManager.instance;
  }

  /**
   * Initialize the offline event manager
   */
  public initialize(): void {
    logger.info({
      message: 'Initializing offline event manager',
    });

    // Initialize network listener
    useOfflineQueueStore.getState().initializeNetworkListener();

    // Drain the queue as soon as connectivity is restored (in addition to the interval)
    this.initializeReconnectListener();

    // Start processing when app becomes active
    this.handleAppStateChange(AppState.currentState);
  }

  /**
   * Manually trigger a sync (user-initiated "Sync Now"):
   * push all pending queued writes, then pull the latest command-board state.
   */
  public async syncNow(): Promise<void> {
    logger.info({
      message: 'Manual sync requested',
    });
    await this.processQueuedEvents();
    await this.pullCommandSync();
  }

  /**
   * Pull the latest incident-command state from the server (Sync Bundle).
   */
  private async pullCommandSync(): Promise<void> {
    try {
      // Lazy require to avoid a module cycle (store → queue store; manager → store).
      // require, not import(): Jest's CJS runtime can't execute dynamic import().
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useCommandStore } = require('@/stores/command/store') as typeof CommandStoreModule;
      await useCommandStore.getState().syncFromServer();
    } catch (error) {
      logger.warn({
        message: 'Command sync pull failed',
        context: { error },
      });
    }
  }

  /**
   * Subscribe to network state changes and process the queue immediately
   * when the device transitions from offline to online.
   */
  private initializeReconnectListener(): void {
    if (this.reconnectUnsubscribe) {
      return;
    }
    this.reconnectUnsubscribe = useOfflineQueueStore.subscribe((state, prevState) => {
      const wasOffline = !prevState.isConnected || !prevState.isNetworkReachable;
      const isOnline = state.isConnected && state.isNetworkReachable;
      if (wasOffline && isOnline) {
        logger.info({
          message: 'Connectivity restored — processing offline queue and pulling command sync',
        });
        this.processQueuedEvents().then(() => this.pullCommandSync());
      }
    });
  }

  /**
   * Start background processing of queued events
   */
  public startProcessing(): void {
    if (this.processingInterval) {
      logger.debug({
        message: 'Event processing already running',
      });
      return;
    }

    logger.info({
      message: 'Starting offline event processing',
    });

    this.processingInterval = setInterval(() => {
      this.processQueuedEvents();
    }, this.PROCESSING_INTERVAL);

    // Process immediately on start
    this.processQueuedEvents();
  }

  /**
   * Stop background processing
   */
  public stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info({
        message: 'Stopped offline event processing',
      });
    }
  }

  /**
   * Add a unit status event to the queue
   */
  public queueUnitStatusEvent(
    unitId: string,
    statusType: string,
    note?: string,
    respondingTo?: string,
    respondingToType?: number | string | null,
    roles?: { roleId: string; userId: string }[],
    gpsData?: {
      latitude?: string;
      longitude?: string;
      accuracy?: string;
      altitude?: string;
      altitudeAccuracy?: string;
      speed?: string;
      heading?: string;
    }
  ): string {
    const date = new Date();
    const data = {
      unitId,
      statusType,
      note,
      respondingTo,
      respondingToType,
      timestamp: date.toISOString(),
      timestampUtc: date.toUTCString().replace('UTC', 'GMT'),
      roles,
      latitude: gpsData?.latitude,
      longitude: gpsData?.longitude,
      accuracy: gpsData?.accuracy,
      altitude: gpsData?.altitude,
      altitudeAccuracy: gpsData?.altitudeAccuracy,
      speed: gpsData?.speed,
      heading: gpsData?.heading,
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.UNIT_STATUS, data);
  }

  /**
   * Add a location update event to the queue
   */
  public queueLocationUpdateEvent(unitId: string, latitude: number, longitude: number, accuracy?: number, heading?: number, speed?: number): string {
    const data = {
      unitId,
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      timestamp: new Date().toISOString(),
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.LOCATION_UPDATE, data);
  }

  /**
   * Add a call image upload event to the queue
   */
  public queueCallImageUploadEvent(callId: string, userId: string, note: string, name: string, filePath: string, latitude?: number, longitude?: number): string {
    const data = {
      callId,
      userId,
      note,
      name,
      latitude,
      longitude,
      filePath,
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.CALL_IMAGE_UPLOAD, data);
  }

  /**
   * Add a check-in event to the queue
   */
  public queueCheckInEvent(callId: number, checkInType: number, unitId?: number, latitude?: string, longitude?: string, note?: string): string {
    const data = {
      callId,
      checkInType,
      unitId,
      latitude,
      longitude,
      note,
      timestamp: new Date().toISOString(),
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.CHECK_IN, data);
  }

  // ---- Incident command (ICS) event processors ----
  // Handlers replay the API call ONLY. The board refresh happens centrally in
  // processEvent AFTER the event is marked COMPLETED: preserveQueuedLocalRows carries
  // optimistic `local-` rows while a non-completed queued event exists for the call, so
  // refreshing earlier would re-add the local row next to the server row the replay just
  // created (duplicate needs/objectives/nodes/resources on the board).

  /** Command event types whose replay must be followed by a board refresh. */
  private static readonly BOARD_REFRESH_EVENT_TYPES: ReadonlySet<QueuedEventType> = new Set([
    QueuedEventType.ESTABLISH_COMMAND,
    QueuedEventType.ASSIGN_INCIDENT_ROLE,
    QueuedEventType.CREATE_ADHOC_UNIT,
    QueuedEventType.CREATE_ADHOC_PERSONNEL,
    QueuedEventType.SAVE_COMMAND_NODE,
    QueuedEventType.ASSIGN_COMMAND_RESOURCE,
    QueuedEventType.MOVE_COMMAND_RESOURCE,
    QueuedEventType.SAVE_OBJECTIVE,
    QueuedEventType.UPDATE_OBJECTIVE_PROGRESS,
    QueuedEventType.SAVE_NEED,
    QueuedEventType.SET_NEED_STATUS,
    QueuedEventType.UPDATE_COMMAND_DETAILS,
    QueuedEventType.UPDATE_COMMAND_NODE,
  ]);

  private async refreshBoardForCommandEvent(event: QueuedEvent): Promise<void> {
    if (!OfflineEventManager.BOARD_REFRESH_EVENT_TYPES.has(event.type)) {
      return;
    }
    const callId = (event.data as { callId?: unknown }).callId;
    if (typeof callId === 'string' && callId) {
      await this.refreshCommandBoard(callId);
    }
  }

  private async refreshCommandBoard(callId: string): Promise<void> {
    try {
      // Lazy require to avoid a module cycle (store → queue store; manager → store).
      // require, not import(): Jest's CJS runtime can't execute dynamic import().
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useCommandStore } = require('@/stores/command/store') as typeof CommandStoreModule;
      await useCommandStore.getState().refreshBoard(callId);
    } catch {
      // Refresh is best-effort — the next sync pass converges the state
    }
  }

  private async processEstablishCommandEvent(event: QueuedEstablishCommandEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    await establishCommand({ CallId: Number.isNaN(callId) ? 0 : callId, CommandDefinitionId: event.data.commandDefinitionId ?? null });
  }

  private async processCloseCommandEvent(event: QueuedCloseCommandEvent): Promise<void> {
    await closeCommand(event.data.incidentCommandId);
  }

  private async processAssignIncidentRoleEvent(event: QueuedAssignIncidentRoleEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    await assignIncidentRole({
      CallId: Number.isNaN(callId) ? 0 : callId,
      RoleType: event.data.roleType,
      UserId: event.data.userId,
    });
  }

  private async processRemoveIncidentRoleEvent(event: QueuedRemoveIncidentRoleEvent): Promise<void> {
    await removeIncidentRole(event.data.incidentRoleAssignmentId);
  }

  private async processCreateAdHocUnitEvent(event: QueuedCreateAdHocUnitEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    await createAdHocUnit({ CallId: Number.isNaN(callId) ? 0 : callId, Name: event.data.name, Type: event.data.type });
  }

  private async processReleaseAdHocUnitEvent(event: QueuedReleaseAdHocUnitEvent): Promise<void> {
    await releaseAdHocUnit(event.data.incidentAdHocUnitId);
  }

  private async processCreateAdHocPersonnelEvent(event: QueuedCreateAdHocPersonnelEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    await createAdHocPersonnel({ CallId: Number.isNaN(callId) ? 0 : callId, Name: event.data.name, Role: event.data.role, ExternalAgencyName: event.data.agency });
  }

  private async processReleaseAdHocPersonnelEvent(event: QueuedReleaseAdHocPersonnelEvent): Promise<void> {
    await releaseAdHocPersonnel(event.data.incidentAdHocPersonnelId);
  }

  /** Resolve the server-side IncidentCommandId for a call (needed when the write was queued offline). */
  private async resolveIncidentCommandId(callId: string): Promise<string> {
    const board = await getCommandBoard(callId);
    const incidentCommandId = board.Data?.Command?.IncidentCommandId;
    if (!incidentCommandId) {
      throw new Error(`No active incident command found for call ${callId}`);
    }
    return incidentCommandId;
  }

  private async processSaveCommandNodeEvent(event: QueuedSaveCommandNodeEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    const incidentCommandId = await this.resolveIncidentCommandId(event.data.callId);
    await saveCommandNode({
      IncidentCommandId: incidentCommandId,
      CallId: Number.isNaN(callId) ? 0 : callId,
      Name: event.data.name,
      NodeType: event.data.nodeType,
      Color: event.data.color,
      MinUnits: event.data.limits?.minUnits ?? 0,
      MaxUnits: event.data.limits?.maxUnits ?? 0,
      MinUnitPersonnel: event.data.limits?.minUnitPersonnel ?? 0,
      MaxUnitPersonnel: event.data.limits?.maxUnitPersonnel ?? 0,
      MinTimeInRole: event.data.limits?.minTimeInRole ?? 0,
      MaxTimeInRole: event.data.limits?.maxTimeInRole ?? 0,
    });
  }

  private async processDeleteCommandNodeEvent(event: QueuedDeleteCommandNodeEvent): Promise<void> {
    await deleteCommandNode(event.data.commandStructureNodeId);
  }

  private async processAssignCommandResourceEvent(event: QueuedAssignCommandResourceEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    const incidentCommandId = await this.resolveIncidentCommandId(event.data.callId);
    await assignResource({
      IncidentCommandId: incidentCommandId,
      CallId: Number.isNaN(callId) ? 0 : callId,
      CommandStructureNodeId: event.data.commandStructureNodeId,
      ResourceKind: event.data.resourceKind,
      ResourceId: event.data.resourceId,
    });
  }

  private async processMoveCommandResourceEvent(event: QueuedMoveCommandResourceEvent): Promise<void> {
    await moveResource({ ResourceAssignmentId: event.data.resourceAssignmentId, TargetNodeId: event.data.targetNodeId });
  }

  private async processReleaseCommandResourceEvent(event: QueuedReleaseCommandResourceEvent): Promise<void> {
    await releaseResource(event.data.resourceAssignmentId);
  }

  private async processSaveObjectiveEvent(event: QueuedSaveObjectiveEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    const incidentCommandId = await this.resolveIncidentCommandId(event.data.callId);
    await saveObjective({ IncidentCommandId: incidentCommandId, CallId: Number.isNaN(callId) ? 0 : callId, Name: event.data.name, ObjectiveType: event.data.objectiveType });
  }

  private async processCompleteObjectiveEvent(event: QueuedCompleteObjectiveEvent): Promise<void> {
    await completeObjective(event.data.tacticalObjectiveId, event.data.outcome, event.data.note);
  }

  private async processUpdateObjectiveProgressEvent(event: QueuedUpdateObjectiveProgressEvent): Promise<void> {
    await updateObjectiveProgress({ TacticalObjectiveId: event.data.tacticalObjectiveId, ProgressPercent: event.data.progressPercent });
  }

  private async processSaveNeedEvent(event: QueuedSaveNeedEvent): Promise<void> {
    const callId = parseInt(event.data.callId, 10);
    const incidentCommandId = await this.resolveIncidentCommandId(event.data.callId);
    await saveNeed({
      IncidentCommandId: incidentCommandId,
      CallId: Number.isNaN(callId) ? 0 : callId,
      Name: event.data.name,
      Category: event.data.category,
      Description: event.data.description,
      QuantityRequested: event.data.quantityRequested ?? 0,
      Priority: event.data.priority ?? 0,
    });
  }

  private async processSetNeedStatusEvent(event: QueuedSetNeedStatusEvent): Promise<void> {
    await setNeedStatus({ IncidentNeedId: event.data.incidentNeedId, Status: event.data.status, QuantityFulfilled: event.data.quantityFulfilled, Note: event.data.note });
  }

  private async processUpdateCommandDetailsEvent(event: QueuedUpdateCommandDetailsEvent): Promise<void> {
    const incidentCommandId = await this.resolveIncidentCommandId(event.data.callId);
    if (!incidentCommandId) {
      return;
    }
    await updateCommandDetails({ IncidentCommandId: incidentCommandId, EstimatedEndOn: event.data.estimatedEndOn, ImportantInformation: event.data.importantInformation });
  }

  private async processUpdateCommandNodeEvent(event: QueuedUpdateCommandNodeEvent): Promise<void> {
    await saveCommandNode(event.data.node);
  }

  /**
   * Process check-in event
   */
  private async processCheckInEvent(event: QueuedCheckInEvent): Promise<void> {
    await performCheckIn({
      CallId: event.data.callId,
      CheckInType: event.data.checkInType,
      UnitId: event.data.unitId,
      Latitude: event.data.latitude,
      Longitude: event.data.longitude,
      Note: event.data.note,
    });
  }

  /**
   * Process queued events
   */
  private async processQueuedEvents(): Promise<void> {
    if (this.isProcessing) {
      logger.debug({
        message: 'Event processing already in progress, skipping',
      });
      return;
    }

    const store = useOfflineQueueStore.getState();

    // Don't process if offline
    if (!store.isConnected || !store.isNetworkReachable) {
      logger.debug({
        message: 'Device is offline, skipping event processing',
        context: { isConnected: store.isConnected, isNetworkReachable: store.isNetworkReachable },
      });
      return;
    }

    const pendingEvents = store.getPendingEvents();
    if (pendingEvents.length === 0) {
      return;
    }

    this.isProcessing = true;
    store._setProcessing(true);

    logger.info({
      message: 'Processing queued events',
      context: { eventCount: pendingEvents.length },
    });

    // Process events in batches
    const eventsToProcess = pendingEvents.slice(0, this.MAX_CONCURRENT_EVENTS);
    const processingPromises = eventsToProcess.map((event) => this.processEvent(event));

    try {
      await Promise.allSettled(processingPromises);
    } catch (error) {
      logger.error({
        message: 'Error during batch event processing',
        context: { error },
      });
    } finally {
      this.isProcessing = false;
      store._setProcessing(false);
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: QueuedEvent): Promise<void> {
    const store = useOfflineQueueStore.getState();

    logger.debug({
      message: 'Processing event',
      context: { eventId: event.id, type: event.type },
    });

    store.updateEventStatus(event.id, QueuedEventStatus.PROCESSING);

    try {
      switch (event.type) {
        case QueuedEventType.UNIT_STATUS:
          await this.processUnitStatusEvent(event as QueuedUnitStatusEvent);
          break;
        case QueuedEventType.LOCATION_UPDATE:
          await this.processLocationUpdateEvent(event as QueuedLocationUpdateEvent);
          break;
        case QueuedEventType.CALL_IMAGE_UPLOAD:
          await this.processCallImageUploadEvent(event as QueuedCallImageUploadEvent);
          break;
        case QueuedEventType.CHECK_IN:
          await this.processCheckInEvent(event as QueuedCheckInEvent);
          break;
        case QueuedEventType.ESTABLISH_COMMAND:
          await this.processEstablishCommandEvent(event as QueuedEstablishCommandEvent);
          break;
        case QueuedEventType.CLOSE_COMMAND:
          await this.processCloseCommandEvent(event as QueuedCloseCommandEvent);
          break;
        case QueuedEventType.ASSIGN_INCIDENT_ROLE:
          await this.processAssignIncidentRoleEvent(event as QueuedAssignIncidentRoleEvent);
          break;
        case QueuedEventType.REMOVE_INCIDENT_ROLE:
          await this.processRemoveIncidentRoleEvent(event as QueuedRemoveIncidentRoleEvent);
          break;
        case QueuedEventType.CREATE_ADHOC_UNIT:
          await this.processCreateAdHocUnitEvent(event as QueuedCreateAdHocUnitEvent);
          break;
        case QueuedEventType.RELEASE_ADHOC_UNIT:
          await this.processReleaseAdHocUnitEvent(event as QueuedReleaseAdHocUnitEvent);
          break;
        case QueuedEventType.CREATE_ADHOC_PERSONNEL:
          await this.processCreateAdHocPersonnelEvent(event as QueuedCreateAdHocPersonnelEvent);
          break;
        case QueuedEventType.RELEASE_ADHOC_PERSONNEL:
          await this.processReleaseAdHocPersonnelEvent(event as QueuedReleaseAdHocPersonnelEvent);
          break;
        case QueuedEventType.SAVE_COMMAND_NODE:
          await this.processSaveCommandNodeEvent(event as QueuedSaveCommandNodeEvent);
          break;
        case QueuedEventType.DELETE_COMMAND_NODE:
          await this.processDeleteCommandNodeEvent(event as QueuedDeleteCommandNodeEvent);
          break;
        case QueuedEventType.ASSIGN_COMMAND_RESOURCE:
          await this.processAssignCommandResourceEvent(event as QueuedAssignCommandResourceEvent);
          break;
        case QueuedEventType.MOVE_COMMAND_RESOURCE:
          await this.processMoveCommandResourceEvent(event as QueuedMoveCommandResourceEvent);
          break;
        case QueuedEventType.RELEASE_COMMAND_RESOURCE:
          await this.processReleaseCommandResourceEvent(event as QueuedReleaseCommandResourceEvent);
          break;
        case QueuedEventType.SAVE_OBJECTIVE:
          await this.processSaveObjectiveEvent(event as QueuedSaveObjectiveEvent);
          break;
        case QueuedEventType.COMPLETE_OBJECTIVE:
          await this.processCompleteObjectiveEvent(event as QueuedCompleteObjectiveEvent);
          break;
        case QueuedEventType.UPDATE_OBJECTIVE_PROGRESS:
          await this.processUpdateObjectiveProgressEvent(event as QueuedUpdateObjectiveProgressEvent);
          break;
        case QueuedEventType.SAVE_NEED:
          await this.processSaveNeedEvent(event as QueuedSaveNeedEvent);
          break;
        case QueuedEventType.SET_NEED_STATUS:
          await this.processSetNeedStatusEvent(event as QueuedSetNeedStatusEvent);
          break;
        case QueuedEventType.UPDATE_COMMAND_DETAILS:
          await this.processUpdateCommandDetailsEvent(event as QueuedUpdateCommandDetailsEvent);
          break;
        case QueuedEventType.UPDATE_COMMAND_NODE:
          await this.processUpdateCommandNodeEvent(event as QueuedUpdateCommandNodeEvent);
          break;
        default:
          throw new Error(`Unknown event type: ${event.type}`);
      }

      // Mark as completed and remove from queue
      store.updateEventStatus(event.id, QueuedEventStatus.COMPLETED);

      // Refresh only after COMPLETED so preserveQueuedLocalRows stops carrying the
      // optimistic local- row this event created (avoids a duplicate next to the server row).
      // refreshCommandBoard swallows its own errors, so this can't flip the event to FAILED.
      await this.refreshBoardForCommandEvent(event);

      // Clean up completed events after a delay to avoid immediate removal
      setTimeout(() => {
        store.removeEvent(event.id);
      }, 1000);

      logger.info({
        message: 'Event processed successfully',
        context: { eventId: event.id, type: event.type },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      store.updateEventStatus(event.id, QueuedEventStatus.FAILED, errorMessage);

      logger.error({
        message: 'Failed to process event',
        context: { eventId: event.id, type: event.type, error: errorMessage },
      });
    }
  }

  /**
   * Process unit status event
   */
  private async processUnitStatusEvent(event: QueuedUnitStatusEvent): Promise<void> {
    const input = new SaveUnitStatusInput();
    input.Id = event.data.unitId;
    input.Type = event.data.statusType;
    input.Note = event.data.note || '';
    input.RespondingTo = event.data.respondingTo || '0';
    input.RespondingToType = event.data.respondingToType == null || event.data.respondingToType === '' ? null : Number(event.data.respondingToType);
    input.Timestamp = event.data.timestamp;
    input.TimestampUtc = event.data.timestampUtc;

    // Always set GPS coordinates (even if empty)
    if (event.data.latitude && event.data.longitude) {
      input.Latitude = event.data.latitude;
      input.Longitude = event.data.longitude;
      input.Accuracy = event.data.accuracy || '0';
      input.Altitude = event.data.altitude || '0';
      input.AltitudeAccuracy = event.data.altitudeAccuracy || '0';
      input.Speed = event.data.speed || '0';
      input.Heading = event.data.heading || '0';
    } else {
      // Set empty strings when GPS data is not available
      input.Latitude = '';
      input.Longitude = '';
      input.Accuracy = '';
      input.Altitude = '';
      input.AltitudeAccuracy = '';
      input.Speed = '';
      input.Heading = '';
    }

    if (event.data.roles) {
      input.Roles = event.data.roles.map((role) => {
        const roleInput = new SaveUnitStatusRoleInput();
        roleInput.RoleId = role.roleId;
        roleInput.UserId = role.userId;
        return roleInput;
      });
    }

    await saveUnitStatus(input);
  }

  /**
   * Process location update event
   */
  private async processLocationUpdateEvent(event: QueuedLocationUpdateEvent): Promise<void> {
    const input = new SaveUnitLocationInput();
    input.UnitId = event.data.unitId;
    input.Latitude = event.data.latitude.toString();
    input.Longitude = event.data.longitude.toString();
    input.Accuracy = event.data.accuracy?.toString() || '';
    input.Heading = event.data.heading?.toString() || '';
    input.Speed = event.data.speed?.toString() || '';
    input.Timestamp = event.data.timestamp;

    await setUnitLocation(input);
  }

  /**
   * Process call image upload event
   */
  private async processCallImageUploadEvent(event: QueuedCallImageUploadEvent): Promise<void> {
    await saveCallImage(event.data.callId, event.data.userId, event.data.note, event.data.name, event.data.latitude ?? null, event.data.longitude ?? null, event.data.filePath);
  }

  /**
   * Initialize app state listener to start/stop processing
   */
  private initializeAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    logger.info({
      message: 'Offline event manager handling app state change',
      context: { nextAppState },
    });

    if (nextAppState === 'active') {
      this.startProcessing();
    } else if (nextAppState === 'background') {
      // Keep processing in background for a short time
      setTimeout(() => {
        if (AppState.currentState === 'background') {
          this.stopProcessing();
        }
      }, 30000); // 30 seconds
    } else if (nextAppState === 'inactive') {
      this.stopProcessing();
    }
  };

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopProcessing();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.reconnectUnsubscribe) {
      this.reconnectUnsubscribe();
      this.reconnectUnsubscribe = null;
    }

    logger.info({
      message: 'Offline event manager cleaned up',
    });
  }

  /**
   * Get processing statistics
   */
  public getStats(): {
    isProcessing: boolean;
    totalEvents: number;
    pendingEvents: number;
    failedEvents: number;
    completedEvents: number;
  } {
    const store = useOfflineQueueStore.getState();

    return {
      isProcessing: this.isProcessing,
      totalEvents: store.totalEvents,
      pendingEvents: store.getPendingEvents().length,
      failedEvents: store.getFailedEvents().length,
      completedEvents: store.completedEvents,
    };
  }

  /**
   * Retry all failed events
   */
  public retryFailedEvents(): void {
    useOfflineQueueStore.getState().retryAllFailedEvents();

    // Trigger processing immediately
    this.processQueuedEvents();
  }

  /**
   * Clear completed events
   */
  public clearCompletedEvents(): void {
    useOfflineQueueStore.getState().clearCompletedEvents();
  }
}

// Export singleton instance
export const offlineEventManager = OfflineEventManager.getInstance();
