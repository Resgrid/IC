import { type TFunction } from 'i18next';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { askIncidentAssistant } from '@/api/chat/chatbot';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';
import { uuidv4 } from '@/lib/utils';
import { answerIncidentQuestionLocally, type IncidentAnswerContext, type IncidentSuggestion, suggestionsForIncident } from '@/services/incident-assistant';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useCommandStore } from '@/stores/command/store';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { useRolesStore } from '@/stores/roles/store';
import { useUnitsStore } from '@/stores/units/store';

/** Where an answer came from — surfaced in the UI so the commander knows what they're reading. */
export type AssistantAnswerSource = 'device' | 'server';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdOn: string;
  source?: AssistantAnswerSource;
  /** True when the assistant couldn't answer, so the UI can style it as a failure rather than a fact. */
  isError?: boolean;
}

interface IncidentAssistantState {
  /** Conversation per incident — an IC running several boards keeps a separate thread on each. */
  messagesByCallId: Record<string, AssistantMessage[]>;
  /** Call id currently awaiting an answer, or null. */
  askingCallId: string | null;

  /**
   * Ask a question about one incident. Answers on-device when the deterministic matcher recognizes
   * it (instant, works with no signal), and falls back to Resgrid Core for live weather and
   * free-form questions the matcher doesn't cover.
   */
  ask: (callId: string, question: string, t: TFunction) => Promise<void>;
  /** One-tap prompts for the incident, from its inferred ICS playbook. */
  suggestions: (callId: string) => IncidentSuggestion[];
  clear: (callId: string) => void;
}

const isOffline = () => {
  const queue = useOfflineQueueStore.getState();
  return !queue.isConnected || !queue.isNetworkReachable;
};

/**
 * Assembles everything the on-device answers read. Every source here is MMKV-persisted, so this
 * works unchanged with no connection — the board is simply as fresh as the last sync.
 */
export const buildAnswerContext = (callId: string): IncidentAnswerContext => {
  const boardState = useCommandStore.getState().boards[callId];
  const calls = useCallsStore.getState().calls;
  const activeCall = useCoreStore.getState().activeCall;
  const call = calls.find((c) => c.CallId === callId) ?? (activeCall?.CallId === callId ? activeCall : null);
  const users = useRolesStore.getState().users;
  const units = useUnitsStore.getState().units;

  return {
    board: boardState?.board ?? null,
    adHocUnits: boardState?.adHocUnits ?? [],
    adHocPersonnel: boardState?.adHocPersonnel ?? [],
    timeline: boardState?.timeline ?? [],
    callName: call?.Name ?? null,
    callNumber: call?.Number ?? null,
    callAddress: call?.Address ?? null,
    callType: call?.Type ?? null,
    callNature: call?.Nature ?? null,
    resolveUserName: (userId: string) => {
      const user = users.find((u) => u.UserId === userId);
      return user ? `${user.FirstName} ${user.LastName}`.trim() : userId;
    },
    resolveUnitName: (unitId: string) => units.find((u) => u.UnitId === unitId)?.Name ?? unitId,
  };
};

const toNumericCallId = (callId: string): number => {
  const parsed = parseInt(callId, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const message = (role: AssistantMessage['role'], text: string, extra?: Partial<AssistantMessage>): AssistantMessage => ({
  id: uuidv4(),
  role,
  text,
  createdOn: new Date().toISOString(),
  ...extra,
});

export const useIncidentAssistantStore = create<IncidentAssistantState>()(
  persist(
    (set, get) => ({
      messagesByCallId: {},
      askingCallId: null,

      ask: async (callId, question, t) => {
        const trimmed = question.trim();
        if (!trimmed) {
          return;
        }

        const append = (...entries: AssistantMessage[]) =>
          set((state) => ({
            messagesByCallId: { ...state.messagesByCallId, [callId]: [...(state.messagesByCallId[callId] ?? []), ...entries] },
          }));

        append(message('user', trimmed));
        set({ askingCallId: callId });

        try {
          const context = buildAnswerContext(callId);
          const local = answerIncidentQuestionLocally(trimmed, context, t);

          // A confident on-device match is answered on-device even with a connection: it is instant,
          // costs nothing, and says exactly what the server would say.
          if (!local.requiresServer && local.confidence >= 1 && local.answer) {
            append(message('assistant', local.answer, { source: 'device' }));
            return;
          }

          if (isOffline()) {
            // No signal: the device's best effort, or an honest "not without a connection".
            append(local.answer ? message('assistant', local.answer, { source: 'device' }) : message('assistant', t('incident_assistant.offline_cannot_answer'), { source: 'device', isError: true }));
            return;
          }

          const numericCallId = toNumericCallId(callId);
          const result = await askIncidentAssistant(numericCallId, trimmed);
          const answer = result?.Answer?.trim();

          if (answer) {
            append(message('assistant', answer, { source: 'server', isError: result?.Processed === false }));
            return;
          }

          append(local.answer ? message('assistant', local.answer, { source: 'device' }) : message('assistant', t('incident_assistant.no_answer'), { source: 'server', isError: true }));
        } catch (error) {
          logger.error({ message: 'Incident assistant question failed', context: { error, callId } });

          // The server round-trip is the failure-prone half; fall back to whatever the device knows
          // rather than leaving the commander with nothing.
          let fallback: string | null = null;
          try {
            fallback = answerIncidentQuestionLocally(trimmed, buildAnswerContext(callId), t).answer;
          } catch (localError) {
            logger.warn({ message: 'Incident assistant local fallback failed', context: { error: localError, callId } });
          }

          append(fallback ? message('assistant', fallback, { source: 'device' }) : message('assistant', t('incident_assistant.error'), { isError: true }));
        } finally {
          set({ askingCallId: null });
        }
      },

      suggestions: (callId) => suggestionsForIncident(buildAnswerContext(callId)),

      clear: (callId) =>
        set((state) => {
          const next = { ...state.messagesByCallId };
          delete next[callId];
          return { messagesByCallId: next };
        }),
    }),
    {
      name: 'incident-assistant-storage',
      storage: createJSONStorage(() => zustandStorage),
      // Conversations persist so an answer read before losing signal is still there; the in-flight
      // flag is transient and must not survive a restart as a stuck spinner.
      partialize: (state) => ({ messagesByCallId: state.messagesByCallId }),
    }
  )
);
