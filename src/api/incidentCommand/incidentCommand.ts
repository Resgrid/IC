import type {
  AddIncidentNoteInput,
  CommandAccountabilityResult,
  CommandNodeResult,
  CommandStructureNode,
  CommandTimelineResult,
  CommandTransferResult,
  EstablishCommandInput,
  EvaluateAccountabilityResult,
  IncidentAttachmentResult,
  IncidentAttachmentsResult,
  IncidentCommandActionResult,
  IncidentCommandBoardResult,
  IncidentCommandResult,
  IncidentCommandSummariesResult,
  IncidentMap,
  IncidentMapAnnotation,
  IncidentMapAnnotationResult,
  IncidentMapResult,
  IncidentMapsResult,
  IncidentNeed,
  IncidentNeedEntitiesResult,
  IncidentNeedResult,
  IncidentNeedsResult,
  IncidentNeedUpdatesResult,
  IncidentNoteResult,
  IncidentNotesResult,
  IncidentTimer,
  IncidentTimerResult,
  MoveResourceInput,
  ReopenCommandInput,
  ResourceAssignment,
  ResourceAssignmentResult,
  SetNeedStatusInput,
  TacticalObjective,
  TacticalObjectiveResult,
  TransferCommandInput,
  UpdateActionPlanInput,
  UpdateCommandDetailsInput,
  UpdateCommandInfoInput,
  UpdateObjectiveProgressInput,
} from '@/models/v4/incidentCommand/incidentCommandModels';

import { api, createApiEndpoint } from '../common/client';

// Core routes use path parameters (e.g. GetCommandBoard/{callId}), so endpoints
// with a path parameter are created per call.

export const establishCommand = async (input: EstablishCommandInput) => {
  const response = await createApiEndpoint('/IncidentCommand/EstablishCommand').post<IncidentCommandResult>({ ...input });
  return response.data;
};

export const getCommandBoard = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetCommandBoard/${encodeURIComponent(String(callId))}`).get<IncidentCommandBoardResult>();
  return response.data;
};

export const transferCommand = async (input: TransferCommandInput) => {
  const response = await createApiEndpoint('/IncidentCommand/TransferCommand').post<CommandTransferResult>({ ...input });
  return response.data;
};

export const closeCommand = async (incidentCommandId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/CloseCommand/${encodeURIComponent(incidentCommandId)}`).put<IncidentCommandResult>({});
  return response.data;
};

/** Most recent command for a call across ALL statuses — lets the app detect a prior ended command and offer reopen. */
export const getCommandForCall = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetCommandForCall/${encodeURIComponent(String(callId))}`).get<IncidentCommandResult>();
  return response.data;
};

export const reopenCommand = async (input: ReopenCommandInput) => {
  const response = await createApiEndpoint('/IncidentCommand/ReopenCommand').put<IncidentCommandResult>({ ...input });
  return response.data;
};

/** List-card summaries for the department's commands; includeClosed adds ended incidents. */
export const getCommandList = async (includeClosed: boolean) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetCommandList?includeClosed=${includeClosed ? 'true' : 'false'}`).get<IncidentCommandSummariesResult>();
  return response.data;
};

/** Board snapshot for one SPECIFIC command instance — including a closed one (read-only history view). */
export const getCommandBoardById = async (incidentCommandId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetCommandBoardById/${encodeURIComponent(incidentCommandId)}`).get<IncidentCommandBoardResult>();
  return response.data;
};

export const updateCommandInfo = async (input: UpdateCommandInfoInput) => {
  const response = await createApiEndpoint('/IncidentCommand/UpdateCommandInfo').put<IncidentCommandResult>({ ...input });
  return response.data;
};

export const addIncidentNote = async (input: AddIncidentNoteInput) => {
  const response = await createApiEndpoint('/IncidentCommand/AddNote').post<IncidentNoteResult>({ ...input });
  return response.data;
};

export const getIncidentNotes = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetNotes/${encodeURIComponent(String(callId))}`).get<IncidentNotesResult>();
  return response.data;
};

