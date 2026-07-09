// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentAdHocResources.cs (IncidentAdHocUnit).

/**
 * An incident-scoped, ad-hoc unit created on the fly for resources not in Resgrid (e.g. a mutual-aid
 * crew from a non-Resgrid agency, or a unit formed from on-scene personnel). Not a real department Unit.
 */
export interface IncidentAdHocUnit {
  IncidentAdHocUnitId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  /** Optional reference to a department UnitType for classification. */
  UnitTypeId: number | null;
  /** Free-text unit type (e.g. "Engine", "Ambulance") when no UnitTypeId applies. */
  Type: string | null;
  /** Name of the external (non-Resgrid) agency this resource belongs to, if any. */
  ExternalAgencyName: string | null;
  CreatedByUserId: string;
  CreatedOn: string;
  ReleasedOn: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
