import type {
  CommandAccountabilityResult,
  CommandNodeResult,
  CommandStructureNode,
  CommandTimelineResult,
  CommandTransferResult,
  EstablishCommandInput,
  EvaluateAccountabilityResult,
  IncidentCommandActionResult,
  IncidentCommandBoardResult,
  IncidentCommandResult,
  IncidentMapAnnotation,
  IncidentMapAnnotationResult,
  IncidentTimer,
  IncidentTimerResult,
  MoveResourceInput,
  ResourceAssignment,
  ResourceAssignmentResult,
  TacticalObjective,
  TacticalObjectiveResult,
  TransferCommandInput,
  UpdateActionPlanInput,
} from '@/models/v4/incidentCommand/incidentCommandModels';

import { createApiEndpoint } from '../common/client';

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

export const completeObjective = async (tacticalObjectiveId: string) => {
  const response = await createApiEndpoint(`/IncidentCommand/CompleteObjective/${encodeURIComponent(tacticalObjectiveId)}`).post<TacticalObjectiveResult>({});
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
