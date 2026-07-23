import { type TFunction } from 'i18next';

import { CommandNodeType, IncidentNeedCategory, IncidentNeedStatus, IncidentRoleType, TacticalObjectiveType } from '@/models/v4/incidentCommand/incidentCommandModels';

/** i18n keys for the roles offered as quick presets in the assignment sheet. */
export const ICS_ROLE_I18N_KEYS: Partial<Record<IncidentRoleType, string>> = {
  [IncidentRoleType.IncidentCommander]: 'command.role_ic',
  [IncidentRoleType.OperationsSectionChief]: 'command.role_operations',
  [IncidentRoleType.PlanningSectionChief]: 'command.role_planning',
  [IncidentRoleType.LogisticsSectionChief]: 'command.role_logistics',
  [IncidentRoleType.FinanceAdminSectionChief]: 'command.role_finance',
  [IncidentRoleType.SafetyOfficer]: 'command.role_safety',
  [IncidentRoleType.LiaisonOfficer]: 'command.role_liaison',
  [IncidentRoleType.PublicInformationOfficer]: 'command.role_pio',
  [IncidentRoleType.StagingAreaManager]: 'command.role_staging',
  [IncidentRoleType.TriageOfficer]: 'command.role_triage',
  [IncidentRoleType.TransportOfficer]: 'command.role_transport',
  [IncidentRoleType.RehabOfficer]: 'command.role_rehab',
};

/** Standard NIMS/ICS position titles — fallback labels for roles without a translation key. */
const ICS_ROLE_DEFAULT_NAMES: Record<IncidentRoleType, string> = {
  [IncidentRoleType.IncidentCommander]: 'Incident Commander',
  [IncidentRoleType.DeputyIncidentCommander]: 'Deputy Incident Commander',
  [IncidentRoleType.UnifiedCommandMember]: 'Unified Command Member',
  [IncidentRoleType.OperationsSectionChief]: 'Operations Section Chief',
  [IncidentRoleType.PlanningSectionChief]: 'Planning Section Chief',
  [IncidentRoleType.LogisticsSectionChief]: 'Logistics Section Chief',
  [IncidentRoleType.FinanceAdminSectionChief]: 'Finance/Admin Section Chief',
  [IncidentRoleType.SafetyOfficer]: 'Safety Officer',
  [IncidentRoleType.LiaisonOfficer]: 'Liaison Officer',
  [IncidentRoleType.PublicInformationOfficer]: 'Public Information Officer',
  [IncidentRoleType.StagingAreaManager]: 'Staging Area Manager',
  [IncidentRoleType.ResourcesUnitLeader]: 'Resources Unit Leader',
  [IncidentRoleType.SituationUnitLeader]: 'Situation Unit Leader',
  [IncidentRoleType.DocumentationUnitLeader]: 'Documentation Unit Leader',
  [IncidentRoleType.CommunicationsUnitLeader]: 'Communications Unit Leader',
  [IncidentRoleType.DivisionGroupSupervisor]: 'Division/Group Supervisor',
  [IncidentRoleType.BranchDirector]: 'Branch Director',
  [IncidentRoleType.StrikeTeamTaskForceLeader]: 'Strike Team/Task Force Leader',
  [IncidentRoleType.MedicalUnitLeader]: 'Medical Unit Leader',
  [IncidentRoleType.RehabOfficer]: 'Rehab Officer',
  [IncidentRoleType.MedicalBranchDirector]: 'Medical Branch Director',
  [IncidentRoleType.TriageOfficer]: 'Triage Officer',
  [IncidentRoleType.TreatmentOfficer]: 'Treatment Officer',
  [IncidentRoleType.TransportOfficer]: 'Transport Officer',
  [IncidentRoleType.HazMatGroupSupervisor]: 'HazMat Group Supervisor',
  [IncidentRoleType.DeconOfficer]: 'Decon Officer',
  [IncidentRoleType.EntryTeamLeader]: 'Entry Team Leader',
  [IncidentRoleType.SearchGroupSupervisor]: 'Search Group Supervisor',
  [IncidentRoleType.AirOperationsBranchDirector]: 'Air Operations Branch Director',
  [IncidentRoleType.ShelterMassCareCoordinator]: 'Shelter/Mass Care Coordinator',
  [IncidentRoleType.DamageAssessmentLead]: 'Damage Assessment Lead',
};

/** Roles offered as quick preset chips when assigning (core command + common field positions). */
export const ICS_ROLE_PRESETS: IncidentRoleType[] = [
  IncidentRoleType.IncidentCommander,
  IncidentRoleType.SafetyOfficer,
  IncidentRoleType.OperationsSectionChief,
  IncidentRoleType.PlanningSectionChief,
  IncidentRoleType.LogisticsSectionChief,
  IncidentRoleType.FinanceAdminSectionChief,
  IncidentRoleType.PublicInformationOfficer,
  IncidentRoleType.LiaisonOfficer,
  IncidentRoleType.StagingAreaManager,
  IncidentRoleType.TriageOfficer,
  IncidentRoleType.TransportOfficer,
  IncidentRoleType.RehabOfficer,
];

