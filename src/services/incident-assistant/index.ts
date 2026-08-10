/**
 * The on-device incident assistant.
 *
 * Answers an Incident Commander's command-board questions from the board already cached on the
 * phone: no network, no model download, no per-device capability check. That matters because the
 * moment a commander most needs "who's unaccounted for" is often the moment the scene has no signal.
 *
 * What the device can't do it says so about, and the caller (see `stores/command/assistant-store`)
 * routes those to Resgrid Core: live weather, and any free-form question the deterministic matcher
 * doesn't recognize, which the backend can answer with a department-configured LLM grounded on the
 * same board.
 */

import { type TFunction } from 'i18next';

import {
  answerBriefing,
  answerChecklist,
  answerNeeds,
  answerNotes,
  answerObjectives,
  answerPar,
  answerResources,
  answerRoles,
  answerSpanOfControl,
  answerStatus,
  answerTimeline,
  answerTimers,
  type IncidentAnswerContext,
  playbookFor,
} from './answerers';
import { type IncidentSuggestion } from './ics-playbooks';
import { type IncidentAssistantIntent, matchIncidentIntent } from './intent-matcher';

export { type IncidentAnswerContext } from './answerers';
export { type IncidentPlaybook, type IncidentSuggestion } from './ics-playbooks';
export { type IncidentAssistantIntent } from './intent-matcher';

export interface LocalAnswer {
  /** Display text, or null when the device deliberately declined in favour of the server. */
  answer: string | null;
  intent: IncidentAssistantIntent;
  confidence: number;
  /**
   * True when this question needs Resgrid Core — live weather, or a free-form question only the
   * server's grounded LLM can take. The caller decides what to do when there is no connection.
   */
  requiresServer: boolean;
}

/** Intents the device can never fully answer: the data simply isn't on the board. */
const SERVER_ONLY_INTENTS: IncidentAssistantIntent[] = ['weather', 'unknown'];

/**
 * Answers a command-board question on-device.
 *
 * `confidence` is 1 for an anchored pattern hit and lower for the keyword fallback, so a caller with
 * a connection can choose to prefer the server on a weak match while an offline caller still gets the
 * device's best effort.
 */
export const answerIncidentQuestionLocally = (question: string, context: IncidentAnswerContext, t: TFunction): LocalAnswer => {
  const match = matchIncidentIntent(question);

  if (SERVER_ONLY_INTENTS.includes(match.intent)) {
    return { answer: null, intent: match.intent, confidence: match.confidence, requiresServer: true };
  }

  if (!context.board?.Command) {
    return { answer: t('incident_assistant.no_board'), intent: match.intent, confidence: match.confidence, requiresServer: false };
  }

  switch (match.intent) {
    case 'par':
      return ok(answerPar(context, t), match);
    case 'resources':
      return ok(answerResources(context, t, match.params.laneName), match);
    case 'span_of_control':
      return ok(answerSpanOfControl(context, t), match);
    case 'objectives':
      return ok(answerObjectives(context, t), match);
    case 'needs':
      return ok(answerNeeds(context, t), match);
    case 'roles':
      return ok(answerRoles(context, t, match.params.roleQuery), match);
    case 'timeline':
      return ok(answerTimeline(context, t, match.params.minutes, match.params.count), match);
    case 'timers':
      return ok(answerTimers(context, t), match);
    case 'notes':
      return ok(answerNotes(context, t), match);
    case 'briefing':
      return ok(answerBriefing(context, t), match);
    case 'checklist':
      return ok(answerChecklist(context, t, match.params.incidentType), match);
    case 'status':
    default:
      return ok(answerStatus(context, t), match);
  }
};

const ok = (answer: string, match: { intent: IncidentAssistantIntent; confidence: number }): LocalAnswer => ({
  answer,
  intent: match.intent,
  confidence: match.confidence,
  requiresServer: false,
});

/**
 * The one-tap prompts to show for an incident, chosen from its inferred ICS playbook. Computed
 * on-device so the chips are right even offline; Core exposes the same list for other clients.
 */
export const suggestionsForIncident = (context: IncidentAnswerContext): IncidentSuggestion[] => playbookFor(context).suggestions;

/** Display name of the incident family the assistant inferred ("Structure fire", "Mass casualty incident"). */
export const incidentTypeName = (context: IncidentAnswerContext): string => playbookFor(context).displayName;
