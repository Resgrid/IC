// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentCommand.cs (CommandTransfer).

/** Log of a command transfer (handoff of Incident Commander). */
export interface CommandTransfer {
  CommandTransferId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  FromUserId: string;
  ToUserId: string;
  TransferredOn: string;
  Notes: string | null;
}
