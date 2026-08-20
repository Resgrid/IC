import { type TFunction } from 'i18next';

import { IncidentNeedCategory, IncidentNeedStatus, IncidentRoleType, ResourceAssignmentKind, TacticalObjectiveStatus } from '@/models/v4/incidentCommand/incidentCommandModels';
import en from '@/translations/en.json';

import { answerChecklist, answerNeeds, answerObjectives, answerPar, answerResources, answerRoles, answerSpanOfControl, answerStatus, answerTimeline, type IncidentAnswerContext } from '../answerers';

/**
 * Renders against the real en.json so the tests double as a check that every key the answers use
 * actually exists — a missing key falls through to the key name and fails the assertion.
 */
const t = ((key: string, options?: Record<string, unknown>): string => {
  const value = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), en);
  if (typeof value !== 'string') {
    return key;
  }
  return value.replace(/{{(\w+)}}/g, (_match, name: string) => String(options?.[name] ?? ''));
}) as unknown as TFunction;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const buildContext = (overrides: Partial<IncidentAnswerContext> = {}): IncidentAnswerContext => ({
  board: {
    Command: {
      IncidentCommandId: 'cmd-1',
      DepartmentId: 1,
      CallId: 42,
      EstablishedByUserId: 'user-1',
      EstablishedOn: minutesAgo(35),
      CurrentCommanderUserId: 'user-1',
      Name: null,
      CommandPostLocationText: 'Alpha side, Main St',
      StagingLocationText: null,
      IcsLevel: 1,
      Status: 0,
    },
    Nodes: [
      { CommandStructureNodeId: 'node-1', IncidentCommandId: 'cmd-1', DepartmentId: 1, CallId: 42, NodeType: 0, Name: 'Division A', SortOrder: 0, PrimaryLeadUserId: 'user-2', MaxUnits: 0, MinUnits: 0 },
      { CommandStructureNodeId: 'node-2', IncidentCommandId: 'cmd-1', DepartmentId: 1, CallId: 42, NodeType: 1, Name: 'Search Group', SortOrder: 1, MaxUnits: 0, MinUnits: 0 },
    ],
    Assignments: [
      {
        ResourceAssignmentId: 'a-1',
        IncidentCommandId: 'cmd-1',
        DepartmentId: 1,
        CallId: 42,
        CommandStructureNodeId: 'node-1',
        ResourceKind: ResourceAssignmentKind.RealUnit,
        ResourceId: 'unit-1',
        AssignedByUserId: 'user-1',
        AssignedOn: minutesAgo(20),
        RequirementsWarning: false,
      },
      {
        ResourceAssignmentId: 'a-2',
        IncidentCommandId: 'cmd-1',
        DepartmentId: 1,
        CallId: 42,
        CommandStructureNodeId: '',
        ResourceKind: ResourceAssignmentKind.RealPersonnel,
        ResourceId: 'user-3',
        AssignedByUserId: 'user-1',
        AssignedOn: minutesAgo(5),
        RequirementsWarning: false,
      },
    ],
    Objectives: [
      {
        TacticalObjectiveId: 'obj-1',
        IncidentCommandId: 'cmd-1',
        DepartmentId: 1,
        CallId: 42,
        Name: 'Primary search all clear',
        ObjectiveType: 1,
        Status: TacticalObjectiveStatus.Complete,
        AutoPopulated: false,
        ProgressPercent: 100,
        Priority: 0,
        SortOrder: 0,
      },
      {
        TacticalObjectiveId: 'obj-2',
        IncidentCommandId: 'cmd-1',
        DepartmentId: 1,
        CallId: 42,
        Name: 'Water supply established',
        ObjectiveType: 1,
        Status: TacticalObjectiveStatus.InProgress,
        AutoPopulated: false,
        ProgressPercent: 50,
        Priority: 0,
        SortOrder: 1,
      },
    ],
    Needs: [
      {
        IncidentNeedId: 'need-1',
        IncidentCommandId: 'cmd-1',
        DepartmentId: 1,
        CallId: 42,
        Name: 'Second alarm engine',
        Category: IncidentNeedCategory.Resource,
        Status: IncidentNeedStatus.Open,
        QuantityRequested: 2,
        QuantityFulfilled: 1,
        Priority: 5,
        CreatedOn: minutesAgo(12),
        SortOrder: 0,
      },
    ],
    Timers: [],
    Annotations: [],
    Accountability: [
      { UserId: 'user-2', FullName: 'Dana Cross', NeedsCheckIn: false, MinutesRemaining: 12, Status: 'Green', DurationMinutes: 20, WarningThresholdMinutes: 5 },
      { UserId: 'user-3', FullName: 'Sam Ortiz', NeedsCheckIn: true, MinutesRemaining: -6, Status: 'Critical', DurationMinutes: 20, WarningThresholdMinutes: 5 },
    ],
    Roles: [
      {
        IncidentRoleAssignmentId: 'role-1',
        IncidentCommandId: 'cmd-1',
        DepartmentId: 1,
        CallId: 42,
        UserId: 'user-2',
        RoleType: IncidentRoleType.SafetyOfficer,
        AssignedByUserId: 'user-1',
        AssignedOn: minutesAgo(30),
      },
    ],
    Notes: [],
  } as IncidentAnswerContext['board'],
  adHocUnits: [],
  adHocPersonnel: [],
  timeline: [
    { CommandLogEntryId: 'log-1', IncidentCommandId: 'cmd-1', DepartmentId: 1, CallId: 42, EntryType: 0, Description: 'Command established', UserId: 'user-1', OccurredOn: minutesAgo(35) },
    { CommandLogEntryId: 'log-2', IncidentCommandId: 'cmd-1', DepartmentId: 1, CallId: 42, EntryType: 5, Description: 'Engine 1 assigned to Division A', UserId: 'user-1', OccurredOn: minutesAgo(2) },
  ],
  callName: 'Structure fire',
  callNumber: '26-1',
  callAddress: '123 Main St',
  callType: 'Structure Fire',
  callNature: 'Smoke showing from the second floor',
  resolveUserName: (userId) => ({ 'user-1': 'Alex Reed', 'user-2': 'Dana Cross', 'user-3': 'Sam Ortiz' })[userId] ?? userId,
  resolveUnitName: (unitId) => ({ 'unit-1': 'Engine 1' })[unitId] ?? unitId,
  ...overrides,
});

