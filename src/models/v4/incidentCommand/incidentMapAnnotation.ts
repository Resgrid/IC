// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentTacticals.cs (IncidentMapAnnotation).

/** A real-time map annotation (markup) on the tactical map, synced across devices. */
export interface IncidentMapAnnotation {
  IncidentMapAnnotationId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Maps to IncidentMapAnnotationType. */
  AnnotationType: number;
  /** The annotation geometry as a GeoJSON feature. */
  GeoJson: string;
  /** Optional ICS standard symbology code. */
  IcsSymbolCode: string | null;
  Label: string | null;
  CreatedByUserId: string;
  CreatedOn: string;
  DeletedOn: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn: string | null;
}