export const removeIncidentNote = async (incidentNoteId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/RemoveNote/${encodeURIComponent(incidentNoteId)}`).delete<IncidentCommandActionResult>();
  return response.data;
};

export const getIncidentAttachments = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetAttachments/${encodeURIComponent(String(callId))}`).get<IncidentAttachmentsResult>();
  return response.data;
};

/** Uploads an incident file (multipart) — reports, images, documents attached at the incident level. */
export const addIncidentAttachment = async (incidentCommandId: string, visibility: number, description: string | null, file: { uri: string; name: string; type: string }) => {
  const formData = new FormData();
  formData.append('IncidentCommandId', incidentCommandId);
  formData.append('Visibility', String(visibility));
  if (description) {
    formData.append('Description', description);
  }
  formData.append('File', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  // The shared endpoint helper pins JSON; multipart needs its own content type, so use the raw client.
  const response = await api.post<IncidentAttachmentResult>('/IncidentCommand/AddAttachment', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return response.data;
};

export const removeIncidentAttachment = async (incidentAttachmentId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/RemoveAttachment/${encodeURIComponent(incidentAttachmentId)}`).delete<IncidentCommandActionResult>();
  return response.data;
};

/** Downloads an incident file's bytes as a Blob (auth handled by the shared client). */
export const downloadIncidentAttachment = async (incidentAttachmentId: string) => {
  const response = await api.get<Blob>(`/IncidentCommand/DownloadAttachment/${encodeURIComponent(incidentAttachmentId)}`, { responseType: 'blob' });
  return response.data;
};

/** Named incident maps (additional tactical maps beyond the incident's main map). */
export const saveIncidentMap = async (map: Partial<IncidentMap>) => {
  const response = await createApiEndpoint('/IncidentCommand/SaveIncidentMap').post<IncidentMapResult>({ ...map });
  return response.data;
};

export const deleteIncidentMap = async (incidentMapId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/DeleteIncidentMap/${encodeURIComponent(incidentMapId)}`).delete<IncidentCommandActionResult>();
  return response.data;
};

export const getIncidentMaps = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetIncidentMaps/${encodeURIComponent(String(callId))}`).get<IncidentMapsResult>();
  return response.data;
};

export const updateActionPlan = async (input: UpdateActionPlanInput) => {
  const response = await createApiEndpoint('/IncidentCommand/UpdateActionPlan').put<IncidentCommandResult>({ ...input });
  return response.data;
};

export const getAccountability = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetAccountability/${encodeURIComponent(String(callId))}`).get<CommandAccountabilityResult>();
  return response.data;
};

export const evaluateAccountability = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/EvaluateAccountability/${encodeURIComponent(String(callId))}`).post<EvaluateAccountabilityResult>({});
  return response.data;
};

export const saveCommandNode = async (node: Partial<CommandStructureNode>) => {
  const response = await createApiEndpoint('/IncidentCommand/SaveNode').post<CommandNodeResult>({ ...node });
  return response.data;
};

export const deleteCommandNode = async (commandStructureNodeId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/DeleteNode/${encodeURIComponent(commandStructureNodeId)}`).delete<IncidentCommandActionResult>();
  return response.data;
};

export const assignResource = async (assignment: Partial<ResourceAssignment>) => {
  const response = await createApiEndpoint('/IncidentCommand/AssignResource').post<ResourceAssignmentResult>({ ...assignment });
  return response.data;
};

export const moveResource = async (input: MoveResourceInput) => {
  const response = await createApiEndpoint('/IncidentCommand/MoveResource').post<ResourceAssignmentResult>({ ...input });
  return response.data;
};

