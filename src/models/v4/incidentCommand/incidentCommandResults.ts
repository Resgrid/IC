// v4 response wrappers for the IncidentCommand controller, mirroring
// Web/Resgrid.Web.Services/Models/v4/IncidentCommand/IncidentCommandModels.cs.
// Each extends the standard v4 envelope (BaseV4Request) and carries a typed Data payload.

import { type BaseV4Request } from '../baseV4Request';
import { type CommandLogEntry } from './commandLogEntry';
import { type CommandStructureNode } from './commandStructureNode';
import { type CommandTransfer } from './commandTransfer';
import { type IncidentCommand } from './incidentCommand';
import { type IncidentCommandBoard } from './incidentCommandBoard';
import { type IncidentCommandBundle } from './incidentCommandBundle';
import { type IncidentMapAnnotation } from './incidentMapAnnotation';
import { type IncidentTimer } from './incidentTimer';
import { type PersonnelCallCheckInStatus } from './personnelCallCheckInStatus';
import { type ResourceAssignment } from './resourceAssignment';
import { type TacticalObjective } from './tacticalObjective';

export interface IncidentCommandResult extends BaseV4Request {
  Data: IncidentCommand | null;
}

export interface IncidentCommandBoardResult extends BaseV4Request {
  Data: IncidentCommandBoard | null;
}

export interface CommandTransferResult extends BaseV4Request {
  Data: CommandTransfer | null;
}

export interface CommandNodeResult extends BaseV4Request {
  Data: CommandStructureNode | null;
}

export interface ResourceAssignmentResult extends BaseV4Request {
  Data: ResourceAssignment | null;
}

export interface TacticalObjectiveResult extends BaseV4Request {
  Data: TacticalObjective | null;
}

export interface IncidentTimerResult extends BaseV4Request {
  Data: IncidentTimer | null;
}

export interface IncidentMapAnnotationResult extends BaseV4Request {
  Data: IncidentMapAnnotation | null;
}

export interface CommandTimelineResult extends BaseV4Request {
  Data: CommandLogEntry[];
}

/** Simple boolean action result (delete/release/complete/acknowledge operations). */
export interface IncidentCommandActionResult extends BaseV4Request {
  Data: boolean;
}

/** Per-person accountability / PAR status for the incident. */
export interface CommandAccountabilityResult extends BaseV4Request {
  Data: PersonnelCallCheckInStatus[];
}

/** User ids newly flagged Critical (PAR overdue) by an accountability sweep. */
export interface EvaluateAccountabilityResult extends BaseV4Request {
  Data: string[];
}

/** Shift-start aggregate: a render-ready board per active incident + ad-hoc resources + next-sync cursor. */
export interface SyncBundleResult extends BaseV4Request {
  Data: IncidentCommandBundle | null;
}
