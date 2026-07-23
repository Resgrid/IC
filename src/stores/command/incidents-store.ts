import { create } from 'zustand';

import { getCommandList } from '@/api/incidentCommand/incidentCommand';
import { logger } from '@/lib/logging';
import { type IncidentCommandSummary } from '@/models/v4/incidentCommand/incidentCommandModels';

interface IncidentsState {
  /** List-card summaries for the department's incident commands (GetCommandList). */
  summaries: IncidentCommandSummary[];
  /** False (default) = active incidents only; true = include ended incidents. */
  includeClosed: boolean;
  isLoading: boolean;
  error: string | null;

  setIncludeClosed: (value: boolean) => void;
  /** Load the incident list for the current filter. */
  fetchIncidents: () => Promise<void>;
  clear: () => void;
}

export const useIncidentsStore = create<IncidentsState>((set, get) => ({
  summaries: [],
  includeClosed: false,
  isLoading: false,
  error: null,

  setIncludeClosed: (value: boolean) => {
    set({ includeClosed: value });
    get()
      .fetchIncidents()
      .catch(() => {});
  },

  fetchIncidents: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getCommandList(get().includeClosed);
      set({ summaries: result?.Data ?? [], isLoading: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch incident list', context: { error } });
      set({ isLoading: false, error: 'Failed to load incidents' });
    }
  },

  clear: () => set({ summaries: [], error: null }),
}));
