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
  /** Optional primary tactical objective this lane is working. */
  PrimaryObjectiveId?: string | null;
  /** Optional secondary tactical objective this lane is working. */
  SecondaryObjectiveId?: string | null;
  /** Optional incident need this lane is fulfilling. */
  LinkedNeedId?: string | null;
  /** Primary lane lead when they are a Resgrid user; null for external leads. */
  PrimaryLeadUserId?: string | null;
  /** Primary lane lead display name (external leads). */
  PrimaryLeadName?: string | null;
  PrimaryLeadPhone?: string | null;
  PrimaryLeadEmail?: string | null;
  /** Secondary lane lead when they are a Resgrid user; null for external leads. */
  SecondaryLeadUserId?: string | null;
  /** Secondary lane lead display name (external leads). */
  SecondaryLeadName?: string | null;
  SecondaryLeadPhone?: string | null;
  SecondaryLeadEmail?: string | null;
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
