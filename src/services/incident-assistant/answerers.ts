/**
 * On-device answers for command-board questions, computed from the board already cached on the
 * phone. Every function here is pure: board data in, display text out. No network, no model, no
 * device capability required — which is the point. When a scene loses coverage the commander can
 * still ask for a PAR, a resource picture, or what's outstanding and get an answer off the last
 * synced board rather than a spinner.
 *
 * Mirrors the reporting logic in Core's `IncidentBoardNarrator` so the wording matches whichever
 * side answered.
 */

import { type TFunction } from 'i18next';

import { getCommandNodeTypeName, getIncidentRoleName, getNeedCategoryName } from '@/lib/incident-command-utils';
import { IncidentTimerStatus } from '@/models/v4/incidentCommand/incidentCommandEnums';
import {
  type CommandLogEntry,
  CommandNodeType,
  type CommandStructureNode,
  type IncidentAdHocPersonnel,
  type IncidentAdHocUnit,
  type IncidentCommandBoard,
  type IncidentNeed,
  IncidentNeedStatus,
  type IncidentNote,
  IncidentRoleType,
  type IncidentTimer,
  type PersonnelCallCheckInStatus,
  type ResourceAssignment,
  ResourceAssignmentKind,
  type TacticalObjective,
  TacticalObjectiveStatus,
} from '@/models/v4/incidentCommand/incidentCommandModels';

import { checklistFor, type IncidentPlaybook, inferPlaybook, keyRolesFor, resolvePlaybook } from './ics-playbooks';
import { isRapidInterventionQuery, resolveIncidentRole } from './role-vocabulary';

/** Everything the on-device answers can read. All of it is MMKV-persisted, so all of it is offline-safe. */
export interface IncidentAnswerContext {
  board: IncidentCommandBoard | null;
  adHocUnits: IncidentAdHocUnit[];
  adHocPersonnel: IncidentAdHocPersonnel[];
  /** Incident log entries already pulled for this board (newest first). */
  timeline: CommandLogEntry[];
  callName?: string | null;
  callNumber?: string | null;
  callAddress?: string | null;
  callType?: string | null;
  callNature?: string | null;
  /** Resolves a Resgrid user id to a display name (falls back to the id). */
  resolveUserName: (userId: string) => string;
  /** Resolves a Resgrid unit id to its name (falls back to the id). */
  resolveUnitName: (unitId: string) => string;
}

/** NIMS guidance: a supervisor should manage between three and seven resources. */
const SPAN_OF_CONTROL_CEILING = 7;

/** Cap on any single list so an answer stays readable on a phone at 2am. */
const MAX_LIST_ITEMS = 25;

const DEFAULT_TIMELINE_ENTRIES = 10;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export const incidentLabel = (context: IncidentAnswerContext, t: TFunction): string => {
  const name = context.board?.Command?.Name || context.callName || t('incident_assistant.this_incident');
  return context.callNumber ? `${name} (${context.callNumber})` : name;
};

