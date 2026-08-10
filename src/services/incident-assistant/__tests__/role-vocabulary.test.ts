import { IncidentRoleType } from '@/models/v4/incidentCommand/incidentCommandModels';

import { isRapidInterventionQuery, resolveIncidentRole } from '../role-vocabulary';

describe('resolveIncidentRole', () => {
  it.each([
    ['safety', IncidentRoleType.SafetyOfficer],
    ['safety officer', IncidentRoleType.SafetyOfficer],
    ['ops', IncidentRoleType.OperationsSectionChief],
    ['operations section chief', IncidentRoleType.OperationsSectionChief],
    ['staging manager', IncidentRoleType.StagingAreaManager],
    ['pio', IncidentRoleType.PublicInformationOfficer],
    ['ic', IncidentRoleType.IncidentCommander],
    ['decon', IncidentRoleType.DeconOfficer],
  ])('maps the radio shorthand %s', (text, expected) => {
    expect(resolveIncidentRole(text)).toBe(expected);
  });

  it.each([
    // Each of these contains a shorter alias, so they only resolve correctly when the table is
    // matched longest-first rather than in declaration order.
    ['air ops', IncidentRoleType.AirOperationsBranchDirector],
    ['air operations', IncidentRoleType.AirOperationsBranchDirector],
    ['medical branch director', IncidentRoleType.MedicalBranchDirector],
    ['search group supervisor', IncidentRoleType.SearchGroupSupervisor],
    ['hazmat group supervisor', IncidentRoleType.HazMatGroupSupervisor],
    ['deputy incident commander', IncidentRoleType.DeputyIncidentCommander],
  ])('prefers the longer position for %s', (text, expected) => {
    expect(resolveIncidentRole(text)).toBe(expected);
  });

  it('does not match an alias inside another word', () => {
    // "ic" must not match inside "medic"; a person's name is not a position.
    expect(resolveIncidentRole('medic')).toBeNull();
    expect(resolveIncidentRole('Jordan Rivera')).toBeNull();
    expect(resolveIncidentRole('')).toBeNull();
    expect(resolveIncidentRole(null)).toBeNull();
  });
});

describe('isRapidInterventionQuery', () => {
  it.each(['rit', 'ric', 'rapid intervention team', 'rapid intervention crew'])('recognizes %s as a lane question, not a position', (text) => {
    expect(isRapidInterventionQuery(text)).toBe(true);
    // RIT/RIC has no IncidentRoleType — it must not resolve to a command position.
    expect(resolveIncidentRole(text)).toBeNull();
  });

  it('is false for anything else', () => {
    expect(isRapidInterventionQuery('safety officer')).toBe(false);
    expect(isRapidInterventionQuery(undefined)).toBe(false);
  });
});
