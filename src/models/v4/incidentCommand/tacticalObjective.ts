// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentTacticals.cs (TacticalObjective).

/** A tactical objective / benchmark for an incident (e.g. "Primary search complete"). */
export interface TacticalObjective {
  TacticalObjectiveId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  /** Maps to TacticalObjectiveType. */
  ObjectiveType: number;
  /** Maps to TacticalObjectiveStatus. */
  Status: number;
  AutoPopulated: boolean;
  CompletedByUserId: string | null;
  CompletedOn: string | null;
  SortOrder: number;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
