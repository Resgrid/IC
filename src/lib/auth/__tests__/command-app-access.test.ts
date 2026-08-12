/**
 * The IC app is commander-only. These cover the gate initializeApp() runs after fetching rights:
 * an unauthorized member is told why and signed out, and every other rights state — including a
 * server that omits the field or a fetch that failed — leaves the session alone.
 */
import { enforceCommandAppAccess } from '../command-app-access';

import type { DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

const mockLogout = jest.fn();
const mockShowToast = jest.fn();
let mockRights: DepartmentRightsResultData | null = null;

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: { getState: () => ({ logout: mockLogout }) },
}));

jest.mock('@/stores/security/store', () => ({
  securityStore: { getState: () => ({ rights: mockRights }) },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: { getState: () => ({ showToast: mockShowToast }) },
}));

const buildRights = (overrides: Partial<DepartmentRightsResultData> = {}): DepartmentRightsResultData =>
  ({
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
  }) as DepartmentRightsResultData;

describe('enforceCommandAppAccess', () => {
  beforeEach(() => {
    mockLogout.mockReset().mockResolvedValue(undefined);
    mockShowToast.mockReset();
    mockRights = null;
  });

  it('toasts the denial and signs the user out when CanLoginToCommandApp is false', async () => {
    mockRights = buildRights({ CanLoginToCommandApp: false });

    const denied = await enforceCommandAppAccess({ deniedMessage: 'Not authorized', userId: 'user-1' });

    // Returning true is how the caller knows to abandon the rest of initialization.
    expect(denied).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith('error', 'Not authorized');
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('toasts before signing out so the reason survives the sign-out navigation', async () => {
    mockRights = buildRights({ CanLoginToCommandApp: false });

    await enforceCommandAppAccess({ deniedMessage: 'Not authorized' });

    expect(mockShowToast.mock.invocationCallOrder[0]).toBeLessThan(mockLogout.mock.invocationCallOrder[0]);
  });

  it('waits for the sign-out to finish before reporting the denial', async () => {
    mockRights = buildRights({ CanLoginToCommandApp: false });
    let logoutFinished = false;
    mockLogout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setImmediate(() => {
            logoutFinished = true;
            resolve();
          });
        })
    );

    await enforceCommandAppAccess({ deniedMessage: 'Not authorized' });

    expect(logoutFinished).toBe(true);
  });

  it('allows initialization to continue when CanLoginToCommandApp is true', async () => {
    mockRights = buildRights();

    const denied = await enforceCommandAppAccess({ deniedMessage: 'Not authorized' });

    expect(denied).toBe(false);
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('allows initialization to continue when the server omits CanLoginToCommandApp', async () => {
    // The check is a strict === false and the model defaults the field to true, so an older
    // server that omits it must not lock commanders out.
    const rights = buildRights();
    delete (rights as Partial<DepartmentRightsResultData>).CanLoginToCommandApp;
    mockRights = rights;

    const denied = await enforceCommandAppAccess({ deniedMessage: 'Not authorized' });

    expect(denied).toBe(false);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('allows initialization to continue when rights are not available', async () => {
    // A failed rights fetch is not a denial; only an explicit false ends the session.
    mockRights = null;

    const denied = await enforceCommandAppAccess({ deniedMessage: 'Not authorized' });

    expect(denied).toBe(false);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
