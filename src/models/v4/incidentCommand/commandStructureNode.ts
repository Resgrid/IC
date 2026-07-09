// Mirrors Core/Resgrid.Model/IncidentCommand/CommandStructureNode.cs.

/**
 * A live lane / span-of-control node on the command board (Division, Group, Branch, Staging, ...).
 * Initially seeded from a CommandDefinitionRole, then per-incident editable.
 */
export interface CommandStructureNode {
  CommandStructureNodeId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Maps to CommandNodeType. */
  NodeType: number;
  Name: string;
  /** Parent node for branch/division/group hierarchies; null for top-level nodes. */
  ParentNodeId: string | null;
  SupervisorUserId: string | null;
  SupervisorUnitId: number | null;
  SortOrder: number;
  /** The CommandDefinitionRole this node was seeded from, if any. */
  SourceRoleId: number | null;
  /** Soft-delete tombstone (null = live). */
  DeletedOn: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