describe('incident assistant answers', () => {
  it('reports accountability with the overdue member named', () => {
    const answer = answerPar(buildContext(), t);

    expect(answer).toContain('PAR for Structure fire (26-1)');
    expect(answer).toContain('Overdue');
    expect(answer).toContain('Sam Ortiz');
    expect(answer).toContain('6 min overdue');
  });

  it('says plainly when nothing is being tracked rather than implying everyone is fine', () => {
    const context = buildContext();
    context.board!.Accountability = [];

    expect(answerPar(context, t)).toContain('No personnel accountability is being tracked');
  });

  it('summarizes resources by lane and flags the unassigned pool', () => {
    const answer = answerResources(buildContext(), t);

    expect(answer).toContain('1 units and 1 personnel working');
    expect(answer).toContain('Division A');
    expect(answer).toContain('Engine 1');
    expect(answer).toContain('Unassigned pool: 1');
  });

  it('answers a lane-scoped question with the lane lead and time in lane', () => {
    const answer = answerResources(buildContext(), t, 'Division A');

    expect(answer).toContain('Division A');
    expect(answer).toContain('Dana Cross');
    expect(answer).toContain('Engine 1');
    expect(answer).toContain('in lane');
  });

  it('refuses to answer about a different lane of the same type when the one asked for is missing', () => {
    const answer = answerResources(buildContext(), t, 'Division Z');

    expect(answer).toContain("I don't see a lane called");
    expect(answer).toContain('Division Z');
    // It lists what does exist rather than silently reporting Division A's crews.
    expect(answer).toContain('Division A, Search Group');
    expect(answer).not.toContain('Engine 1');
  });

  it('still resolves a bare ICS type with no designator', () => {
    const context = buildContext();
    context.board!.Nodes = [{ CommandStructureNodeId: 'node-9', IncidentCommandId: 'cmd-1', DepartmentId: 1, CallId: 42, NodeType: 6, Name: 'Level 1 Stage', SortOrder: 0 }];
    context.board!.Assignments = [];

    expect(answerResources(context, t, 'staging')).toContain('Level 1 Stage');
  });

  it('passes span of control when every lane is inside its limits', () => {
    expect(answerSpanOfControl(buildContext(), t)).toContain('Span of control looks reasonable');
  });

  it('flags a lane over the NIMS ceiling and a lane with no lead', () => {
    const context = buildContext();
    context.board!.Assignments = Array.from({ length: 9 }, (_unused, index) => ({
      ResourceAssignmentId: `a-${index}`,
      IncidentCommandId: 'cmd-1',
      DepartmentId: 1,
      CallId: 42,
      CommandStructureNodeId: 'node-2',
      ResourceKind: ResourceAssignmentKind.RealUnit,
      ResourceId: `unit-${index}`,
      AssignedByUserId: 'user-1',
      AssignedOn: minutesAgo(10),
      RequirementsWarning: false,
    }));

    const answer = answerSpanOfControl(context, t);
    expect(answer).toContain('Search Group is carrying 9 resources');
    expect(answer).toContain('No lead assigned: Search Group');
  });

  it('lists open objectives and the doctrine benchmarks not yet on the board', () => {
    const answer = answerObjectives(buildContext(), t);

    expect(answer).toContain('1 of 2 objectives complete');
    expect(answer).toContain('Water supply established');
    // The structure-fire playbook is inferred from the call, and its benchmarks are checked against
    // the board — "360 complete" isn't there, so it should be surfaced.
    expect(answer).toContain('Structure fire benchmarks not on the board yet');
    expect(answer).toContain('360 complete');
    // "Primary search all clear" IS on the board and must not be reported missing.
    expect(answer).not.toContain('Primary search all clear:');
  });

  it('reports outstanding needs with their fill quantity', () => {
    const answer = answerNeeds(buildContext(), t);

    expect(answer).toContain('1 needs outstanding');
    expect(answer).toContain('Second alarm engine');
    expect(answer).toContain('1/2');
  });

  it('reads zone-less UTC timestamps as UTC, not device-local time (need age)', () => {
    // The API serialises these fields without a trailing "Z"; the value is still UTC.
    const context = buildContext();
    context.board!.Needs![0]!.CreatedOn = minutesAgo(12).replace(/\.\d{3}Z$/, '');

    expect(answerNeeds(context, t)).toContain('12m');
  });

  it('answers a specific ICS position lookup', () => {
    expect(answerRoles(buildContext(), t, 'safety officer')).toContain('Dana Cross');
    expect(answerRoles(buildContext(), t, 'staging area manager')).toContain('No Staging Area Manager is assigned');
  });

  it('answers a RIT question from the structure rather than the role list', () => {
    expect(answerRoles(buildContext(), t, 'rit')).toContain("I don't see a RIT/RIC lane");

    const context = buildContext();
    context.board!.Nodes = [...context.board!.Nodes, { CommandStructureNodeId: 'node-3', IncidentCommandId: 'cmd-1', DepartmentId: 1, CallId: 42, NodeType: 1, Name: 'RIT', SortOrder: 2 }];
    expect(answerRoles(context, t, 'rit')).toContain('RIT is standing by');
  });

  it('lists the positions this incident type still needs filled', () => {
    const answer = answerRoles(buildContext(), t);

    expect(answer).toContain('Incident Commander: Alex Reed');
    expect(answer).toContain('Unfilled positions a Structure fire usually needs');
  });

  it('reads the incident log for a time window', () => {
    const answer = answerTimeline(buildContext(), t, 10);

    expect(answer).toContain('Engine 1 assigned to Division A');
    expect(answer).not.toContain('Command established');
  });

  it('says nothing was logged in a window rather than showing older entries', () => {
    expect(answerTimeline(buildContext(), t, 1)).toContain('Nothing has been logged in the last 1 minutes');
  });

  it('ticks the checklist items the board proves and prompts for the rest', () => {
    const answer = answerChecklist(buildContext(), t);

    expect(answer).toContain('Structure fire checklist');
    expect(answer).toContain('Safety Officer assigned');
    expect(answer).toContain('Not showing on the board yet');
    expect(answer).toContain('Staging designated');
    // Guidance, never an order.
    expect(answer).toContain('not your department');
  });

  it('honours an explicitly named incident type over the inferred one', () => {
    expect(answerChecklist(buildContext(), t, 'mci')).toContain('Mass casualty incident checklist');
  });

  it('gives a status snapshot with elapsed time and counts', () => {
    const answer = answerStatus(buildContext(), t);

    expect(answer).toContain('123 Main St');
    expect(answer).toContain('Command running 35m');
    expect(answer).toContain('IC: Alex Reed');
    expect(answer).toContain('PAR: 2 tracked, 1 overdue');
  });
});
