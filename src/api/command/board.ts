// API wrappers for the v4 IncidentCommand controller (the live command board).
// Mirrors Web/Resgrid.Web.Services/Controllers/v4/IncidentCommandController.cs.
// NOTE: these endpoints use ROUTE params (e.g. GetCommandBoard/{callId}), so the id is
// interpolated into the endpoint path rather than passed as a query param.

import { type CommandStructureNode } from '@/models/v4/incidentCommand/commandStructureNode';
import {
  type CommandAccountabilityResult,
  type CommandNodeResult,
  type CommandTimelineResult,
  type CommandTransferResult,
  type EvaluateAccountabilityResult,
  type IncidentCommandActionResult,
  type IncidentCommandBoardResult,
  type IncidentCommandResult,
  type IncidentMapAnnotationResult,
  type IncidentTimerResult,
  type ResourceAssignmentResult,
  type TacticalObjectiveResult,
} from '@/models/v4/incidentCommand/incidentCommandResults';
import { type IncidentMapAnnotation } from '@/models/v4/incidentCommand/incidentMapAnnotation';
import { type IncidentTimer } from '@/models/v4/incidentCommand/incidentTimer';
import { type ResourceAssignment } from '@/models/v4/incidentCommand/resourceAssignment';
import { type TacticalObjective } from '@/models/v4/incidentCommand/tacticalObjective';

import { createApiEndpoint } from '../common/client';

const BASE = '/IncidentCommand';

/** Coerce a typed entity into the loosely-typed body shape the api helper expects. */
const asBody = (entity: object): Record<string, unknown> => entity as unknown as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One-shot snapshot of the live command board for a call (lanes, assignments, objectives, timers, accountability, roles). */
export const getCommandBoard = async (callId: number) => {
  const response = await createApiEndpoint(`${BASE}/GetCommandBoard/${callId}`).get<IncidentCommandBoardResult>();
  return response.data;
};

/** Personnel accountability / PAR list for a call. */
export const getAccountability = async (callId: number) => {
  const response = await createApiEndpoint(`${BASE}/GetAccountability/${callId}`).get<CommandAccountabilityResult>();
  return response.data;
};

/** Append-only ICS-201 timeline for a call. */
export const getTimeline = async (callId: number) => {
  const response = await createApiEndpoint(`${BASE}/GetTimeline/${callId}`).get<CommandTimelineResult>();
  return response.data;
};

// ---------------------------------------------------------------------------
// Command lifecycle
// ---------------------------------------------------------------------------

/** Establish command on a call, optionally seeding lanes from a CommandDefinition template. */
export const establishCommand = async (callId: number, commandDefinitionId?: number | null) => {
  const response = await createApiEndpoint(`${BASE}/EstablishCommand`).post<IncidentCommandResult>({
    CallId: callId,
    CommandDefinitionId: commandDefinitionId ?? null,
  });
  return response.data;
};

/** Transfer Incident Commander to another user. */
export const transferCommand = async (input: { incidentCommandId: string; toUserId: string; notes?: string }) => {
  const response = await createApiEndpoint(`${BASE}/TransferCommand`).post<CommandTransferResult>({
    IncidentCommandId: input.incidentCommandId,
    ToUserId: input.toUserId,
    Notes: input.notes ?? '',
  });
  return response.data;
};

/** Close the command instance for a call (auto-closes incident channels server-side). */
export const closeCommand = async (incidentCommandId: string) => {
  const response = await createApiEndpoint(`${BASE}/CloseCommand/${incidentCommandId}`).put<IncidentCommandResult>({});
  return response.data;
};

/** Update the incident action plan. */
export const updateActionPlan = async (input: { incidentCommandId: string; actionPlan: string }) => {
  const response = await createApiEndpoint(`${BASE}/UpdateActionPlan`).put<IncidentCommandResult>({
    IncidentCommandId: input.incidentCommandId,
    ActionPlan: input.actionPlan,
  });
  return response.data;
};

/** Run an on-demand accountability sweep; returns userIds newly flagged Critical (PAR overdue). */
export const evaluateAccountability = async (callId: number) => {
  const response = await createApiEndpoint(`${BASE}/EvaluateAccountability/${callId}`).post<EvaluateAccountabilityResult>({});
  return response.data;
};

// ---------------------------------------------------------------------------
// Structure (lanes / span-of-control)
// ---------------------------------------------------------------------------

/** Create or update a command structure node (lane). */
export const saveNode = async (node: CommandStructureNode) => {
  const response = await createApiEndpoint(`${BASE}/SaveNode`).post<CommandNodeResult>(asBody(node));
  return response.data;
};

/** Soft-delete a command structure node (lane). */
export const deleteNode = async (commandStructureNodeId: string) => {
  const response = await createApiEndpoint(`${BASE}/DeleteNode/${commandStructureNodeId}`).delete<IncidentCommandActionResult>();
  return response.data;
};

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/** Assign a resource (unit/personnel/ad-hoc) to a structure node. */
export const assignResource = async (assignment: ResourceAssignment) => {
  const response = await createApiEndpoint(`${BASE}/AssignResource`).post<ResourceAssignmentResult>(asBody(assignment));
  return response.data;
};

/** Move a resource assignment to a different node. */
export const moveResource = async (input: { resourceAssignmentId: string; targetNodeId: string }) => {
  const response = await createApiEndpoint(`${BASE}/MoveResource`).post<ResourceAssignmentResult>({
    ResourceAssignmentId: input.resourceAssignmentId,
    TargetNodeId: input.targetNodeId,
  });
  return response.data;
};

/** Release a resource assignment from the board. */
export const releaseResource = async (resourceAssignmentId: string) => {
  const response = await createApiEndpoint(`${BASE}/ReleaseResource/${resourceAssignmentId}`).post<IncidentCommandActionResult>({});
  return response.data;
};

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

/** Create or update a tactical objective / benchmark. */
export const saveObjective = async (objective: TacticalObjective) => {
  const response = await createApiEndpoint(`${BASE}/SaveObjective`).post<TacticalObjectiveResult>(asBody(objective));
  return response.data;
};

/** Mark a tactical objective complete. */
export const completeObjective = async (tacticalObjectiveId: string) => {
  const response = await createApiEndpoint(`${BASE}/CompleteObjective/${tacticalObjectiveId}`).post<TacticalObjectiveResult>({});
  return response.data;
};

// ---------------------------------------------------------------------------
// Timers
// ---------------------------------------------------------------------------

/** Start a scene / benchmark / role timer. */
export const startTimer = async (timer: IncidentTimer) => {
  const response = await createApiEndpoint(`${BASE}/StartTimer`).post<IncidentTimerResult>(asBody(timer));
  return response.data;
};

/** Acknowledge a due timer. */
export const acknowledgeTimer = async (incidentTimerId: string) => {
  const response = await createApiEndpoint(`${BASE}/AcknowledgeTimer/${incidentTimerId}`).post<IncidentTimerResult>({});
  return response.data;
};

// ---------------------------------------------------------------------------
// Map annotations
// ---------------------------------------------------------------------------

/** Create or update a tactical-map annotation. */
export const saveAnnotation = async (annotation: IncidentMapAnnotation) => {
  const response = await createApiEndpoint(`${BASE}/SaveAnnotation`).post<IncidentMapAnnotationResult>(asBody(annotation));
  return response.data;
};

/** Soft-delete a tactical-map annotation. */
export const deleteAnnotation = async (incidentMapAnnotationId: string) => {
  const response = await createApiEndpoint(`${BASE}/DeleteAnnotation/${incidentMapAnnotationId}`).delete<IncidentCommandActionResult>();
  return response.data;
};
