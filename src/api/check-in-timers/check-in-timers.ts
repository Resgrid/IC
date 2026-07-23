import { logger } from '@/lib/logging';
import { type CallPersonnelCheckInStatusResult } from '@/models/v4/checkIn/callPersonnelCheckInStatusResult';
import { type CheckInRecordResult } from '@/models/v4/checkIn/checkInRecordResult';
import { type CheckInTimerStatusResult } from '@/models/v4/checkIn/checkInTimerStatusResult';
import { type PerformCheckInResult } from '@/models/v4/checkIn/performCheckInResult';
import { type ResolvedCheckInTimerResult } from '@/models/v4/checkIn/resolvedCheckInTimerResult';

import { createApiEndpoint } from '../common/client';

const getTimerStatusesApi = createApiEndpoint('/CheckInTimers/GetTimerStatuses');
const getTimersForCallApi = createApiEndpoint('/CheckInTimers/GetTimersForCall');
const performCheckInApi = createApiEndpoint('/CheckInTimers/PerformCheckIn');
const getCheckInHistoryApi = createApiEndpoint('/CheckInTimers/GetCheckInHistory');
const CALL_PERSONNEL_CHECK_IN_STATUSES_ENDPOINT = '/CheckInTimers/GetCallPersonnelCheckInStatuses';
const CALL_PERSONNEL_CHECK_IN_STATUSES_ENDPOINT_NAME = 'GetCallPersonnelCheckInStatuses';
const getCallPersonnelCheckInStatusesApi = createApiEndpoint(CALL_PERSONNEL_CHECK_IN_STATUSES_ENDPOINT);

export interface PerformCheckInInput {
  CallId: number;
  CheckInType: number;
  UserId?: string;
  UnitId?: number;
  Latitude?: string;
  Longitude?: string;
  Note?: string;
}

export const getTimerStatuses = async (callId: number) => {
  const response = await getTimerStatusesApi.get<CheckInTimerStatusResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export const getTimersForCall = async (callId: number) => {
  const response = await getTimersForCallApi.get<ResolvedCheckInTimerResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export const performCheckIn = async (input: PerformCheckInInput) => {
  const response = await performCheckInApi.post<PerformCheckInResult>({
    CallId: input.CallId,
    CheckInType: input.CheckInType,
    UserId: input.UserId,
    UnitId: input.UnitId,
    Latitude: input.Latitude,
    Longitude: input.Longitude,
    Note: input.Note,
  });
  return response.data;
};

export const getCheckInHistory = async (callId: number) => {
  const response = await getCheckInHistoryApi.get<CheckInRecordResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export class CallPersonnelCheckInStatusesFetchError extends Error {
  public readonly code = 'CALL_PERSONNEL_CHECK_IN_STATUSES_FETCH_FAILED';

  constructor(
    public readonly callId: number,
    public readonly endpointName: string,
    cause: unknown
  ) {
    super('Unable to load personnel check-in statuses', { cause });
    this.name = 'CallPersonnelCheckInStatusesFetchError';
  }
}

export const getCallPersonnelCheckInStatuses = async (callId: number) => {
  try {
    const response = await getCallPersonnelCheckInStatusesApi.get<CallPersonnelCheckInStatusResult>({
      callId: encodeURIComponent(callId),
    });
    return response.data;
  } catch (error) {
    logger.error({
      message: 'Failed to fetch call personnel check-in statuses',
      context: {
        callId,
        endpointName: CALL_PERSONNEL_CHECK_IN_STATUSES_ENDPOINT_NAME,
        endpoint: CALL_PERSONNEL_CHECK_IN_STATUSES_ENDPOINT,
        error,
      },
    });
    throw new CallPersonnelCheckInStatusesFetchError(callId, CALL_PERSONNEL_CHECK_IN_STATUSES_ENDPOINT_NAME, error);
  }
};

export const toggleCallTimers = async (callId: number, enabled: boolean) => {
  const endpoint = createApiEndpoint(`/CheckInTimers/ToggleCallTimers?callId=${encodeURIComponent(callId)}&enabled=${encodeURIComponent(enabled)}`);
  const response = await endpoint.put<PerformCheckInResult>({});
  return response.data;
};
