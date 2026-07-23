/**
 * Models for the Resgrid Core Incident Command (ICS) v4 API.
 * Mirrors Core/Resgrid.Model/IncidentCommand/* and
 * Web/Resgrid.Web.Services/Models/v4/IncidentCommand/IncidentCommandModels.cs.
 */

/** Functional incident-command positions (NIMS/ICS) — mirrors Core IncidentRoleType. */
export enum IncidentRoleType {
  IncidentCommander = 0,
  DeputyIncidentCommander = 1,
  UnifiedCommandMember = 2,
  OperationsSectionChief = 3,
  PlanningSectionChief = 4,
  LogisticsSectionChief = 5,
  FinanceAdminSectionChief = 6,
  SafetyOfficer = 7,
  LiaisonOfficer = 8,
  PublicInformationOfficer = 9,
  StagingAreaManager = 10,
  ResourcesUnitLeader = 11,
  SituationUnitLeader = 12,
  DocumentationUnitLeader = 13,
  CommunicationsUnitLeader = 14,
  DivisionGroupSupervisor = 15,
  BranchDirector = 16,
  StrikeTeamTaskForceLeader = 17,
  MedicalUnitLeader = 18,
  RehabOfficer = 19,
  MedicalBranchDirector = 20,
  TriageOfficer = 21,
  TreatmentOfficer = 22,
  TransportOfficer = 23,
  HazMatGroupSupervisor = 24,
  DeconOfficer = 25,
  EntryTeamLeader = 26,
  SearchGroupSupervisor = 27,
  AirOperationsBranchDirector = 28,
  ShelterMassCareCoordinator = 29,
  DamageAssessmentLead = 30,
}

/** ICS structural node types (the "lanes" on the command board) — mirrors Core CommandNodeType. */
export enum CommandNodeType {
  Division = 0,
  Group = 1,
  Branch = 2,
  Sector = 3,
  StrikeTeam = 4,
  TaskForce = 5,
  Staging = 6,
  UnifiedCommand = 7,
}

/** What kind of resource a ResourceAssignment points at — mirrors Core ResourceAssignmentKind. */
export enum ResourceAssignmentKind {
  RealUnit = 0,
  RealPersonnel = 1,
  LinkedDeptUnit = 2,
  LinkedDeptPersonnel = 3,
  AdHocUnit = 4,
  AdHocPersonnel = 5,
}

/** Classification of a tactical objective — mirrors Core TacticalObjectiveType. */
export enum TacticalObjectiveType {
  General = 0,
  Benchmark = 1,
  Safety = 2,
}

/** Completion state of a tactical objective — mirrors Core TacticalObjectiveStatus. */
/** How a completed tactical objective turned out (recorded at close-out). Mirrors Core. */
export enum TacticalObjectiveOutcome {
  NotSet = 0,
  Successful = 1,
  Partial = 2,
  Unsuccessful = 3,
}

export enum TacticalObjectiveStatus {
  Pending = 0,
  Complete = 1,
  InProgress = 2,
}

/** Category of a command-level incident need — mirrors Core IncidentNeedCategory. */
export enum IncidentNeedCategory {
  Resource = 0,
  Logistics = 1,
  Medical = 2,
  Equipment = 3,
  Staffing = 4,
  Other = 5,
  /** Request for SPECIFIC Resgrid entities (units/users/roles/groups), dispatched individually by command. */
  Entity = 6,
}

/** What kind of Resgrid entity an IncidentNeedEntity requests — mirrors Core NeedEntityKind. */
export enum NeedEntityKind {
  Unit = 0,
  User = 1,
  Role = 2,
  Group = 3,
}

/** Fulfillment state of an incident need — mirrors Core IncidentNeedStatus. */
export enum IncidentNeedStatus {
  Open = 0,
  PartiallyMet = 1,
  Met = 2,
  Cancelled = 3,
}

