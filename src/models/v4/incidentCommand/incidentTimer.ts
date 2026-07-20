// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentTacticals.cs (IncidentTimer).

/**
 * A scene / benchmark / role timer for an incident. Personnel accountability (PAR) is handled by the
 * Checkin feature, not by these timers.
 */
export interface IncidentTimer {
  IncidentTimerId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Maps to IncidentTimerType. */
  TimerType: number;
  /** Maps to IncidentTimerScopeType. */
  ScopeType: number;
  /** Identifier of the scoped object (node id, unit id, ...), null for incident scope. */
  ScopeId: string | null;
  Name: string;
  IntervalSeconds: number;
  StartedOn: string;
  NextDueOn: string | null;
  /** Maps to IncidentTimerStatus. */
  Status: number;
  AcknowledgedOn: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
