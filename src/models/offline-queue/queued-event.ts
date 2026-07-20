export enum QueuedEventType {
  UNIT_STATUS = 'unit_status',
  LOCATION_UPDATE = 'location_update',
  CALL_IMAGE_UPLOAD = 'call_image_upload',
  CHECK_IN = 'check_in',
  // Incident command (ICS) events — replayed against the Core IncidentCommand APIs
  ESTABLISH_COMMAND = 'establish_command',
  CLOSE_COMMAND = 'close_command',
  ASSIGN_INCIDENT_ROLE = 'assign_incident_role',
  REMOVE_INCIDENT_ROLE = 'remove_incident_role',
  CREATE_ADHOC_UNIT = 'create_adhoc_unit',
  RELEASE_ADHOC_UNIT = 'release_adhoc_unit',
  CREATE_ADHOC_PERSONNEL = 'create_adhoc_personnel',
  RELEASE_ADHOC_PERSONNEL = 'release_adhoc_personnel',
  SAVE_COMMAND_NODE = 'save_command_node',
  DELETE_COMMAND_NODE = 'delete_command_node',
  ASSIGN_COMMAND_RESOURCE = 'assign_command_resource',
  MOVE_COMMAND_RESOURCE = 'move_command_resource',
  RELEASE_COMMAND_RESOURCE = 'release_command_resource',
  SAVE_OBJECTIVE = 'save_objective',
  COMPLETE_OBJECTIVE = 'complete_objective',
}

export enum QueuedEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  FAILED = 'failed',
  COMPLETED = 'completed',
}

export interface QueuedEvent {
  id: string;
  type: QueuedEventType;
  status: QueuedEventStatus;
  data: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  error?: string;
}

export interface QueuedUnitStatusEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.UNIT_STATUS;
  data: {
    unitId: string;
    statusType: string;
    note?: string;
    respondingTo?: string;
    respondingToType?: number | string | null;
    timestamp: string;
    timestampUtc: string;
    roles?: {
      roleId: string;
      userId: string;
    }[];
    latitude?: string;
    longitude?: string;
    accuracy?: string;
    altitude?: string;
    altitudeAccuracy?: string;
    speed?: string;
    heading?: string;
  };
}

export interface QueuedLocationUpdateEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.LOCATION_UPDATE;
  data: {
    unitId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    timestamp: string;
  };
}

export interface QueuedCallImageUploadEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.CALL_IMAGE_UPLOAD;
  data: {
    callId: string;
    userId: string;
    note: string;
    name: string;
    latitude?: number;
    longitude?: number;
    filePath: string;
  };
}

export interface QueuedCheckInEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.CHECK_IN;
  data: {
    callId: number;
    checkInType: number;
    unitId?: number;
    latitude?: string;
    longitude?: string;
    note?: string;
    timestamp: string;
  };
}

export interface QueuedEstablishCommandEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.ESTABLISH_COMMAND;
  data: { callId: string; commandDefinitionId?: number | null };
}

export interface QueuedCloseCommandEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.CLOSE_COMMAND;
  data: { callId: string; incidentCommandId: string };
}

export interface QueuedAssignIncidentRoleEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.ASSIGN_INCIDENT_ROLE;
  data: { callId: string; roleType: number; userId: string };
}

export interface QueuedRemoveIncidentRoleEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.REMOVE_INCIDENT_ROLE;
  data: { callId: string; incidentRoleAssignmentId: string };
}

export interface QueuedCreateAdHocUnitEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.CREATE_ADHOC_UNIT;
  data: { callId: string; name: string; type?: string };
}

export interface QueuedReleaseAdHocUnitEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.RELEASE_ADHOC_UNIT;
  data: { callId: string; incidentAdHocUnitId: string };
}

export interface QueuedCreateAdHocPersonnelEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.CREATE_ADHOC_PERSONNEL;
  data: { callId: string; name: string; role?: string; agency?: string };
}

export interface QueuedReleaseAdHocPersonnelEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.RELEASE_ADHOC_PERSONNEL;
  data: { callId: string; incidentAdHocPersonnelId: string };
}

export interface QueuedSaveCommandNodeEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.SAVE_COMMAND_NODE;
  data: {
    callId: string;
    name: string;
    nodeType: number;
    color?: string;
    limits?: { minUnits?: number; maxUnits?: number; minUnitPersonnel?: number; maxUnitPersonnel?: number; minTimeInRole?: number; maxTimeInRole?: number };
  };
}

export interface QueuedDeleteCommandNodeEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.DELETE_COMMAND_NODE;
  data: { callId: string; commandStructureNodeId: string };
}

export interface QueuedAssignCommandResourceEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.ASSIGN_COMMAND_RESOURCE;
  data: { callId: string; commandStructureNodeId: string; resourceKind: number; resourceId: string };
}

export interface QueuedMoveCommandResourceEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.MOVE_COMMAND_RESOURCE;
  data: { callId: string; resourceAssignmentId: string; targetNodeId: string };
}

export interface QueuedReleaseCommandResourceEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.RELEASE_COMMAND_RESOURCE;
  data: { callId: string; resourceAssignmentId: string };
}

export interface QueuedSaveObjectiveEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.SAVE_OBJECTIVE;
  data: { callId: string; name: string; objectiveType: number };
}

export interface QueuedCompleteObjectiveEvent extends Omit<QueuedEvent, 'data'> {
  type: QueuedEventType.COMPLETE_OBJECTIVE;
  data: { callId: string; tacticalObjectiveId: string };
}
