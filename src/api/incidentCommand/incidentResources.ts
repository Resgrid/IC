import type {
  AdHocPersonnelListResult,
  AdHocPersonnelResult,
  AdHocUnitResult,
  AdHocUnitsResult,
  IncidentAdHocPersonnel,
  IncidentAdHocUnit,
  IncidentCommandActionResult,
} from '@/models/v4/incidentCommand/incidentCommandModels';

import { createApiEndpoint } from '../common/client';

export interface AssignPersonnelToUnitInput {
  IncidentAdHocPersonnelId: string;
  RidingResourceKind: number;
  RidingResourceId: string;
}

export interface FormUnitInput {
  CallId: number;
  Name: string;
  Type?: string;
  UnitTypeId?: number | null;
  ExternalAgencyName?: string;
  AdHocPersonnelIds: string[];
}

export const createAdHocUnit = async (unit: Partial<IncidentAdHocUnit>) => {
  const response = await createApiEndpoint('/IncidentResources/CreateAdHocUnit').post<AdHocUnitResult>({ ...unit });
  return response.data;
};

export const getAdHocUnits = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentResources/GetAdHocUnits/${encodeURIComponent(String(callId))}`).get<AdHocUnitsResult>();
  return response.data;
};

export const releaseAdHocUnit = async (incidentAdHocUnitId: string) => {
  const response = await createApiEndpoint(`/IncidentResources/ReleaseAdHocUnit/${encodeURIComponent(incidentAdHocUnitId)}`).post<IncidentCommandActionResult>({});
  return response.data;
};

export const createAdHocPersonnel = async (personnel: Partial<IncidentAdHocPersonnel>) => {
  const response = await createApiEndpoint('/IncidentResources/CreateAdHocPersonnel').post<AdHocPersonnelResult>({ ...personnel });
  return response.data;
};

export const getAdHocPersonnel = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentResources/GetAdHocPersonnel/${encodeURIComponent(String(callId))}`).get<AdHocPersonnelListResult>();
  return response.data;
};

export const releaseAdHocPersonnel = async (incidentAdHocPersonnelId: string) => {
  const response = await createApiEndpoint(`/IncidentResources/ReleaseAdHocPersonnel/${encodeURIComponent(incidentAdHocPersonnelId)}`).post<IncidentCommandActionResult>({});
  return response.data;
};

export const assignPersonnelToUnit = async (input: AssignPersonnelToUnitInput) => {
  const response = await createApiEndpoint('/IncidentResources/AssignPersonnelToUnit').post<AdHocPersonnelResult>({ ...input });
  return response.data;
};

export const formUnit = async (input: FormUnitInput) => {
  const response = await createApiEndpoint('/IncidentResources/FormUnit').post<AdHocUnitResult>({ ...input });
  return response.data;
};
