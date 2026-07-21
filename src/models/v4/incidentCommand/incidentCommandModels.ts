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
  CommandPostLatitude?: string | null;
  CommandPostLongitude?: string | null;
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
  QuantityFulfilled?: number | null;
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
