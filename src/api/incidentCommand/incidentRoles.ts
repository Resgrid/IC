import type { IncidentCapabilitiesResult, IncidentCommandActionResult, IncidentRoleAssignment, IncidentRoleResult, IncidentRolesResult } from '@/models/v4/incidentCommand/incidentCommandModels';

import { createApiEndpoint } from '../common/client';

export const assignIncidentRole = async (assignment: Partial<IncidentRoleAssignment>) => {
  const response = await createApiEndpoint('/IncidentRoles/AssignRole').post<IncidentRoleResult>({ ...assignment });
  return response.data;
};

export const removeIncidentRole = async (incidentRoleAssignmentId: string) => {
  const response = await createApiEndpoint(`/IncidentRoles/RemoveRole/${encodeURIComponent(incidentRoleAssignmentId)}`).post<IncidentCommandActionResult>({});
  return response.data;
};

export const getIncidentRoles = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentRoles/GetRoles/${encodeURIComponent(String(callId))}`).get<IncidentRolesResult>();
  return response.data;
};

export const getMyIncidentCapabilities = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentRoles/GetMyCapabilities/${encodeURIComponent(String(callId))}`).get<IncidentCapabilitiesResult>();
  return response.data;
};