/** Resolve the display name for an ICS role — translated when a key exists, standard NIMS title otherwise. */
export const getIncidentRoleName = (t: TFunction, roleType: IncidentRoleType): string => {
  const key = ICS_ROLE_I18N_KEYS[roleType];
  if (key) {
    return t(key);
  }
  return ICS_ROLE_DEFAULT_NAMES[roleType] ?? `Role ${roleType}`;
};

/** i18n keys for ICS structural lane types. */
const NODE_TYPE_I18N_KEYS: Record<CommandNodeType, string> = {
  [CommandNodeType.Division]: 'command.node_division',
  [CommandNodeType.Group]: 'command.node_group',
  [CommandNodeType.Branch]: 'command.node_branch',
  [CommandNodeType.Sector]: 'command.node_sector',
  [CommandNodeType.StrikeTeam]: 'command.node_strike_team',
  [CommandNodeType.TaskForce]: 'command.node_task_force',
  [CommandNodeType.Staging]: 'command.node_staging',
  [CommandNodeType.UnifiedCommand]: 'command.node_unified_command',
};

/** All lane types offered when adding a lane. */
export const COMMAND_NODE_TYPES: CommandNodeType[] = [
  CommandNodeType.Division,
  CommandNodeType.Group,
  CommandNodeType.Branch,
  CommandNodeType.Sector,
  CommandNodeType.StrikeTeam,
  CommandNodeType.TaskForce,
  CommandNodeType.Staging,
  CommandNodeType.UnifiedCommand,
];

export const getCommandNodeTypeName = (t: TFunction, nodeType: CommandNodeType): string => {
  const key = NODE_TYPE_I18N_KEYS[nodeType];
  return key ? t(key) : `Node ${nodeType}`;
};

/** i18n keys for tactical objective types. */
const OBJECTIVE_TYPE_I18N_KEYS: Record<TacticalObjectiveType, string> = {
  [TacticalObjectiveType.General]: 'command.objective_general',
  [TacticalObjectiveType.Benchmark]: 'command.objective_benchmark',
  [TacticalObjectiveType.Safety]: 'command.objective_safety',
};

export const OBJECTIVE_TYPES: TacticalObjectiveType[] = [TacticalObjectiveType.General, TacticalObjectiveType.Benchmark, TacticalObjectiveType.Safety];

export const getObjectiveTypeName = (t: TFunction, objectiveType: TacticalObjectiveType): string => {
  const key = OBJECTIVE_TYPE_I18N_KEYS[objectiveType];
  return key ? t(key) : `Objective ${objectiveType}`;
};

/** i18n keys for incident need categories. */
const NEED_CATEGORY_I18N_KEYS: Record<IncidentNeedCategory, string> = {
  [IncidentNeedCategory.Resource]: 'command.need_category_resource',
  [IncidentNeedCategory.Logistics]: 'command.need_category_logistics',
  [IncidentNeedCategory.Medical]: 'command.need_category_medical',
  [IncidentNeedCategory.Equipment]: 'command.need_category_equipment',
  [IncidentNeedCategory.Staffing]: 'command.need_category_staffing',
  [IncidentNeedCategory.Other]: 'command.need_category_other',
  [IncidentNeedCategory.Entity]: 'command.need_category_entity',
};

export const NEED_CATEGORIES: IncidentNeedCategory[] = [
  IncidentNeedCategory.Resource,
  IncidentNeedCategory.Logistics,
  IncidentNeedCategory.Medical,
  IncidentNeedCategory.Equipment,
  IncidentNeedCategory.Staffing,
  IncidentNeedCategory.Other,
  IncidentNeedCategory.Entity,
];

export const getNeedCategoryName = (t: TFunction, category: IncidentNeedCategory): string => {
  const key = NEED_CATEGORY_I18N_KEYS[category];
  return key ? t(key) : `Category ${category}`;
};

/** i18n keys for incident need fulfillment statuses. */
const NEED_STATUS_I18N_KEYS: Record<IncidentNeedStatus, string> = {
  [IncidentNeedStatus.Open]: 'command.need_open',
  [IncidentNeedStatus.PartiallyMet]: 'command.need_partially_met',
  [IncidentNeedStatus.Met]: 'command.need_met',
  [IncidentNeedStatus.Cancelled]: 'command.need_cancelled',
};

export const getNeedStatusName = (t: TFunction, status: IncidentNeedStatus): string => {
  const key = NEED_STATUS_I18N_KEYS[status];
  return key ? t(key) : `Status ${status}`;
};

/** Badge action color for a need's fulfillment status. */
export const getNeedStatusBadgeAction = (status: IncidentNeedStatus): 'success' | 'warning' | 'error' | 'muted' | 'info' => {
  switch (status) {
    case IncidentNeedStatus.Met:
      return 'success';
    case IncidentNeedStatus.PartiallyMet:
      return 'warning';
    case IncidentNeedStatus.Cancelled:
      return 'muted';
    default:
      return 'info';
  }
};

/** Badge action color for a PAR/accountability status from the server. */
export const getParBadgeAction = (status: string): 'success' | 'warning' | 'error' | 'muted' => {
  switch (status) {
    case 'Green':
      return 'success';
    case 'Warning':
      return 'warning';
    case 'Critical':
      return 'error';
    default:
      return 'muted';
  }
};
