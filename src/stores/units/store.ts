import { create } from 'zustand';

import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { getUnits } from '@/api/units/units';
import { getAllUnitStatuses as getUnitCurrentStatuses } from '@/api/units/unitStatuses';
import { cacheManager } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logging';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';
import { type UnitResultData } from '@/models/v4/units/unitResultData';
import { type UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

interface UnitsState {
  units: UnitResultData[];
  unitStatuses: UnitTypeStatusResultData[];
  /** Live per-unit status snapshot (state text/color, destination, ETA). */
  unitCurrentStatuses: UnitStatusResultData[];
  isLoading: boolean;
  error: string | null;
  fetchUnits: () => Promise<void>;
}

export const useUnitsStore = create<UnitsState>((set) => ({
  units: [],
  unitStatuses: [],
  unitCurrentStatuses: [],
  isLoading: false,
  error: null,
  fetchUnits: async () => {
    set({ isLoading: true, error: null });
    try {
      // Settled so a failing status endpoint can't take the unit roster down with it
      const [unitsResult, unitStatusesResult, currentStatusesResult] = await Promise.allSettled([getUnits(), getAllUnitStatuses(), getUnitCurrentStatuses()]);

      const units = unitsResult.status === 'fulfilled' ? (unitsResult.value.Data ?? []) : [];
      const unitStatuses = unitStatusesResult.status === 'fulfilled' ? (unitStatusesResult.value.Data ?? []) : [];
      const unitCurrentStatuses = currentStatusesResult.status === 'fulfilled' ? (currentStatusesResult.value.Data ?? []) : [];

      if (unitsResult.status === 'rejected') {
        logger.error({ message: 'Failed to fetch units roster', context: { error: unitsResult.reason } });
      }
      if (unitStatusesResult.status === 'rejected') {
        logger.warn({ message: 'Failed to fetch unit type statuses', context: { error: unitStatusesResult.reason } });
      }
      if (currentStatusesResult.status === 'rejected') {
        logger.warn({ message: 'Failed to fetch current unit statuses', context: { error: currentStatusesResult.reason } });
      }

      // A cached empty roster (2-day TTL) would stick forever — drop it so the
      // next fetch hits the server again. Only evict when the fetch itself succeeded.
      if (unitsResult.status === 'fulfilled' && units.length === 0) {
        cacheManager.remove('/Units/GetAllUnits');
      }

      set({ units, unitStatuses, unitCurrentStatuses, isLoading: false, error: unitsResult.status === 'rejected' ? 'Failed to fetch units' : null });
    } catch (error) {
      logger.error({ message: 'Failed to fetch units', context: { error } });
      set({ error: 'Failed to fetch units', isLoading: false });
    }
  },
}));
