// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentNeed.cs.

/** A command-level need (resources/logistics/etc.) tracked to fulfillment. */
export interface IncidentNeed {
  IncidentNeedId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  Description?: string | null;
  /** Maps to IncidentNeedCategory. */
  Category: number;
  /** Maps to IncidentNeedStatus. */
  Status: number;
  /** How many of the thing are needed (0 = unquantified). */
  QuantityRequested: number;
  QuantityFulfilled: number;
  /** Relative priority for triage/ordering (0 = unset; higher = more urgent). */
  Priority: number;
  CreatedByUserId?: string | null;
  CreatedOn: string;
  MetByUserId?: string | null;
  MetOn?: string | null;
  SortOrder: number;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn?: string | null;
}