export interface IncidentCommand {
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
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
  IcsLevel: number;
  /** Optional commander-supplied estimate of when the incident will end. */
  EstimatedEndOn?: string | null;
  /** Important information every resource on the incident should see. */
  ImportantInformation?: string | null;
  Status: number;
  ClosedOn?: string | null;
  ModifiedOn?: string | null;
}

export interface CommandStructureNode {
  CommandStructureNodeId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  NodeType: number;
  Name: string;
  /** Lane display color (hex); resources in the lane inherit it on maps. */
  Color?: string | null;
  /** Minimum personnel riding a unit for it to fill this lane (0 = none). */
  MinUnitPersonnel?: number;
  /** Maximum personnel riding a unit for it to fill this lane (0 = none). */
  MaxUnitPersonnel?: number;
  /** Minimum units this lane wants filled (advisory under-filled indicator). */
  MinUnits?: number;
  /** Maximum units in this lane at once (0 = unlimited). */
  MaxUnits?: number;
  /** Minimum minutes a resource should stay before rotating out (advisory). */
  MinTimeInRole?: number;
  /** Maximum minutes before a resource is rotation-due in this lane (0 = none). */
  MaxTimeInRole?: number;
  /** When true, unmet lane requirements block assignment instead of warning. */
  ForceRequirements?: boolean;
  /** Optional primary tactical objective this lane is working. */
  PrimaryObjectiveId?: string | null;
  /** Optional secondary tactical objective this lane is working. */
  SecondaryObjectiveId?: string | null;
  /** Optional incident need this lane is fulfilling. */
  LinkedNeedId?: string | null;
  /** Optional named incident map attached to this lane (e.g. the area it is working). */
  LinkedMapId?: string | null;
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
  ParentNodeId?: string | null;
  SupervisorUserId?: string | null;
  SupervisorUnitId?: number | null;
  SortOrder: number;
  SourceRoleId?: number | null;
  DeletedOn?: string | null;
  ModifiedOn?: string | null;
}

export interface ResourceAssignment {
  ResourceAssignmentId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  CommandStructureNodeId: string;
  ResourceKind: number;
  ResourceId: string;
  AssignedByUserId: string;
  AssignedOn: string;
  ReleasedOn?: string | null;
  RequirementsWarning: boolean;
  RequirementsWarningMessage?: string | null;
  ModifiedOn?: string | null;
}

export interface TacticalObjective {
  TacticalObjectiveId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  ObjectiveType: number;
  Status: number;
  AutoPopulated: boolean;
  CompletedByUserId?: string | null;
  CompletedOn?: string | null;
  /** How the objective turned out at close-out. Maps to TacticalObjectiveOutcome. */
  Outcome?: number;
  /** Optional close-out note recorded when the objective was completed. */
  CompletionNote?: string | null;
  /** Optional free-text detail describing the objective. */
  Description?: string | null;
  /** Progress toward completion, 0-100 (complete objectives are 100). */
  ProgressPercent: number;
  /** Relative priority for triage/ordering (0 = unset; higher = more urgent). */
  Priority: number;
  /** Optional target time this objective should be complete by. */
  TargetCompleteOn?: string | null;
  SortOrder: number;
  ModifiedOn?: string | null;
}

/** A command-level need (resources/logistics/etc.) tracked to fulfillment — mirrors Core IncidentNeed. */
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
  ModifiedOn?: string | null;
}

export interface IncidentTimer {
  IncidentTimerId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  TimerType: number;
  ScopeType: number;
  ScopeId?: string | null;
  Name: string;
  IntervalSeconds: number;
  StartedOn: string;
  NextDueOn?: string | null;
  Status: number;
  AcknowledgedOn?: string | null;
  ModifiedOn?: string | null;
}