/** Radio-friendly duration: "1h 12m" / "23m" / "45s". */
export const formatDuration = (milliseconds: number): string => {
  const total = Math.abs(milliseconds);
  const seconds = Math.floor(total / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const elapsedSince = (iso?: string | null): number => {
  if (!iso) {
    return 0;
  }
  const parsed = new Date(iso).getTime();
  return Number.isNaN(parsed) ? 0 : Date.now() - parsed;
};

const liveNodes = (board: IncidentCommandBoard): CommandStructureNode[] => (board.Nodes ?? []).filter((n) => !n.DeletedOn).sort((a, b) => a.SortOrder - b.SortOrder);

const liveAssignments = (board: IncidentCommandBoard): ResourceAssignment[] => (board.Assignments ?? []).filter((a) => !a.ReleasedOn);

const isUnitKind = (kind: number): boolean => kind === ResourceAssignmentKind.RealUnit || kind === ResourceAssignmentKind.LinkedDeptUnit || kind === ResourceAssignmentKind.AdHocUnit;

const isCriticalPar = (row: PersonnelCallCheckInStatus): boolean => row.Status === 'Critical' || row.NeedsCheckIn;

const isWarningPar = (row: PersonnelCallCheckInStatus): boolean => !isCriticalPar(row) && row.Status === 'Warning';

const parBuckets = (board: IncidentCommandBoard) => {
  const rows = board.Accountability ?? [];
  return { total: rows.length, warning: rows.filter(isWarningPar).length, critical: rows.filter(isCriticalPar).length };
};

const truncate = (value: string | null | undefined, max: number): string => {
  const text = (value ?? '').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};

/** Playbook for the incident, from an explicit override or inferred from the call. */
export const playbookFor = (context: IncidentAnswerContext, override?: string | null): IncidentPlaybook =>
  resolvePlaybook(override) ?? inferPlaybook([context.board?.Command?.Name, context.callType, context.callName, context.callNature]);

const resourceLabel = (assignment: ResourceAssignment, context: IncidentAnswerContext): string => {
  if (assignment.ResourceKind === ResourceAssignmentKind.RealUnit || assignment.ResourceKind === ResourceAssignmentKind.LinkedDeptUnit) {
    return context.resolveUnitName(assignment.ResourceId);
  }
  if (assignment.ResourceKind === ResourceAssignmentKind.RealPersonnel || assignment.ResourceKind === ResourceAssignmentKind.LinkedDeptPersonnel) {
    return context.resolveUserName(assignment.ResourceId);
  }
  if (assignment.ResourceKind === ResourceAssignmentKind.AdHocUnit) {
    return context.adHocUnits.find((u) => u.IncidentAdHocUnitId === assignment.ResourceId)?.Name ?? assignment.ResourceId;
  }
  return context.adHocPersonnel.find((p) => p.IncidentAdHocPersonnelId === assignment.ResourceId)?.Name ?? assignment.ResourceId;
};

const laneLead = (node: CommandStructureNode, context: IncidentAnswerContext): string | null => {
  if (node.PrimaryLeadUserId) {
    return context.resolveUserName(node.PrimaryLeadUserId);
  }
  if (node.PrimaryLeadName) {
    return node.PrimaryLeadName;
  }
  return node.SupervisorUserId ? context.resolveUserName(node.SupervisorUserId) : null;
};

/** Exact lane name first, then containment either way, then a unique ICS node-type match. */
const matchNode = (nodes: CommandStructureNode[], laneName: string, t: TFunction): CommandStructureNode | null => {
  const needle = laneName.trim().toLowerCase();
  if (!needle) {
    return null;
  }

  const exact = nodes.find((n) => (n.Name ?? '').toLowerCase() === needle);
  if (exact) {
    return exact;
  }

  const contains = nodes.find((n) => {
    const name = (n.Name ?? '').toLowerCase();
    return name.length > 0 && (name.includes(needle) || needle.includes(name));
  });
  if (contains) {
    return contains;
  }

  // Last resort: the commander named an ICS type with no designator ("who's in staging"). The needle
  // must be a substring OF the type word, never the other way round — "Division Z" must NOT resolve
  // to Division A just because both are Divisions. Answering about the wrong lane on a fireground is
  // worse than saying the lane isn't there.
  const byType = nodes.filter((n) => {
    const typeName = getCommandNodeTypeName(t, n.NodeType).toLowerCase();
    return typeName.length > 0 && typeName.includes(needle);
  });

  return byType.length === 1 ? byType[0] : null;
};

/**
 * Loose benchmark matching so "Primary all clear" still counts as the "Primary search all clear"
 * benchmark rather than being reported missing on a technicality.
 */
const looseMatch = (objectiveName: string | null | undefined, benchmark: string): boolean => {
  const a = (objectiveName ?? '').toLowerCase();
  const b = benchmark.toLowerCase();
  if (!a || !b) {
    return false;
  }
  if (a.includes(b) || b.includes(a)) {
    return true;
  }

  const words = b.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) {
    return false;
  }

  const hits = words.filter((w) => a.includes(w)).length;
  return hits >= Math.max(1, words.length - 1);
};

const formatObjective = (objective: TacticalObjective, t: TFunction): string => {
  const status =
    objective.Status === TacticalObjectiveStatus.Complete
      ? t('incident_assistant.objective_complete')
      : objective.Status === TacticalObjectiveStatus.InProgress
        ? t('incident_assistant.objective_in_progress')
        : t('incident_assistant.objective_pending');

  const overdue = objective.TargetCompleteOn && objective.Status !== TacticalObjectiveStatus.Complete && new Date(objective.TargetCompleteOn).getTime() < Date.now();

  return t('incident_assistant.objective_row', {
    name: objective.Name,
    status,
    progress: objective.ProgressPercent,
    overdue: overdue ? t('incident_assistant.objective_overdue') : '',
  });
};

const localTime = (iso?: string | null): string => {
  if (!iso) {
    return '';
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString();
};

const join = (lines: (string | null | undefined)[]): string => lines.filter((line): line is string => typeof line === 'string' && line.length > 0).join('\n');

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export const answerStatus = (context: IncidentAnswerContext, t: TFunction): string => {
  const board = context.board!;
  const command = board.Command;
  const nodes = liveNodes(board);
  const assignments = liveAssignments(board);
  const units = assignments.filter((a) => isUnitKind(a.ResourceKind)).length;
  const par = parBuckets(board);
  const objectives = board.Objectives ?? [];
  const openNeeds = (board.Needs ?? []).filter((n) => n.Status === IncidentNeedStatus.Open || n.Status === IncidentNeedStatus.PartiallyMet).length;

  return join([
    context.callAddress ? `${incidentLabel(context, t)} — ${context.callAddress}` : incidentLabel(context, t),
    t('incident_assistant.elapsed', { duration: formatDuration(elapsedSince(command.EstablishedOn)) }),
    command.CurrentCommanderUserId ? t('incident_assistant.commander', { name: context.resolveUserName(command.CurrentCommanderUserId) }) : null,
    command.CommandPostLocationText ? t('incident_assistant.command_post', { location: command.CommandPostLocationText }) : null,
    command.StagingLocationText ? t('incident_assistant.staging', { location: command.StagingLocationText }) : null,
    t('incident_assistant.resource_counts', { units, personnel: assignments.length - units, lanes: nodes.length, unassigned: assignments.filter((a) => !a.CommandStructureNodeId).length }),
    par.total > 0 ? t('incident_assistant.par_summary', { total: par.total, critical: par.critical, warning: par.warning }) : null,
    objectives.length > 0 ? t('incident_assistant.objective_summary', { complete: objectives.filter((o) => o.Status === TacticalObjectiveStatus.Complete).length, total: objectives.length }) : null,
    openNeeds > 0 ? t('incident_assistant.open_needs', { count: openNeeds }) : null,
    command.ImportantInformation ? t('incident_assistant.important', { text: truncate(command.ImportantInformation, 240) }) : null,
    command.EstimatedEndOn ? t('incident_assistant.estimated_end', { time: new Date(command.EstimatedEndOn).toLocaleString() }) : null,
  ]);
};

export const answerPar = (context: IncidentAnswerContext, t: TFunction): string => {
  const rows = context.board!.Accountability ?? [];
  if (rows.length === 0) {
    return t('incident_assistant.par_none', { incident: incidentLabel(context, t) });
  }

  const critical = rows.filter(isCriticalPar).sort((a, b) => a.MinutesRemaining - b.MinutesRemaining);
  const warning = rows.filter(isWarningPar).sort((a, b) => a.MinutesRemaining - b.MinutesRemaining);

  return join([
    t('incident_assistant.par_header', { incident: incidentLabel(context, t), count: rows.length }),
    t('incident_assistant.par_counts', { green: rows.length - critical.length - warning.length, warning: warning.length, critical: critical.length }),
    critical.length > 0 ? t('incident_assistant.par_critical_header') : null,
    ...critical.slice(0, MAX_LIST_ITEMS).map((row) => t('incident_assistant.par_overdue_row', { name: row.FullName || row.UserId, minutes: Math.abs(Math.round(row.MinutesRemaining)) })),
    warning.length > 0 ? t('incident_assistant.par_warning_header') : null,
    ...warning.slice(0, MAX_LIST_ITEMS).map((row) => t('incident_assistant.par_due_row', { name: row.FullName || row.UserId, minutes: Math.max(0, Math.round(row.MinutesRemaining)) })),
    critical.length === 0 && warning.length === 0 ? t('incident_assistant.par_all_good') : null,
  ]);
};

export const answerResources = (context: IncidentAnswerContext, t: TFunction, laneName?: string): string => {
  const board = context.board!;
  const nodes = liveNodes(board);
  const assignments = liveAssignments(board);

  if (laneName && laneName.trim().toLowerCase() === 'unassigned') {
    const pool = assignments.filter((a) => !a.CommandStructureNodeId);
    if (pool.length === 0) {
      return t('incident_assistant.no_unassigned', { incident: incidentLabel(context, t) });
    }
    return join([t('incident_assistant.unassigned_header', { incident: incidentLabel(context, t), count: pool.length }), ...pool.slice(0, MAX_LIST_ITEMS).map((a) => `- ${resourceLabel(a, context)}`)]);
  }

  if (laneName) {
    const node = matchNode(nodes, laneName, t);
    if (!node) {
      return t('incident_assistant.lane_not_found', {
        lane: laneName.trim(),
        lanes: nodes.length === 0 ? t('incident_assistant.no_lanes') : nodes.map((n) => n.Name).join(', '),
      });
    }

    const inLane = assignments.filter((a) => a.CommandStructureNodeId === node.CommandStructureNodeId);
    const lead = laneLead(node, context);
    const objective = node.PrimaryObjectiveId ? (board.Objectives ?? []).find((o) => o.TacticalObjectiveId === node.PrimaryObjectiveId) : undefined;

    return join([
      t('incident_assistant.lane_header', { lane: node.Name, type: getCommandNodeTypeName(t, node.NodeType), count: inLane.length }),
      lead ? t('incident_assistant.lane_lead', { name: lead }) : null,
      inLane.length === 0 ? t('incident_assistant.lane_empty') : null,
      ...inLane.slice(0, MAX_LIST_ITEMS).map((a) => {
        const elapsed = elapsedSince(a.AssignedOn);
        return elapsed >= 60_000 ? `- ${resourceLabel(a, context)} ${t('incident_assistant.time_in_lane', { duration: formatDuration(elapsed) })}` : `- ${resourceLabel(a, context)}`;
      }),
      objective ? t('incident_assistant.lane_objective', { name: objective.Name, progress: objective.ProgressPercent }) : null,
    ]);
  }

  const external = context.adHocUnits.filter((u) => !u.ReleasedOn).length + context.adHocPersonnel.filter((p) => !p.ReleasedOn).length;
  if (assignments.length === 0 && external === 0) {
    return t('incident_assistant.no_resources', { incident: incidentLabel(context, t) });
  }

  const units = assignments.filter((a) => isUnitKind(a.ResourceKind)).length;
  const unassigned = assignments.filter((a) => !a.CommandStructureNodeId).length;

  return join([
    t('incident_assistant.resources_header', { incident: incidentLabel(context, t), units, personnel: assignments.length - units }),
    ...nodes.slice(0, MAX_LIST_ITEMS).map((node) => {
      const inLane = assignments.filter((a) => a.CommandStructureNodeId === node.CommandStructureNodeId);
      return t('incident_assistant.lane_line', {
        lane: node.Name,
        count: inLane.length,
        names: inLane
          .slice(0, 6)
          .map((a) => resourceLabel(a, context))
          .join(', '),
      });
    }),
    unassigned > 0 ? t('incident_assistant.unassigned_line', { count: unassigned }) : null,
    external > 0 ? t('incident_assistant.external_resources', { count: external }) : null,
  ]);
};

export const answerSpanOfControl = (context: IncidentAnswerContext, t: TFunction): string => {
  const board = context.board!;
  const nodes = liveNodes(board);
  const assignments = liveAssignments(board);

  if (nodes.length === 0) {
    return t('incident_assistant.no_lanes_yet', { incident: incidentLabel(context, t) });
  }

  const over: string[] = [];
  const under: string[] = [];
  const leaderless: string[] = [];

  nodes.forEach((node) => {
    const count = assignments.filter((a) => a.CommandStructureNodeId === node.CommandStructureNodeId).length;
    // The lane's own configured maximum wins when set; otherwise NIMS' ceiling of seven.
    const ceiling = node.MaxUnits && node.MaxUnits > 0 ? node.MaxUnits : SPAN_OF_CONTROL_CEILING;

    if (count > ceiling) {
      over.push(t('incident_assistant.span_over_row', { lane: node.Name, count, limit: ceiling }));
    }
    if (node.MinUnits && node.MinUnits > 0 && count < node.MinUnits) {
      under.push(t('incident_assistant.span_under_row', { lane: node.Name, count, minimum: node.MinUnits }));
    }
    if (count > 0 && !laneLead(node, context)) {
      leaderless.push(node.Name);
    }
  });

  const header = t('incident_assistant.span_header', { incident: incidentLabel(context, t), lanes: nodes.length, resources: assignments.length });

  if (over.length === 0 && under.length === 0 && leaderless.length === 0) {
    return join([header, t('incident_assistant.span_all_good', { ceiling: SPAN_OF_CONTROL_CEILING })]);
  }

  return join([header, ...over, ...under, leaderless.length > 0 ? t('incident_assistant.span_no_lead', { lanes: leaderless.join(', ') }) : null]);
};

export const answerObjectives = (context: IncidentAnswerContext, t: TFunction): string => {
  const objectives = [...(context.board!.Objectives ?? [])].sort((a, b) => a.SortOrder - b.SortOrder);
  const playbook = playbookFor(context);
  const lines: (string | null)[] = [];

  if (objectives.length === 0) {
    lines.push(t('incident_assistant.no_objectives', { incident: incidentLabel(context, t) }));
  } else {
    const open = objectives.filter((o) => o.Status !== TacticalObjectiveStatus.Complete);
    lines.push(t('incident_assistant.objectives_header', { incident: incidentLabel(context, t), complete: objectives.length - open.length, total: objectives.length }));
    open.slice(0, MAX_LIST_ITEMS).forEach((objective) => lines.push(`- ${formatObjective(objective, t)}`));
    if (open.length === 0) {
      lines.push(t('incident_assistant.objectives_all_complete'));
    }
  }

  const missing = playbook.benchmarks.filter((benchmark) => !objectives.some((o) => looseMatch(o.Name, benchmark))).slice(0, 6);
  if (missing.length > 0) {
    lines.push(t('incident_assistant.missing_benchmarks', { type: playbook.displayName, benchmarks: missing.join('; ') }));
  }

  return join(lines);
};

export const answerNeeds = (context: IncidentAnswerContext, t: TFunction): string => {
  const needs: IncidentNeed[] = context.board!.Needs ?? [];
  if (needs.length === 0) {
    return t('incident_assistant.no_needs', { incident: incidentLabel(context, t) });
  }

  const outstanding = needs
    .filter((n) => n.Status === IncidentNeedStatus.Open || n.Status === IncidentNeedStatus.PartiallyMet)
    .sort((a, b) => b.Priority - a.Priority || new Date(a.CreatedOn).getTime() - new Date(b.CreatedOn).getTime());

  const header = t('incident_assistant.needs_header', {
    incident: incidentLabel(context, t),
    outstanding: outstanding.length,
    met: needs.filter((n) => n.Status === IncidentNeedStatus.Met).length,
    cancelled: needs.filter((n) => n.Status === IncidentNeedStatus.Cancelled).length,
  });

  if (outstanding.length === 0) {
    return join([header, t('incident_assistant.needs_all_met')]);
  }

  return join([
    header,
    ...outstanding.slice(0, MAX_LIST_ITEMS).map((need) =>
      t('incident_assistant.need_row', {
        name: need.Name,
        category: getNeedCategoryName(t, need.Category),
        quantity: need.QuantityRequested > 0 ? `${need.QuantityFulfilled}/${need.QuantityRequested}` : '',
        age: formatDuration(elapsedSince(need.CreatedOn)),
      })
    ),
  ]);
};

export const answerRoles = (context: IncidentAnswerContext, t: TFunction, roleQuery?: string): string => {
  const board = context.board!;
  const active = (board.Roles ?? []).filter((r) => !r.RemovedOn);

  // RIT/RIC is a lane on a Resgrid board, not an ICS position — answer from the structure.
  if (isRapidInterventionQuery(roleQuery)) {
    const ritNode = liveNodes(board).find((n) => /\b(rit|ric)\b|rapid intervention/i.test(n.Name ?? ''));
    if (!ritNode) {
      return t('incident_assistant.no_rit', { incident: incidentLabel(context, t) });
    }
    const count = liveAssignments(board).filter((a) => a.CommandStructureNodeId === ritNode.CommandStructureNodeId).length;
    return t('incident_assistant.rit_found', { lane: ritNode.Name, count });
  }

  if (roleQuery) {
    const role = resolveIncidentRole(roleQuery);
    if (role === null) {
      return t('incident_assistant.role_unknown', { role: roleQuery.trim() });
    }

    // The Incident Commander lives on the command row itself, not in the role assignments.
    if (role === IncidentRoleType.IncidentCommander) {
      const commander = board.Command.CurrentCommanderUserId ? context.resolveUserName(board.Command.CurrentCommanderUserId) : '';
      return commander
        ? t('incident_assistant.role_filled', { role: getIncidentRoleName(t, role), name: commander })
        : t('incident_assistant.role_unfilled', { role: getIncidentRoleName(t, role), incident: incidentLabel(context, t) });
    }

    const holders = active.filter((r) => r.RoleType === role).map((r) => context.resolveUserName(r.UserId));
    return holders.length === 0
      ? t('incident_assistant.role_unfilled', { role: getIncidentRoleName(t, role), incident: incidentLabel(context, t) })
      : t('incident_assistant.role_filled', { role: getIncidentRoleName(t, role), name: holders.join(', ') });
  }

  const playbook = playbookFor(context);
  const commanderName = board.Command.CurrentCommanderUserId ? context.resolveUserName(board.Command.CurrentCommanderUserId) : '';
  const filled = new Set<IncidentRoleType>(active.map((r) => r.RoleType));
  if (commanderName) {
    filled.add(IncidentRoleType.IncidentCommander);
  }

  const unfilled = keyRolesFor(playbook).filter((role) => !filled.has(role));

  return join([
    t('incident_assistant.roles_header', { incident: incidentLabel(context, t), count: active.length }),
    commanderName ? `- ${t('incident_assistant.role_row', { role: getIncidentRoleName(t, IncidentRoleType.IncidentCommander), name: commanderName })}` : null,
    ...[...active]
      .sort((a, b) => a.RoleType - b.RoleType)
      .slice(0, MAX_LIST_ITEMS)
      .map((r) => `- ${t('incident_assistant.role_row', { role: getIncidentRoleName(t, r.RoleType), name: context.resolveUserName(r.UserId) })}`),
    unfilled.length > 0 ? t('incident_assistant.roles_unfilled', { type: playbook.displayName, roles: unfilled.map((role) => getIncidentRoleName(t, role)).join(', ') }) : null,
  ]);
};

export const answerTimeline = (context: IncidentAnswerContext, t: TFunction, minutes?: number, count?: number): string => {
  const commandId = context.board!.Command.IncidentCommandId;
  let entries = context.timeline.filter((entry) => entry.IncidentCommandId === commandId).sort((a, b) => new Date(b.OccurredOn).getTime() - new Date(a.OccurredOn).getTime());

  if (minutes && minutes > 0) {
    const cutoff = Date.now() - minutes * 60_000;
    entries = entries.filter((entry) => new Date(entry.OccurredOn).getTime() >= cutoff);
    if (entries.length === 0) {
      return t('incident_assistant.timeline_empty_window', { minutes, incident: incidentLabel(context, t) });
    }
  }

  if (entries.length === 0) {
    return t('incident_assistant.timeline_empty', { incident: incidentLabel(context, t) });
  }

  const take = Math.min(count && count > 0 ? count : DEFAULT_TIMELINE_ENTRIES, MAX_LIST_ITEMS);

  return join([
    minutes && minutes > 0
      ? t('incident_assistant.timeline_window_header', { incident: incidentLabel(context, t), minutes, count: entries.length })
      : t('incident_assistant.timeline_header', { incident: incidentLabel(context, t), count: Math.min(take, entries.length) }),
    ...entries.slice(0, take).map((entry) => {
      const who = entry.UserId ? context.resolveUserName(entry.UserId) : '';
      return t('incident_assistant.timeline_row', { time: localTime(entry.OccurredOn), description: truncate(entry.Description, 160), who: who ? ` — ${who}` : '' });
    }),
  ]);
};

export const answerTimers = (context: IncidentAnswerContext, t: TFunction): string => {
  const timers: IncidentTimer[] = (context.board!.Timers ?? [])
    // A stopped timer isn't something the commander needs read back.
    .filter((timer) => timer.Status !== IncidentTimerStatus.Stopped)
    .sort((a, b) => new Date(a.NextDueOn ?? 0).getTime() - new Date(b.NextDueOn ?? 0).getTime());

  if (timers.length === 0) {
    return t('incident_assistant.no_timers', { incident: incidentLabel(context, t) });
  }

  return join([
    t('incident_assistant.timers_header', { incident: incidentLabel(context, t), count: timers.length }),
    ...timers.slice(0, MAX_LIST_ITEMS).map((timer) => {
      if (timer.Status === IncidentTimerStatus.Due) {
        return t('incident_assistant.timer_due_row', { name: timer.Name });
      }
      const remaining = timer.NextDueOn ? new Date(timer.NextDueOn).getTime() - Date.now() : 0;
      return remaining > 0 ? t('incident_assistant.timer_running_row', { name: timer.Name, remaining: formatDuration(remaining) }) : t('incident_assistant.timer_no_due_row', { name: timer.Name });
    }),
  ]);
};

export const answerNotes = (context: IncidentAnswerContext, t: TFunction): string => {
  const notes: IncidentNote[] = (context.board!.Notes ?? []).filter((n) => !n.DeletedOn).sort((a, b) => new Date(b.CreatedOn).getTime() - new Date(a.CreatedOn).getTime());

  if (notes.length === 0) {
    return t('incident_assistant.no_notes', { incident: incidentLabel(context, t) });
  }

  return join([
    t('incident_assistant.notes_header', { incident: incidentLabel(context, t), count: notes.length }),
    ...notes.slice(0, MAX_LIST_ITEMS).map((note) =>
      t('incident_assistant.note_row', {
        time: localTime(note.CreatedOn),
        body: note.Title ? `${note.Title}: ${truncate(note.Body, 160)}` : truncate(note.Body, 200),
        who: context.resolveUserName(note.CreatedByUserId),
      })
    ),
  ]);
};

export const answerBriefing = (context: IncidentAnswerContext, t: TFunction): string => {
  const board = context.board!;
  const command = board.Command;
  const playbook = playbookFor(context);
  const nodes = liveNodes(board);
  const assignments = liveAssignments(board);
  const active = (board.Roles ?? []).filter((r) => !r.RemovedOn);
  const par = parBuckets(board);
  const objectives = [...(board.Objectives ?? [])].sort((a, b) => a.SortOrder - b.SortOrder);
  const outstanding = (board.Needs ?? []).filter((n) => n.Status === IncidentNeedStatus.Open || n.Status === IncidentNeedStatus.PartiallyMet).sort((a, b) => b.Priority - a.Priority);
  const unassigned = assignments.filter((a) => !a.CommandStructureNodeId).length;

  return join([
    t('incident_assistant.briefing_header', { incident: incidentLabel(context, t) }),
    '',
    t('incident_assistant.briefing_situation'),
    t('incident_assistant.briefing_type', { type: playbook.displayName }),
    context.callAddress ? t('incident_assistant.briefing_address', { address: context.callAddress }) : null,
    t('incident_assistant.briefing_established', { time: new Date(command.EstablishedOn).toLocaleString(), duration: formatDuration(elapsedSince(command.EstablishedOn)) }),
    command.ImportantInformation ? t('incident_assistant.briefing_important', { text: truncate(command.ImportantInformation, 400) }) : null,
    '',
    t('incident_assistant.briefing_command'),
    t('incident_assistant.briefing_commander', { name: command.CurrentCommanderUserId ? context.resolveUserName(command.CurrentCommanderUserId) : t('incident_assistant.unknown') }),
    command.CommandPostLocationText ? t('incident_assistant.briefing_icp', { location: command.CommandPostLocationText }) : null,
    command.StagingLocationText ? t('incident_assistant.briefing_staging', { location: command.StagingLocationText }) : null,
    command.RehabLocationText ? t('incident_assistant.briefing_rehab', { location: command.RehabLocationText }) : null,
    ...[...active]
      .sort((a, b) => a.RoleType - b.RoleType)
      .slice(0, MAX_LIST_ITEMS)
      .map((r) => `- ${t('incident_assistant.role_row', { role: getIncidentRoleName(t, r.RoleType), name: context.resolveUserName(r.UserId) })}`),
    '',
    t('incident_assistant.briefing_objectives'),
    objectives.length === 0 ? t('incident_assistant.briefing_no_objectives') : null,
    ...objectives.slice(0, MAX_LIST_ITEMS).map((objective) => `- ${formatObjective(objective, t)}`),
    command.IncidentActionPlan ? t('incident_assistant.briefing_action_plan', { text: truncate(command.IncidentActionPlan, 400) }) : null,
    '',
    t('incident_assistant.briefing_organization'),
    nodes.length === 0 ? t('incident_assistant.briefing_no_lanes') : null,
    ...nodes.slice(0, MAX_LIST_ITEMS).map((node) => {
      const inLane = assignments.filter((a) => a.CommandStructureNodeId === node.CommandStructureNodeId);
      return `- ${t('incident_assistant.briefing_lane_row', {
        lane: node.Name,
        lead: laneLead(node, context) ?? t('incident_assistant.no_lead'),
        count: inLane.length,
        names: inLane
          .slice(0, 6)
          .map((a) => resourceLabel(a, context))
          .join(', '),
      })}`;
    }),
    unassigned > 0 ? t('incident_assistant.unassigned_line', { count: unassigned }) : null,
    '',
    t('incident_assistant.briefing_accountability'),
    par.total === 0 ? t('incident_assistant.briefing_no_par') : t('incident_assistant.par_counts', { green: par.total - par.warning - par.critical, warning: par.warning, critical: par.critical }),
    '',
    t('incident_assistant.briefing_needs'),
    outstanding.length === 0 ? t('incident_assistant.briefing_no_needs') : null,
    ...outstanding.slice(0, MAX_LIST_ITEMS).map((need) => `- ${need.Name}${need.QuantityRequested > 0 ? ` ${need.QuantityFulfilled}/${need.QuantityRequested}` : ''}`),
  ]);
};

export const answerChecklist = (context: IncidentAnswerContext, t: TFunction, incidentType?: string): string => {
  const board = context.board!;
  const playbook = playbookFor(context, incidentType);
  const active = (board.Roles ?? []).filter((r) => !r.RemovedOn);
  const nodes = liveNodes(board);
  const objectives = board.Objectives ?? [];

  const satisfied: string[] = [];
  const outstanding: string[] = [];
  const check = (isSatisfied: boolean, label: string) => (isSatisfied ? satisfied : outstanding).push(label);

  // Only these can be proven from the board; everything else is a prompt for the commander.
  check(!!board.Command.CurrentCommanderUserId, t('incident_assistant.check_command'));
  check(!!board.Command.CommandPostLocationText || !!board.Command.CommandPostLatitude, t('incident_assistant.check_icp'));
  check(!!board.Command.IncidentActionPlan || objectives.length > 0, t('incident_assistant.check_action_plan'));
  check(
    active.some((r) => r.RoleType === IncidentRoleType.SafetyOfficer),
    t('incident_assistant.check_safety')
  );
  check((board.Accountability ?? []).length > 0 || (board.Timers ?? []).length > 0, t('incident_assistant.check_par'));
  check(!!board.Command.StagingLocationText || nodes.some((n) => n.NodeType === CommandNodeType.Staging) || active.some((r) => r.RoleType === IncidentRoleType.StagingAreaManager), t('incident_assistant.check_staging'));

  return join([
    t('incident_assistant.checklist_header', { type: playbook.displayName, incident: incidentLabel(context, t) }),
    satisfied.length > 0 ? t('incident_assistant.checklist_done', { items: satisfied.join('; ') }) : null,
    outstanding.length > 0 ? t('incident_assistant.checklist_outstanding') : null,
    ...outstanding.map((item) => `- ${item}`),
    t('incident_assistant.checklist_confirm', { type: playbook.displayName }),
    ...checklistFor(playbook)
      .slice(0, MAX_LIST_ITEMS)
      .map((item) => `- ${item}`),
    t('incident_assistant.checklist_disclaimer'),
  ]);
};
