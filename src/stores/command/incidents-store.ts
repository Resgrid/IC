import { create } from 'zustand';

import { getBundle } from '@/api/command/sync';
import { logger } from '@/lib/logging';
import { type IncidentAdHocPersonnel } from '@/models/v4/incidentCommand/incidentAdHocPersonnel';
import { type IncidentAdHocUnit } from '@/models/v4/incidentCommand/incidentAdHocUnit';
import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';

interface IncidentsState {
  /** One board per active incident command in the department (from /Sync/Bundle). */
  incidents: IncidentCommandBoard[];
  adHocUnits: IncidentAdHocUnit[];
  adHocPersonnel: IncidentAdHocPersonnel[];
  /** Server cursor for the next /Sync/Changes delta pull. */
  serverTimestampMs: number | null;
  isLoading: boolean;
  error: string | null;

  /** Load all active incident commands for the department in one round-trip. */
  fetchActiveIncidents: () => Promise<void>;
  clear: () => void;
}

export const useIncidentsStore = create<IncidentsState>((set) => ({
  incidents: [],
  adHocUnits: [],
  adHocPersonnel: [],
  serverTimestampMs: null,
  isLoading: false,
  error: null,

  fetchActiveIncidents: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getBundle();
      const bundle = result?.Data;
      set({
        incidents: bundle?.Boards ?? [],
        adHocUnits: bundle?.AdHocUnits ?? [],
        adHocPersonnel: bundle?.AdHocPersonnel ?? [],
        serverTimestampMs: bundle?.ServerTimestampMs ?? null,
        isLoading: false,
      });
    } catch (error) {
      logger.error({ message: 'Failed to fetch active incidents', context: { error } });
      set({ isLoading: false, error: 'Failed to load incidents' });
    }
  },

  clear: () => set({ incidents: [], adHocUnits: [], adHocPersonnel: [], serverTimestampMs: null, error: null }),
}));
