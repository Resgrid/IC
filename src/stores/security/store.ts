import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getCurrentUsersRights } from '@/api/security/security';
import { cacheManager } from '@/lib/cache/cache-manager';
import { setCacheScope } from '@/lib/cache/cache-scope';
import { logger } from '@/lib/logging';
import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

import { zustandStorage } from '../../lib/storage';

export interface SecurityState {
  error: string | null;
  getRights: () => Promise<void>;
  rights: DepartmentRightsResultData | null;
}

export const securityStore = create<SecurityState>()(
  persist(
    (set, _get) => ({
      error: null,
      rights: null,
      getRights: async () => {
        try {
          const response = await getCurrentUsersRights();
          // Only update if rights actually changed to prevent unnecessary re-renders
          const current = _get().rights;
          if (!current || JSON.stringify(current) !== JSON.stringify(response.Data)) {
            set({
              rights: response.Data,
            });
          }
        } catch (error) {
          // If refresh fails, log out the user
        }
      },
    }),
    {
      name: 'security-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        rights: state.rights,
        // Exclude: error (transient)
      }),
    }
  )
);

// The API cache is scoped to the department as well as the signed-in user, and rights are where the
// active department is decided. This subscription lives here rather than beside the user-scope one in
// the auth store: that module would have to import this one, closing the auth -> security -> api
// client -> auth import cycle.
securityStore.subscribe((state, previousState) => {
  // DepartmentId is a string that can be empty; treat blank as "no department" rather than a scope.
  const departmentId = state.rights?.DepartmentId || null;
  const previousDepartmentId = previousState.rights?.DepartmentId || null;

  if (departmentId === previousDepartmentId) {
    return;
  }

  // Only a move between two real departments can serve the wrong rows. The first rights load of a
  // session moves the scope off 'nodept', which leaves anything cached before it unaddressable rather
  // than wrong, and clearing there would throw away what app startup just fetched.
  if (previousDepartmentId) {
    try {
      cacheManager.clear();
    } catch (error) {
      logger.warn({
        message: 'Failed to clear the API cache on department change',
        context: { error },
      });
    }
  }

  try {
    setCacheScope({ departmentId });
  } catch (error) {
    logger.warn({
      message: 'Failed to update the API cache scope on department change',
      context: { error },
    });
  }
});

export const useSecurityStore = () => {
  const rights = securityStore((state) => state.rights);
  const getRights = securityStore((state) => state.getRights);
  return {
    getRights,
    isUserDepartmentAdmin: rights?.IsAdmin,
    isUserGroupAdmin: (groupId: number) => rights?.Groups?.some((right) => right.GroupId === groupId && right.IsGroupAdmin) ?? false,
    canUserCreateCalls: rights?.CanCreateCalls,
    canUserCreateNotes: rights?.CanAddNote,
    canUserCreateMessages: rights?.CanCreateMessage,
    canUserViewPII: rights?.CanViewPII,
    departmentCode: rights?.DepartmentCode,
  };
};
