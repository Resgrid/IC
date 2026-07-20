import { useMemo } from 'react';

import { ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useCommandStore } from '@/stores/command/store';

/** Command-board context for one map marker (unit or personnel on the active board). */
export interface CommandMarkerInfo {
  callId: string;
  assignmentId: string;
  /** '' = unassigned pool. */
  nodeId: string;
  laneName: string;
  laneColor?: string | null;
  resourceKind: ResourceAssignmentKind;
  resourceId: string;
}

const isUnitKind = (kind: number) => kind === ResourceAssignmentKind.RealUnit || kind === ResourceAssignmentKind.LinkedDeptUnit;
const isPersonnelKind = (kind: number) => kind === ResourceAssignmentKind.RealPersonnel || kind === ResourceAssignmentKind.LinkedDeptPersonnel;

/**
 * Map marker id → active-command-board context, keyed by the GetMapDataAndMarkers
 * marker id convention (`u{unitId}` units, `p{userId}` personnel).
 */
export const useCommandMapOverlay = (): Record<string, CommandMarkerInfo> => {
  const boards = useCommandStore((state) => state.boards);
  const activeCallId = useCommandStore((state) => state.activeCallId);

  return useMemo(() => {
    const entry = activeCallId ? boards[activeCallId] : undefined;
    if (!entry?.board) {
      return {};
    }

    const nodesById = new Map(entry.board.Nodes.filter((n) => !n.DeletedOn).map((n) => [n.CommandStructureNodeId, n]));
    const overlay: Record<string, CommandMarkerInfo> = {};

    for (const assignment of entry.board.Assignments) {
      if (assignment.ReleasedOn) {
        continue;
      }
      const markerId = isUnitKind(assignment.ResourceKind) ? `u${assignment.ResourceId}` : isPersonnelKind(assignment.ResourceKind) ? `p${assignment.ResourceId}` : null;
      if (!markerId) {
        continue;
      }
      const node = assignment.CommandStructureNodeId ? nodesById.get(assignment.CommandStructureNodeId) : undefined;
      overlay[markerId] = {
        callId: entry.callId,
        assignmentId: assignment.ResourceAssignmentId,
        nodeId: assignment.CommandStructureNodeId ?? '',
        laneName: node?.Name ?? '',
        laneColor: node?.Color,
        resourceKind: assignment.ResourceKind,
        resourceId: assignment.ResourceId,
      };
    }

    return overlay;
  }, [boards, activeCallId]);
};
