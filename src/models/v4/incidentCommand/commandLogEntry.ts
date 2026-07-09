// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentCommand.cs (CommandLogEntry).

/** An append-only ICS-201 style timeline entry, auto-written on every command action. */
export interface CommandLogEntry {
  CommandLogEntryId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Maps to CommandLogEntryType. */
  EntryType: number;
  Description: string;
  UserId: string | null;
  Latitude: string | null;
  Longitude: string | null;
  OccurredOn: string;
}
