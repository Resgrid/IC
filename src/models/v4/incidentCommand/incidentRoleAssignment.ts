// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentRole.cs (IncidentRoleAssignment).

/**
 * Assigns a Resgrid user to a functional incident-command role for a specific incident (Call).
 * Incident-scoped, not a department-wide claim. Optionally scoped to a structure node for supervisors.
 */
export interface IncidentRoleAssignment {
  IncidentRoleAssignmentId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  UserId: string;
  /** Maps to IncidentRoleType. */
  RoleType: number;
  /** Optional command structure node this role is scoped to (e.g. a Division/Group supervisor). */
  ScopeNodeId: string | null;
  AssignedByUserId: string;
  AssignedOn: string;
  RemovedOn: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