export interface IncidentMapAnnotation {
  IncidentMapAnnotationId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  AnnotationType: number;
  /** The named IncidentMap this markup belongs to; null = the incident's main map. */
  IncidentMapId?: string | null;
  GeoJson: string;
  IcsSymbolCode?: string | null;
  Label?: string | null;
  CreatedByUserId: string;
  CreatedOn: string;
  DeletedOn?: string | null;
  ModifiedOn?: string | null;
}

export interface IncidentRoleAssignment {
  IncidentRoleAssignmentId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  UserId: string;
  RoleType: IncidentRoleType;
  ScopeNodeId?: string | null;
  AssignedByUserId: string;
  AssignedOn: string;
  RemovedOn?: string | null;
  ModifiedOn?: string | null;
}

export interface IncidentAdHocUnit {
  IncidentAdHocUnitId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  UnitTypeId?: number | null;
  Type?: string | null;
  ExternalAgencyName?: string | null;
  CreatedByUserId: string;
  CreatedOn: string;
  ReleasedOn?: string | null;
  ModifiedOn?: string | null;
}

export interface IncidentAdHocPersonnel {
  IncidentAdHocPersonnelId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  Role?: string | null;
  ExternalAgencyName?: string | null;
  Contact?: string | null;
  RidingResourceKind: number;
  RidingResourceId?: string | null;
  CreatedByUserId: string;
  CreatedOn: string;
  ReleasedOn?: string | null;
  ModifiedOn?: string | null;
}

/** PAR / accountability row — computed server-side from check-in timers. */
export interface PersonnelCallCheckInStatus {
  UserId: string;
  FullName: string;
  LastCheckIn?: string | null;
  NeedsCheckIn: boolean;
  MinutesRemaining: number;
  Status: 'Green' | 'Warning' | 'Critical' | string;
  DurationMinutes: number;
  WarningThresholdMinutes: number;
}

export interface CommandLogEntry {
  CommandLogEntryId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  EntryType: number;
  Description: string;
  UserId?: string | null;
  Latitude?: string | null;
  Longitude?: string | null;
  OccurredOn: string;
}

export interface CommandTransfer {
  CommandTransferId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  FromUserId: string;
  ToUserId: string;
  TransferredOn: string;
  Notes?: string | null;
}

/** Visibility of an incident note/attachment. Mirrors Core IncidentContentVisibility. */
export enum IncidentContentVisibility {
  Internal = 0,
  Public = 1,
}

/** Operational status note attached to an incident command. Mirrors Core IncidentNote. */
export interface IncidentNote {
  IncidentNoteId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Maps to Core IncidentNoteType (General/SituationUpdate/...). */
  NoteType: number;
  /** Maps to IncidentContentVisibility — Internal notes never reach the public feed. */
  Visibility: number;
  Title?: string | null;
  Body: string;
  ContainmentPercent?: number | null;
  CreatedByUserId: string;
  CreatedOn: string;
  DeletedOn?: string | null;
  ModifiedOn?: string | null;
}

/** Incident-level file metadata (Data itself is only served by DownloadAttachment). Mirrors Core IncidentAttachment. */
export interface IncidentAttachment {
  IncidentAttachmentId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  Visibility: number;
  FileName: string;
  ContentType?: string | null;
  ContentLength: number;
  Description?: string | null;
  UploadedByUserId: string;
  UploadedOn: string;
  DeletedOn?: string | null;
}

/** Full render-ready board — response of GetCommandBoard and Sync Bundle entries. */
export interface IncidentCommandBoard {
  Command: IncidentCommand;
  Nodes: CommandStructureNode[];
  Assignments: ResourceAssignment[];
  Objectives: TacticalObjective[];
  /** Command-level needs tracked to fulfillment. */
  Needs: IncidentNeed[];
  Timers: IncidentTimer[];
  Annotations: IncidentMapAnnotation[];
  Accountability: PersonnelCallCheckInStatus[];
  Roles: IncidentRoleAssignment[];
  /** Operational status notes (internal + public). */
  Notes?: IncidentNote[];
  /** Incident file metadata. */
  Attachments?: IncidentAttachment[];
  /** Named tactical maps (the main map lives on the Command itself). */
  Maps?: IncidentMap[];
}

