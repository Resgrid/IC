// The readiness packet as the server builds it for a call (ReadinessEvidenceManifestV1), reduced to what an
// incident commander needs at a glance: for each unit on the incident, its most recent check, how many checks
// failed or were missed in the window, and the work orders still open against it.

export interface ReadinessChecklistEntry {
  Name?: string | null;
  Target?: { Type: number; Id: string; Name?: string | null } | null;
  SubmittedUtc?: string | null;
  DueUtc?: string | null;
  StartUtc: string;
  Completed: boolean;
  Missed: boolean;
  Skipped: boolean;
  Passed?: boolean | null;
}

export interface ReadinessWorkOrder {
  WorkOrderId: string;
  Title?: string | null;
  Status: number;
  Priority: number;
  UnitId?: number | null;
}

export interface ReadinessPacket {
  CallId: number;
  CoverageStartUtc: string;
  CoverageEndUtc: string;
  Units: { UnitId: number; Name?: string | null; DispatchedUtc: string }[];
  Checklists: ReadinessChecklistEntry[];
  WorkOrders: ReadinessWorkOrder[];
  UnavailableSources: string[];
}

export interface UnitReadiness {
  unitId: number;
  name: string;
  latest: ReadinessChecklistEntry | null;
  failed: number;
  missed: number;
  openWorkOrders: ReadinessWorkOrder[];
  /** A failed latest check, a missed check or an open high-priority work order. */
  attention: boolean;
}

/** Checklist target type Unit (ChecklistTargetType.Unit). */
const UNIT_TARGET = 1;
/** Work orders not yet completed (WorkOrderStatus below Completed). */
const OPEN_BELOW = 5;
const HIGH_PRIORITY = 2;

export const summarizeReadiness = (packet: ReadinessPacket, fallbackName: string): UnitReadiness[] =>
  packet.Units.map((unit) => {
    const entries = packet.Checklists.filter((entry) => entry.Target?.Type === UNIT_TARGET && entry.Target.Id === String(unit.UnitId));
    const completed = entries.filter((entry) => entry.Completed && entry.SubmittedUtc).sort((a, b) => String(b.SubmittedUtc).localeCompare(String(a.SubmittedUtc)));
    const latest = completed[0] ?? null;
    const failed = entries.filter((entry) => entry.Completed && entry.Passed === false).length;
    const missed = entries.filter((entry) => entry.Missed).length;
    const openWorkOrders = packet.WorkOrders.filter((order) => order.UnitId === unit.UnitId && order.Status < OPEN_BELOW);
    return {
      unitId: unit.UnitId,
      name: unit.Name?.trim() || fallbackName,
      latest,
      failed,
      missed,
      openWorkOrders,
      attention: latest?.Passed === false || missed > 0 || openWorkOrders.some((order) => order.Priority >= HIGH_PRIORITY),
    };
  }).sort((a, b) => Number(b.attention) - Number(a.attention) || a.name.localeCompare(b.name));