export const releaseResource = async (resourceAssignmentId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/ReleaseResource/${encodeURIComponent(resourceAssignmentId)}`).post<IncidentCommandActionResult>({});
  return response.data;
};

export const saveObjective = async (objective: Partial<TacticalObjective>) => {
  const response = await createApiEndpoint('/IncidentCommand/SaveObjective').post<TacticalObjectiveResult>({ ...objective });
  return response.data;
};

/** Completes (closes out) an objective, recording how it turned out and an optional close-out note. */
export const completeObjective = async (tacticalObjectiveId: string, outcome?: number, note?: string | null) => {
  const response = await createApiEndpoint(`/IncidentCommand/CompleteObjective/${encodeURIComponent(tacticalObjectiveId)}`).post<TacticalObjectiveResult>({ Outcome: outcome ?? 0, Note: note ?? null });
  return response.data;
};

export const updateObjectiveProgress = async (input: UpdateObjectiveProgressInput) => {
  const response = await createApiEndpoint('/IncidentCommand/UpdateObjectiveProgress').post<TacticalObjectiveResult>({ ...input });
  return response.data;
};

export const saveNeed = async (need: Partial<IncidentNeed>) => {
  const response = await createApiEndpoint('/IncidentCommand/SaveNeed').post<IncidentNeedResult>({ ...need });
  return response.data;
};

export const setNeedStatus = async (input: SetNeedStatusInput) => {
  const response = await createApiEndpoint('/IncidentCommand/SetNeedStatus').post<IncidentNeedResult>({ ...input });
  return response.data;
};

export const getNeeds = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetNeeds/${encodeURIComponent(String(callId))}`).get<IncidentNeedsResult>();
  return response.data;
};

/** Creates an Entity need: the listed units/users/roles/groups are dispatched individually by command. */
export const requestNeedEntities = async (incidentCommandId: string, name: string, description: string | null, entities: { EntityKind: number; EntityId: string }[]) => {
  const response = await createApiEndpoint('/IncidentCommand/RequestNeedEntities').post<IncidentNeedResult>({
    IncidentCommandId: incidentCommandId,
    Name: name,
    Description: description,
    Entities: entities,
  });
  return response.data;
};

/** The requested entities under one Entity-category need. */
export const getNeedEntities = async (incidentNeedId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetNeedEntities/${encodeURIComponent(incidentNeedId)}`).get<IncidentNeedEntitiesResult>();
  return response.data;
};

/** Audit trail for one need: every fulfillment change with note, author, and timestamp (newest first). */
export const getNeedUpdates = async (incidentNeedId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetNeedUpdates/${encodeURIComponent(incidentNeedId)}`).get<IncidentNeedUpdatesResult>();
  return response.data;
};

export const updateCommandDetails = async (input: UpdateCommandDetailsInput) => {
  const response = await createApiEndpoint('/IncidentCommand/UpdateCommandDetails').put<IncidentCommandResult>({ ...input });
  return response.data;
};

export const startIncidentTimer = async (timer: Partial<IncidentTimer>) => {
  const response = await createApiEndpoint('/IncidentCommand/StartTimer').post<IncidentTimerResult>({ ...timer });
  return response.data;
};

export const acknowledgeIncidentTimer = async (incidentTimerId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/AcknowledgeTimer/${encodeURIComponent(incidentTimerId)}`).post<IncidentTimerResult>({});
  return response.data;
};

/** Creates/updates the incident map's saved view (center + zoom) so it opens consistently for everyone. */
export const updateMapView = async (incidentCommandId: string, centerLatitude: string, centerLongitude: string, zoomLevel: string) => {
  const response = await createApiEndpoint('/IncidentCommand/UpdateMapView').put<IncidentCommandResult>({
    IncidentCommandId: incidentCommandId,
    CenterLatitude: centerLatitude,
    CenterLongitude: centerLongitude,
    ZoomLevel: zoomLevel,
  });
  return response.data;
};

export const saveMapAnnotation = async (annotation: Partial<IncidentMapAnnotation>) => {
  const response = await createApiEndpoint('/IncidentCommand/SaveAnnotation').post<IncidentMapAnnotationResult>({ ...annotation });
  return response.data;
};

export const deleteMapAnnotation = async (incidentMapAnnotationId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/DeleteAnnotation/${encodeURIComponent(incidentMapAnnotationId)}`).delete<IncidentCommandActionResult>();
  return response.data;
};

export const getCommandTimeline = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentCommand/GetTimeline/${encodeURIComponent(String(callId))}`).get<CommandTimelineResult>();
  return response.data;
};