/**
 * A named tactical map for the incident — own framing, description, optional expiry, full audit.
 * The incident's MAIN map lives on IncidentCommand itself (MapCenterLatitude/Longitude + MapZoomLevel).
 * Mirrors Core IncidentMap.
 */
export interface IncidentMap {
  IncidentMapId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  Name: string;
  Description?: string | null;
  CenterLatitude?: string | null;
  CenterLongitude?: string | null;
  /** Zoom level (0-22); null until the framing has been pinned. */
  ZoomLevel?: string | null;
  /** Optional expiry after which the map is stale (kept, but flagged in UIs). */
  ExpiresOn?: string | null;
  CreatedByUserId?: string | null;
  CreatedOn: string;
  UpdatedByUserId?: string | null;
  UpdatedOn?: string | null;
  DeletedOn?: string | null;
  ModifiedOn?: string | null;
}

/** List-card projection for the incident list (GetCommandList). Mirrors Core IncidentCommandSummary. */
export interface IncidentCommandSummary {
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Commander-supplied incident name; null when unnamed (fall back to the call name). */
  Name?: string | null;
  CallName?: string | null;
  CallNumber?: string | null;
  CallAddress?: string | null;
  /** Maps to IncidentCommandStatus (0 = Active, 1 = Closed). */
  Status: number;
  EstablishedOn: string;
  ClosedOn?: string | null;
  CommanderUserId?: string | null;
  CommanderName?: string | null;
  CommandPostLocationText?: string | null;
  CommandPostLatitude?: string | null;
  CommandPostLongitude?: string | null;
  /** Active (unreleased) personnel assignments placed in a lane or staging. */
  AssignedPersonnelCount: number;
  /** Active (unreleased) unit assignments placed in a lane or staging. */
  AssignedUnitCount: number;
}

// ---- API result envelopes (mirror the standard v4 result shape) ----

interface V4Result<T> {
  Data: T;
  Status?: string;
  Message?: string;
}

export type IncidentCommandResult = V4Result<IncidentCommand>;
export type IncidentCommandBoardResult = V4Result<IncidentCommandBoard>;
export type CommandTransferResult = V4Result<CommandTransfer>;
export type CommandAccountabilityResult = V4Result<PersonnelCallCheckInStatus[]>;
export type EvaluateAccountabilityResult = V4Result<string[]>;
export type CommandNodeResult = V4Result<CommandStructureNode>;
export type ResourceAssignmentResult = V4Result<ResourceAssignment> & { Message?: string };
export type TacticalObjectiveResult = V4Result<TacticalObjective>;
export type IncidentNeedResult = V4Result<IncidentNeed>;
export type IncidentNeedsResult = V4Result<IncidentNeed[]>;
export type IncidentTimerResult = V4Result<IncidentTimer>;
export type IncidentMapAnnotationResult = V4Result<IncidentMapAnnotation>;
export type CommandTimelineResult = V4Result<CommandLogEntry[]>;
export type IncidentCommandActionResult = V4Result<boolean>;
export type IncidentRoleResult = V4Result<IncidentRoleAssignment>;
export type IncidentRolesResult = V4Result<IncidentRoleAssignment[]>;
export type IncidentCapabilitiesResult = V4Result<{ Value: number; Capabilities: string[] }>;
export type AdHocUnitResult = V4Result<IncidentAdHocUnit>;
export type AdHocUnitsResult = V4Result<IncidentAdHocUnit[]>;
export type AdHocPersonnelResult = V4Result<IncidentAdHocPersonnel>;
export type AdHocPersonnelListResult = V4Result<IncidentAdHocPersonnel[]>;
export type IncidentNoteResult = V4Result<IncidentNote>;
export type IncidentNotesResult = V4Result<IncidentNote[]>;
export type IncidentNeedUpdatesResult = V4Result<IncidentNeedUpdate[]>;
export type IncidentNeedEntitiesResult = V4Result<IncidentNeedEntity[]>;
export type IncidentAttachmentResult = V4Result<IncidentAttachment>;
export type IncidentAttachmentsResult = V4Result<IncidentAttachment[]>;
export type IncidentCommandSummariesResult = V4Result<IncidentCommandSummary[]>;
export type IncidentMapResult = V4Result<IncidentMap>;
export type IncidentMapsResult = V4Result<IncidentMap[]>;

