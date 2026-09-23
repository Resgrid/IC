import { useMemo } from 'react';

import { IncidentRoleType } from '@/models/v4/incidentCommand/incidentCommandModels';
import { type FieldRecordContextInput } from '@/models/v4/records';
import useAuthStore from '@/stores/auth/store';
import { useCommandStore } from '@/stores/command/store';

/**
 * The field context this app authors in (RMS plan RMS-1D). IC authors against the exact incident the
 * command board is showing and the role this member actually holds on it. The role name is only a
 * hint: the server re-checks it against the Call's active command and refuses the context otherwise,
 * so a stale board can narrow the catalog but never widen it.
 */
export const useRecordsContext = (): FieldRecordContextInput => {
  const activeCallId = useCommandStore((state) => state.activeCallId);
  const boards = useCommandStore((state) => state.boards);
  const userId = useAuthStore((state) => state.userId);

  return useMemo(() => {
    const callId = activeCallId ? Number.parseInt(activeCallId, 10) : Number.NaN;
    if (!Number.isFinite(callId) || callId <= 0) {
      return {};
    }

    const context: FieldRecordContextInput = { CallId: callId };
    const board = activeCallId ? boards[activeCallId]?.board : null;
    const assignment = (board?.Roles ?? []).find((role) => !role.RemovedOn && userId && role.UserId === userId);
    if (assignment) {
      context.CommandRole = IncidentRoleType[assignment.RoleType] ?? undefined;
    }
    return context;
  }, [activeCallId, boards, userId]);
};
