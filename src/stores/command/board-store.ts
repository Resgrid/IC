import { create } from 'zustand';

import { establishCommand as establishCommandApi, getCommandBoard } from '@/api/command/board';
import { getCommandBoardById, getCommandTimeline, getIncidentAttachments } from '@/api/incidentCommand/incidentCommand';
import { logger } from '@/lib/logging';
import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';
import { type CommandLogEntry, type IncidentAttachment } from '@/models/v4/incidentCommand/incidentCommandModels';

interface CommandBoardState {
  /** The current incident's board snapshot, or null when none is loaded / no command established. */
  board: IncidentCommandBoard | null;
  /** Call id the loaded board belongs to. */
  currentCallId: number | null;
  /** Set when the board was loaded by command id (ended-incident history view). */
  currentCommandId: string | null;
  /** Incident log entries for the loaded board (newest first, filtered to the loaded command when by-id). */
  timeline: CommandLogEntry[];
  /** Incident file metadata for the loaded board (filtered to the loaded command when by-id). */
  attachments: IncidentAttachment[];
  isLoading: boolean;
  error: string | null;

  /** Load (or reload) the command board for a call. */
  fetchBoard: (callId: number) => Promise<void>;
  /** Load the board for one SPECIFIC command instance — including a closed one (read-only history). */
  fetchBoardById: (callId: number, incidentCommandId: string) => Promise<void>;
  /** Establish command on a call (optionally seeding from a template), then load its board. Returns success. */
  establishCommand: (callId: number, commandDefinitionId?: number | null) => Promise<boolean>;
  /** Drop the loaded board (e.g. on leaving the incident screen). */
  clearBoard: () => void;
}

export const useCommandBoardStore = create<CommandBoardState>((set, get) => ({
  board: null,
  currentCallId: null,
  currentCommandId: null,
  timeline: [],
  attachments: [],
  isLoading: false,
  error: null,

  fetchBoard: async (callId) => {
    set({ isLoading: true, error: null, currentCallId: callId, currentCommandId: null });
    try {
      const result = await getCommandBoard(callId);
      set({ board: result?.Data ?? null, isLoading: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch command board', context: { error, callId } });
      set({ isLoading: false, error: 'Failed to load command board' });
    }
  },

  fetchBoardById: async (callId, incidentCommandId) => {
    set({ isLoading: true, error: null, currentCallId: callId, currentCommandId: incidentCommandId });
    try {
      const result = await getCommandBoardById(incidentCommandId);
      // Same wire payload as GetCommandBoard — the two local IncidentCommandBoard interfaces only differ in optionality.
      const board = (result?.Data ?? null) as unknown as IncidentCommandBoard | null;

      // Log + files load best-effort; the per-call reads span every command on the call, so filter to this one.
      let timeline: CommandLogEntry[] = [];
      let attachments: IncidentAttachment[] = [];
      try {
        const [timelineResult, attachmentsResult] = await Promise.all([getCommandTimeline(callId), getIncidentAttachments(callId)]);
        timeline = (timelineResult?.Data ?? []).filter((entry) => entry.IncidentCommandId === incidentCommandId).sort((a, b) => new Date(b.OccurredOn).getTime() - new Date(a.OccurredOn).getTime());
        attachments = (attachmentsResult?.Data ?? []).filter((attachment) => attachment.IncidentCommandId === incidentCommandId);
      } catch (error) {
        logger.warn({ message: 'Failed to fetch incident history extras', context: { error, callId, incidentCommandId } });
      }

      set({ board, timeline, attachments, isLoading: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch command board by id', context: { error, callId, incidentCommandId } });
      set({ isLoading: false, error: 'Failed to load command board' });
    }
  },

  establishCommand: async (callId, commandDefinitionId) => {
    set({ isLoading: true, error: null });
    try {
      await establishCommandApi(callId, commandDefinitionId);
      // Re-read the board so the freshly-seeded lanes/command are reflected.
      await get().fetchBoard(callId);
      return true;
    } catch (error) {
      logger.error({ message: 'Failed to establish command', context: { error, callId } });
      set({ isLoading: false, error: 'Failed to establish command' });
      return false;
    }
  },

  clearBoard: () => set({ board: null, currentCallId: null, currentCommandId: null, timeline: [], attachments: [], error: null }),
}));