// ---- Request inputs ----

export interface EstablishCommandInput {
  CallId: number;
  CommandDefinitionId?: number | null;
}

export interface TransferCommandInput {
  IncidentCommandId: string;
  ToUserId: string;
  Notes?: string;
}

export interface UpdateActionPlanInput {
  IncidentCommandId: string;
  ActionPlan: string;
}

export interface MoveResourceInput {
  ResourceAssignmentId: string;
  TargetNodeId: string;
}

/** Input to update command-level details every resource should see. */
export interface UpdateCommandDetailsInput {
  IncidentCommandId: string;
  EstimatedEndOn?: string | null;
  ImportantInformation?: string | null;
}

/** Input to reopen a previously closed command, with the caller's reason for reopening. */
export interface ReopenCommandInput {
  IncidentCommandId: string;
  Reason?: string | null;
}

/**
 * Input to update core incident metadata and the ICP/HQ, Staging, and Rehab locations.
 * Null/omitted fields are left unchanged; empty strings clear. A location whose text is set while
 * its coordinates are blank is geocoded server-side on save.
 */
export interface UpdateCommandInfoInput {
  IncidentCommandId: string;
  Name?: string | null;
  EstablishedOn?: string | null;
  EstimatedEndOn?: string | null;
  ClearEstimatedEndOn?: boolean;
  ImportantInformation?: string | null;
  IcsLevel?: number | null;
  CommandPostLocationText?: string | null;
  CommandPostLatitude?: string | null;
  CommandPostLongitude?: string | null;
  StagingLocationText?: string | null;
  StagingLatitude?: string | null;
  StagingLongitude?: string | null;
  RehabLocationText?: string | null;
  RehabLatitude?: string | null;
  RehabLongitude?: string | null;
}

/** Input to add an internal or public operational status note to the incident. */
export interface AddIncidentNoteInput {
  IncidentCommandId: string;
  /** Maps to Core IncidentNoteType; 0 = General. */
  NoteType: number;
  /** Maps to IncidentContentVisibility. */
  Visibility: number;
  Title?: string | null;
  Body: string;
  ContainmentPercent?: number | null;
}

/** Input to set an objective's progress percentage (0-100; 100 completes it). */
export interface UpdateObjectiveProgressInput {
  TacticalObjectiveId: string;
  ProgressPercent: number;
}

/** Input to transition an incident need's fulfillment status. */
export interface SetNeedStatusInput {
  IncidentNeedId: string;
  /** Maps to IncidentNeedStatus. */
  Status: number;
  /** New fulfilled quantity — may be LOWER than the current value (a fill got called off). */
  QuantityFulfilled?: number | null;
  /** Optional context recorded on the audit trail and incident log ("Engine 1 from mutual aid"). */
  Note?: string | null;
}

/** One requested entity under an Entity-category need. Mirrors Core IncidentNeedEntity. */
export interface IncidentNeedEntity {
  IncidentNeedEntityId: string;
  IncidentNeedId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Maps to NeedEntityKind. */
  EntityKind: number;
  /** UnitId / UserId / PersonnelRoleId / DepartmentGroupId depending on the kind. */
  EntityId: string;
  /** Display-name snapshot at request time. */
  EntityName?: string | null;
  /** When the individual dispatch for this entity was queued; null when dispatch failed. */
  DispatchedOn?: string | null;
  CreatedByUserId?: string | null;
  CreatedOn: string;
}

