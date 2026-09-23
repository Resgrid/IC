import { api } from '@/api/common/client';
import type { ReadinessPacket } from '@/lib/checklists/readiness';

interface ChecklistApiResult<T> {
  Data: T;
}

// The call's readiness evidence (Readiness Pro reporting): the units dispatched on the call with their
// checklist results and work orders over the lookback window before the call was logged. Read-only.
export const getReadinessPacket = async (callId: number, lookbackDays = 30) => (await api.get<ChecklistApiResult<ReadinessPacket>>('/ChecklistRuns/GetReadinessPacket', { params: { callId, lookbackDays } })).data.Data;
