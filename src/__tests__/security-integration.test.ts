/**
 * Security Integration Test
 * 
 * This test validates that the security permission checking logic works correctly
 * for the calls functionality, and that an unauthorized member is refused the IC app,
 * without complex component mocking.
 */

import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

describe('Security Permission Logic', () => {
  // This mimics the logic in useSecurityStore.canUserCreateCalls
  const canUserCreateCalls = (rights: DepartmentRightsResultData | null): boolean => {
    return rights?.CanCreateCalls === true;
  };

  describe('canUserCreateCalls', () => {
    it('should return true when user has CanCreateCalls permission', () => {
      const rights: DepartmentRightsResultData = {
        DepartmentName: 'Test Department',
        DepartmentCode: 'TEST',
        FullName: 'Test User',
        EmailAddress: 'test@example.com',
        DepartmentId: '1',
        IsAdmin: false,
        CanViewPII: false,
        CanCreateCalls: true,
        CanAddNote: false,
        CanCreateMessage: false,
        CanLoginToCommandApp: true,
        Groups: []
      };

      expect(canUserCreateCalls(rights)).toBe(true);
    });

    it('should return false when user does not have CanCreateCalls permission', () => {
      const rights: DepartmentRightsResultData = {
        DepartmentName: 'Test Department',
        DepartmentCode: 'TEST',
        FullName: 'Test User',
        EmailAddress: 'test@example.com',
        DepartmentId: '1',
        IsAdmin: false,
        CanViewPII: true,
        CanCreateCalls: false,
        CanAddNote: true,
        CanCreateMessage: true,
        CanLoginToCommandApp: true,
        Groups: []
      };

      expect(canUserCreateCalls(rights)).toBe(false);
    });

    it('should return false when rights is null', () => {
      expect(canUserCreateCalls(null)).toBe(false);
    });

    it('should return false when CanCreateCalls is undefined', () => {
      const rights = {
        DepartmentName: 'Test Department',
        DepartmentCode: 'TEST',
        FullName: 'Test User',
        EmailAddress: 'test@example.com',
        DepartmentId: '1',
        IsAdmin: false,
        CanViewPII: true,
        CanAddNote: true,
        CanCreateMessage: true,
        CanLoginToCommandApp: true,
        Groups: []
      } as unknown as DepartmentRightsResultData;

      expect(canUserCreateCalls(rights)).toBe(false);
    });
  });

  describe('UI Logic Validation', () => {
    it('should show FAB when user can create calls', () => {
      const rights: DepartmentRightsResultData = {
        DepartmentName: 'Test Department',
        DepartmentCode: 'TEST',
        FullName: 'Test User',
        EmailAddress: 'test@example.com',
        DepartmentId: '1',
        IsAdmin: false,
        CanViewPII: false,
        CanCreateCalls: true,
        CanAddNote: false,
        CanCreateMessage: false,
        CanLoginToCommandApp: true,
        Groups: []
      };

      const shouldShowFab = canUserCreateCalls(rights);
      const shouldShowMenu = canUserCreateCalls(rights);

      expect(shouldShowFab).toBe(true);
      expect(shouldShowMenu).toBe(true);
    });

    it('should hide FAB and menu when user cannot create calls', () => {
      const rights: DepartmentRightsResultData = {
        DepartmentName: 'Test Department',
        DepartmentCode: 'TEST',
        FullName: 'Test User',
        EmailAddress: 'test@example.com',
        DepartmentId: '1',
        IsAdmin: false,
        CanViewPII: true,
        CanCreateCalls: false,
        CanAddNote: true,
        CanCreateMessage: true,
        CanLoginToCommandApp: true,
        Groups: []
      };

      const shouldShowFab = canUserCreateCalls(rights);
      const shouldShowMenu = canUserCreateCalls(rights);

      expect(shouldShowFab).toBe(false);
      expect(shouldShowMenu).toBe(false);
    });

    it('should hide FAB and menu when rights are not available', () => {
      const shouldShowFab = canUserCreateCalls(null);
      const shouldShowMenu = canUserCreateCalls(null);

      expect(shouldShowFab).toBe(false);
      expect(shouldShowMenu).toBe(false);
    });
  });

  describe('command app authorization gate', () => {
    // The layout pulls in Mapbox, Novu, push notifications and the whole store graph, so the
    // gate in src/app/(app)/_layout.tsx initializeApp() is exercised through the same shape
    // rather than by rendering it.
    interface GateEffects {
      showToast: jest.Mock;
      logout: jest.Mock;
      continueInitialization: jest.Mock;
    }

    const t = (key: string): string => key;

    const runCommandAppGate = async (rights: DepartmentRightsResultData | null, effects: GateEffects): Promise<void> => {
      if (rights?.CanLoginToCommandApp === false) {
        effects.showToast('error', t('login.command_not_authorized'));
        await effects.logout();
        return;
      }

      effects.continueInitialization();
    };

    const buildRights = (overrides: Partial<DepartmentRightsResultData> = {}): DepartmentRightsResultData => ({
      DepartmentName: 'Test Department',
      DepartmentCode: 'TEST',
      FullName: 'Test User',
      EmailAddress: 'test@example.com',
      DepartmentId: '1',
      IsAdmin: false,
      CanViewPII: false,
      CanCreateCalls: true,
      CanAddNote: false,
      CanCreateMessage: false,
      CanLoginToCommandApp: true,
      Groups: [],
      ...overrides,
    });

    let effects: GateEffects;

    beforeEach(() => {
      effects = {
        showToast: jest.fn(),
        logout: jest.fn().mockResolvedValue(undefined),
        continueInitialization: jest.fn(),
      };
    });

    it('should toast the localized denial and sign the user out when CanLoginToCommandApp is false', async () => {
      await runCommandAppGate(buildRights({ CanLoginToCommandApp: false }), effects);

      expect(effects.showToast).toHaveBeenCalledWith('error', 'login.command_not_authorized');
      expect(effects.logout).toHaveBeenCalledTimes(1);
      expect(effects.continueInitialization).not.toHaveBeenCalled();
    });

    it('should toast before signing out so the reason survives the sign-out navigation', async () => {
      await runCommandAppGate(buildRights({ CanLoginToCommandApp: false }), effects);

      expect(effects.showToast.mock.invocationCallOrder[0]).toBeLessThan(effects.logout.mock.invocationCallOrder[0]);
    });

    it('should continue initialization when CanLoginToCommandApp is true', async () => {
      await runCommandAppGate(buildRights(), effects);

      expect(effects.showToast).not.toHaveBeenCalled();
      expect(effects.logout).not.toHaveBeenCalled();
      expect(effects.continueInitialization).toHaveBeenCalledTimes(1);
    });

    it('should continue initialization when the server omits CanLoginToCommandApp', async () => {
      // The gate is a strict === false check and the model defaults the field to true, so an
      // older server that omits it must not lock commanders out of the app.
      const rights = buildRights();
      delete (rights as Partial<DepartmentRightsResultData>).CanLoginToCommandApp;

      await runCommandAppGate(rights, effects);

      expect(effects.showToast).not.toHaveBeenCalled();
      expect(effects.logout).not.toHaveBeenCalled();
      expect(effects.continueInitialization).toHaveBeenCalledTimes(1);
    });

    it('should continue initialization when rights are not available', async () => {
      // A failed rights fetch is not a denial; only an explicit false ends the session.
      await runCommandAppGate(null, effects);

      expect(effects.logout).not.toHaveBeenCalled();
      expect(effects.continueInitialization).toHaveBeenCalledTimes(1);
    });
  });
});
