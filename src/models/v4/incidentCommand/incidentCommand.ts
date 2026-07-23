// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentCommand.cs.
// Dates are ISO-8601 strings over the wire (.NET DateTime serialized by Newtonsoft.Json).

/** A live incident-command instance established on a specific Call. */
export interface IncidentCommand {
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** The CommandDefinition this instance was seeded from, if any. */
  SourceCommandDefinitionId?: number | null;
  EstablishedByUserId: string;
  EstablishedOn: string;
  CurrentCommanderUserId: string;
  /** Optional commander-supplied display name for the incident (falls back to the call name in UIs). */
  Name?: string | null;
  /** Free-form description of where the ICP/HQ (command post) is. */
  CommandPostLocationText?: string | null;
  CommandPostLatitude?: string | null;
  CommandPostLongitude?: string | null;
  /** Free-form description of where Staging is located. */
  StagingLocationText?: string | null;
  StagingLatitude?: string | null;
  StagingLongitude?: string | null;
  /** Free-form description of where Rehab is located. */
  RehabLocationText?: string | null;
  RehabLatitude?: string | null;
  RehabLongitude?: string | null;
  /** Saved incident-map view center; null until the incident map is created. */
  MapCenterLatitude?: string | null;
  MapCenterLongitude?: string | null;
  /** Saved incident-map zoom level (0-22); null until the incident map is created. */
  MapZoomLevel?: string | null;
  IncidentActionPlan?: string | null;
  /** NIMS/ICS escalation level for the incident (department defined). */
  IcsLevel: number;
  /** Optional commander-supplied estimate of when the incident will end. */
  EstimatedEndOn?: string | null;
  /** Important information every resource on the incident should see. */
  ImportantInformation?: string | null;
  /** Maps to IncidentCommandStatus. */
  Status: number;
  ClosedOn?: string | null;
  /** Change cursor for offline delta sync + last-write-wins. */
  ModifiedOn?: string | null;
}
