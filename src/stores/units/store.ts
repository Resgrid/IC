import { create } from 'zustand';

import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { getUnits } from '@/api/units/units';
import { getAllUnitStatuses as getUnitCurrentStatuses } from '@/api/units/unitStatuses';
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
      const [unitsResponse, unitStatusesResponse, currentStatusesResponse] = await Promise.all([getUnits(), getAllUnitStatuses(), getUnitCurrentStatuses()]);
      set({ units: unitsResponse.Data, unitStatuses: unitStatusesResponse.Data, unitCurrentStatuses: currentStatusesResponse.Data ?? [], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch units', isLoading: false });
    }
  },
}));