/** Append-only audit row for one fulfillment change on a need. Mirrors Core IncidentNeedUpdate. */
export interface IncidentNeedUpdate {
  IncidentNeedUpdateId: string;
  IncidentNeedId: string;
  IncidentCommandId: string;
  DepartmentId: number;
  CallId: number;
  /** Maps to IncidentNeedStatus. */
  PreviousStatus: number;
  /** Maps to IncidentNeedStatus. */
  NewStatus: number;
  PreviousQuantityFulfilled: number;
  NewQuantityFulfilled: number;
  Note?: string | null;
  CreatedByUserId?: string | null;
  /** Resolved server-side for display — never a raw user GUID. */
  CreatedByUserName?: string | null;
  CreatedOn: string;
}

// ---- Sync models (SyncController) ----

export interface IncidentCommandChanges {
  ServerTimestampMs: number;
  Commands: IncidentCommand[];
  Nodes: CommandStructureNode[];
  Assignments: ResourceAssignment[];
  Objectives: TacticalObjective[];
  Needs: IncidentNeed[];
  Timers: IncidentTimer[];
  Annotations: IncidentMapAnnotation[];
  Roles: IncidentRoleAssignment[];
  AdHocUnits: IncidentAdHocUnit[];
  AdHocPersonnel: IncidentAdHocPersonnel[];
  TimelineEntries: CommandLogEntry[];
}

export interface IncidentCommandBundle {
  ServerTimestampMs: number;
  Boards: IncidentCommandBoard[];
  AdHocUnits: IncidentAdHocUnit[];
  AdHocPersonnel: IncidentAdHocPersonnel[];
}

export type SyncChangesResult = V4Result<IncidentCommandChanges>;
export type SyncBundleResult = V4Result<IncidentCommandBundle>;
export type SyncReferenceResult = V4Result<Record<string, unknown>>;

// ---- Incident voice (PTT) ----

/** On-demand tactical voice channel scoped to a call (Resgrid PTT addon). */
export interface IncidentVoiceChannel {
  DepartmentVoiceChannelId: string;
  DepartmentId: number;
  CallId?: number | null;
  Name: string;
  IsOnDemand: boolean;
  ClosedOn?: string | null;
}

/** One PTT transmission: who keyed up, on which channel, start/end. */
export interface VoiceTransmissionLog {
  VoiceTransmissionLogId: string;
  DepartmentId: number;
  CallId: number;
  DepartmentVoiceChannelId: string;
  UserId: string;
  StartedOn: string;
  EndedOn?: string | null;
}

export type IncidentVoiceChannelResult = V4Result<IncidentVoiceChannel>;
export type IncidentVoiceChannelsResult = V4Result<IncidentVoiceChannel[]>;
export type VoiceTransmissionLogResult = V4Result<VoiceTransmissionLog>;
export type VoiceTransmissionLogsResult = V4Result<VoiceTransmissionLog[]>;

// ---- Incident reporting ----

/** NFIRS/NERIS-oriented key-times report for federal/NFPA reporting. */
export interface IncidentTimesReport {
  CallId: number;
  AlarmOn?: string | null;
  CommandEstablishedOn?: string | null;
  FirstResourceAssignedOn?: string | null;
  FirstBenchmarkCompletedOn?: string | null;
  LastBenchmarkCompletedOn?: string | null;
  CommandClosedOn?: string | null;
  DurationMinutes: number;
  UnitResourceCount: number;
  PersonnelResourceCount: number;
  MutualAidResourceCount: number;
  Benchmarks: { Name: string; CompletedOn?: string | null; MinutesFromAlarm?: number | null }[];
}

export type IncidentTimesReportResult = V4Result<IncidentTimesReport>;
