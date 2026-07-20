import type { IncidentCommandActionResult, IncidentVoiceChannelResult, IncidentVoiceChannelsResult, VoiceTransmissionLogResult, VoiceTransmissionLogsResult } from '@/models/v4/incidentCommand/incidentCommandModels';

import { createApiEndpoint } from '../common/client';

export interface CreateIncidentChannelInput {
  CallId: number;
  Name: string;
}

export interface LogTransmissionInput {
  CallId: number;
  DepartmentVoiceChannelId: string;
  StartedOn: string;
  EndedOn?: string;
}

export const createIncidentChannel = async (input: CreateIncidentChannelInput) => {
  const response = await createApiEndpoint('/IncidentVoice/CreateIncidentChannel').post<IncidentVoiceChannelResult>({ ...input });
  return response.data;
};

export const getChannelsForCall = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentVoice/GetChannelsForCall/${encodeURIComponent(String(callId))}`).get<IncidentVoiceChannelsResult>();
  return response.data;
};

export const closeIncidentChannels = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentVoice/CloseIncidentChannels/${encodeURIComponent(String(callId))}`).post<IncidentCommandActionResult>({});
  return response.data;
};

export const logTransmission = async (input: LogTransmissionInput) => {
  const response = await createApiEndpoint('/IncidentVoice/LogTransmission').post<VoiceTransmissionLogResult>({ ...input });
  return response.data;
};

export const getTransmissionLog = async (callId: string | number) => {
  const response = await createApiEndpoint(`/IncidentVoice/GetTransmissionLog/${encodeURIComponent(String(callId))}`).get<VoiceTransmissionLogsResult>();
  return response.data;
};
