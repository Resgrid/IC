// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentCommandBoard.cs — the composite, one-shot
// snapshot of a live incident command board ("Real Time Sync" view).

import { type CommandStructureNode } from './commandStructureNode';
import { type IncidentCommand } from './incidentCommand';
import { type IncidentAttachment, type IncidentNote } from './incidentCommandModels';
import { type IncidentMapAnnotation } from './incidentMapAnnotation';
import { type IncidentNeed } from './incidentNeed';
import { type IncidentRoleAssignment } from './incidentRoleAssignment';
import { type IncidentTimer } from './incidentTimer';
import { type PersonnelCallCheckInStatus } from './personnelCallCheckInStatus';
import { type ResourceAssignment } from './resourceAssignment';
import { type TacticalObjective } from './tacticalObjective';

/** Composite snapshot of a live incident command board. */
export interface IncidentCommandBoard {
  Command: IncidentCommand;
  Nodes: CommandStructureNode[];
  Assignments: ResourceAssignment[];
  Objectives: TacticalObjective[];
  /** Command-level needs tracked to fulfillment. */
  Needs: IncidentNeed[];
  Timers: IncidentTimer[];
  Annotations: IncidentMapAnnotation[];
  /** Personnel accountability / PAR status (from the Checkin feature) for the incident. */
  Accountability: PersonnelCallCheckInStatus[];
  /** Active functional command-role assignments for the incident. */
  Roles: IncidentRoleAssignment[];
  /** Operational status notes (internal + public). */
  Notes?: IncidentNote[];
  /** Incident file metadata. */
  Attachments?: IncidentAttachment[];
}
