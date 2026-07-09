import { create } from 'zustand';

import { establishCommand as establishCommandApi, getCommandBoard } from '@/api/command/board';
import { logger } from '@/lib/logging';
import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';

interface CommandBoardState {
  /** The current incident's board snapshot, or null when none is loaded / no command established. */
  board: IncidentCommandBoard | null;
  /** Call id the loaded board belongs to. */
  currentCallId: number | null;
  isLoading: boolean;
  error: string | null;

  /** Load (or reload) the command board for a call. */
  fetchBoard: (callId: number) => Promise<void>;
  /** Establish command on a call (optionally seeding from a template), then load its board. Returns success. */
  establishCommand: (callId: number, commandDefinitionId?: number | null) => Promise<boolean>;
  /** Drop the loaded board (e.g. on leaving the incident screen). */
  clearBoard: () => void;
}

export const useCommandBoardStore = create<CommandBoardState>((set, get) => ({
  board: null,
  currentCallId: null,
  isLoading: false,
  error: null,

  fetchBoard: async (callId) => {
    set({ isLoading: true, error: null, currentCallId: callId });
    try {
      const result = await getCommandBoard(callId);
      set({ board: result?.Data ?? null, isLoading: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch command board', context: { error, callId } });
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

  clearBoard: () => set({ board: null, currentCallId: null, error: null }),
}));
