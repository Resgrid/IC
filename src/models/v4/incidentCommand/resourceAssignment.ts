// Mirrors Core/Resgrid.Model/IncidentCommand/CommandStructureNode.cs (ResourceAssignment).

/**
 * Assigns a resource to a command structure node. Polymorphic: the resource may be an own-department
 * unit/person, a linked (mutual-aid) department unit/person, or an incident ad-hoc unit/person.
 */
export interface ResourceAssignment {
  ResourceAssignmentId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  CommandStructureNodeId: string | null;
  /** Maps to ResourceAssignmentKind. */
  ResourceKind: number;
  /** Polymorphic resource id (unit id, user id, or ad-hoc guid) stored as string. */
  ResourceId: string;
  AssignedByUserId: string;
  AssignedOn: string;
  ReleasedOn: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
