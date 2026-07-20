// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentAdHocResources.cs (IncidentAdHocPersonnel).

/**
 * An incident-scoped, ad-hoc person created on the fly for resources not in Resgrid. May ride an ad-hoc
 * (or real) unit for accountability via RidingResourceKind + RidingResourceId.
 */
export interface IncidentAdHocPersonnel {
  IncidentAdHocPersonnelId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  /** Role / qualification (e.g. "Paramedic", "Firefighter"). */
  Role: string | null;
  ExternalAgencyName: string | null;
  Contact: string | null;
  /** The kind of unit this person is riding for accountability (maps to ResourceAssignmentKind). */
  RidingResourceKind: number;
  /** Identifier of the unit this person is riding (ad-hoc unit id, real unit id, ...), or null. */
  RidingResourceId: string | null;
  CreatedByUserId: string;
  CreatedOn: string;
  ReleasedOn: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
