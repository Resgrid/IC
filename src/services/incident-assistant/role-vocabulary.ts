/**
 * Maps the words an Incident Commander actually says ("safety", "ops", "staging manager", "RIT") onto
 * `IncidentRoleType`. On-device mirror of Core's `IncidentRoleVocabulary` so a role question resolves
 * the same way with or without a connection.
 *
 * English-only, matching the intent matcher: the aliases are radio shorthand, not UI copy.
 */

import { IncidentRoleType } from '@/models/v4/incidentCommand/incidentCommandModels';

/**
 * Matched longest-first (see `ALIASES`) so "operations section chief" wins over "ops", "medical
 * branch director" over "branch director", and "air ops" over "ops". Declaration order here is for
 * readability only — the length ordering is enforced below, not assumed.
 */
const ALIAS_SOURCE: [string, IncidentRoleType][] = [
  ['deputy incident commander', IncidentRoleType.DeputyIncidentCommander],
  ['deputy ic', IncidentRoleType.DeputyIncidentCommander],
  ['deputy', IncidentRoleType.DeputyIncidentCommander],
  ['unified command', IncidentRoleType.UnifiedCommandMember],
  ['incident commander', IncidentRoleType.IncidentCommander],
  ['operations section chief', IncidentRoleType.OperationsSectionChief],
  ['operations chief', IncidentRoleType.OperationsSectionChief],
  ['operations', IncidentRoleType.OperationsSectionChief],
  ['ops chief', IncidentRoleType.OperationsSectionChief],
  ['ops', IncidentRoleType.OperationsSectionChief],
  ['planning section chief', IncidentRoleType.PlanningSectionChief],
  ['planning chief', IncidentRoleType.PlanningSectionChief],
  ['planning', IncidentRoleType.PlanningSectionChief],
  ['logistics section chief', IncidentRoleType.LogisticsSectionChief],
  ['logistics chief', IncidentRoleType.LogisticsSectionChief],
  ['logistics', IncidentRoleType.LogisticsSectionChief],
  ['finance admin section chief', IncidentRoleType.FinanceAdminSectionChief],
  ['finance section chief', IncidentRoleType.FinanceAdminSectionChief],
  ['finance', IncidentRoleType.FinanceAdminSectionChief],
  ['safety officer', IncidentRoleType.SafetyOfficer],
  ['safety', IncidentRoleType.SafetyOfficer],
  ['public information officer', IncidentRoleType.PublicInformationOfficer],
  ['pio', IncidentRoleType.PublicInformationOfficer],
  ['liaison officer', IncidentRoleType.LiaisonOfficer],
  ['liaison', IncidentRoleType.LiaisonOfficer],
  ['staging area manager', IncidentRoleType.StagingAreaManager],
  ['staging manager', IncidentRoleType.StagingAreaManager],
  ['resources unit leader', IncidentRoleType.ResourcesUnitLeader],
  ['resource unit leader', IncidentRoleType.ResourcesUnitLeader],
  ['situation unit leader', IncidentRoleType.SituationUnitLeader],
  ['documentation unit leader', IncidentRoleType.DocumentationUnitLeader],
  ['communications unit leader', IncidentRoleType.CommunicationsUnitLeader],
  ['comms unit leader', IncidentRoleType.CommunicationsUnitLeader],
  ['division supervisor', IncidentRoleType.DivisionGroupSupervisor],
  ['group supervisor', IncidentRoleType.DivisionGroupSupervisor],
  ['branch director', IncidentRoleType.BranchDirector],
  ['strike team leader', IncidentRoleType.StrikeTeamTaskForceLeader],
  ['task force leader', IncidentRoleType.StrikeTeamTaskForceLeader],
  ['medical branch director', IncidentRoleType.MedicalBranchDirector],
  ['medical unit leader', IncidentRoleType.MedicalUnitLeader],
  ['rehab officer', IncidentRoleType.RehabOfficer],
  ['rehab', IncidentRoleType.RehabOfficer],
  ['triage officer', IncidentRoleType.TriageOfficer],
  ['triage', IncidentRoleType.TriageOfficer],
  ['treatment officer', IncidentRoleType.TreatmentOfficer],
  ['treatment', IncidentRoleType.TreatmentOfficer],
  ['transport officer', IncidentRoleType.TransportOfficer],
  ['transport', IncidentRoleType.TransportOfficer],
  ['hazmat group supervisor', IncidentRoleType.HazMatGroupSupervisor],
  ['hazmat supervisor', IncidentRoleType.HazMatGroupSupervisor],
  ['decon officer', IncidentRoleType.DeconOfficer],
  ['decon', IncidentRoleType.DeconOfficer],
  ['entry team leader', IncidentRoleType.EntryTeamLeader],
  ['search group supervisor', IncidentRoleType.SearchGroupSupervisor],
  ['air operations branch director', IncidentRoleType.AirOperationsBranchDirector],
  ['air operations', IncidentRoleType.AirOperationsBranchDirector],
  ['air ops', IncidentRoleType.AirOperationsBranchDirector],
  ['shelter mass care coordinator', IncidentRoleType.ShelterMassCareCoordinator],
  ['mass care coordinator', IncidentRoleType.ShelterMassCareCoordinator],
  ['shelter coordinator', IncidentRoleType.ShelterMassCareCoordinator],
  ['damage assessment lead', IncidentRoleType.DamageAssessmentLead],
  ['ic', IncidentRoleType.IncidentCommander],
  ['commander', IncidentRoleType.IncidentCommander],
];

/**
 * The alias table ordered longest-first. A shorter alias is always a substring risk for a longer one
 * ("ops" inside "air ops", "branch director" inside "medical branch director"), and relying on
 * hand-maintained declaration order to avoid that has already produced wrong answers — so the
 * ordering is computed instead.
 */
const ALIASES: [string, IncidentRoleType][] = [...ALIAS_SOURCE].sort((a, b) => b[0].length - a[0].length);

/** Terms naming a RIT/RIC — a lane on a Resgrid board rather than an ICS command position. */
const RAPID_INTERVENTION_ALIASES = ['rapid intervention team', 'rapid intervention crew', 'rapid intervention', 'rit', 'ric'];

const normalize = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');

/** Whole-word containment so "ic" doesn't match inside "medic" or "logistics". */
const containsWord = (haystack: string, needle: string): boolean => haystack === needle || haystack.startsWith(`${needle} `) || haystack.endsWith(` ${needle}`) || haystack.includes(` ${needle} `);

/** Null when the text names no known ICS position. */
export const resolveIncidentRole = (text?: string | null): IncidentRoleType | null => {
  if (!text) {
    return null;
  }
  const needle = normalize(text);
  if (!needle) {
    return null;
  }

  const hit = ALIASES.find(([alias]) => containsWord(needle, alias));
  return hit ? hit[1] : null;
};

/** True when the question was about a RIT/RIC rather than a command position. */
export const isRapidInterventionQuery = (text?: string | null): boolean => {
  if (!text) {
    return false;
  }
  const needle = normalize(text);
  return RAPID_INTERVENTION_ALIASES.some((alias) => containsWord(needle, alias));
};
