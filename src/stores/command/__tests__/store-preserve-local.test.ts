import { act } from '@testing-library/react-native';

const mockSetActiveCall = jest.fn(() => Promise.resolve());
const mockAddEvent = jest.fn(() => 'event-id');

let mockQueuedEvents: { type: string; status: string; data: Record<string, unknown> }[] = [];

jest.mock('@/lib/storage', () => ({
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: jest.fn(() => ({ setActiveCall: mockSetActiveCall })),
  },
}));

jest.mock('@/stores/offline-queue/store', () => ({
  useOfflineQueueStore: {
    getState: jest.fn(() => ({
      isConnected: true,
      isNetworkReachable: true,
      addEvent: mockAddEvent,
      queuedEvents: mockQueuedEvents,
    })),
  },
}));

const mockGetCommandBoard = jest.fn();
const mockGetAdHocUnits = jest.fn();
const mockGetAdHocPersonnel = jest.fn();

jest.mock('@/api/incidentCommand/incidentCommand', () => ({
  getCommandBoard: (...args: unknown[]) => mockGetCommandBoard(...args),
}));

jest.mock('@/api/incidentCommand/incidentResources', () => ({
  getAdHocUnits: (...args: unknown[]) => mockGetAdHocUnits(...args),
  getAdHocPersonnel: (...args: unknown[]) => mockGetAdHocPersonnel(...args),
}));

jest.mock('@/api/incidentCommand/incidentRoles', () => ({}));
jest.mock('@/api/incidentCommand/incidentVoice', () => ({}));
jest.mock('@/api/incidentCommand/sync', () => ({}));

import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandModels';

import { useCommandStore } from '../store';

const CALL_ID = '101';

const serverBoard = (): IncidentCommandBoard =>
  ({
    Command: { IncidentCommandId: 'ic-1', DepartmentId: 1, CallId: 101, EstablishedByUserId: 'u1', EstablishedOn: '2026-07-01T10:00:00Z', CurrentCommanderUserId: 'u1', IcsLevel: 1, Status: 0 },
    Nodes: [],
    Assignments: [],
    Objectives: [],
    Needs: [],
    Timers: [],
    Annotations: [],
    Accountability: [],
    Roles: [],
  }) as unknown as IncidentCommandBoard;

const localNeed = {
  IncidentNeedId: 'local-need-abc',
  IncidentCommandId: 'ic-1',
  DepartmentId: 0,
  CallId: 101,
  Name: 'Engines',
  Category: 0,
  Status: 0,
  QuantityRequested: 3,
  QuantityFulfilled: 0,
  Priority: 0,
  CreatedOn: '2026-07-01T10:05:00Z',
  SortOrder: 0,
};

describe('board refresh preserves queued optimistic rows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueuedEvents = [];
    mockGetAdHocUnits.mockResolvedValue({ Data: [] });
    mockGetAdHocPersonnel.mockResolvedValue({ Data: [] });

    const board = serverBoard();
    board.Needs = [localNeed as never];
    useCommandStore.setState({
      boards: {
        [CALL_ID]: {
          callId: CALL_ID,
          board,
          adHocUnits: [],
          adHocPersonnel: [],
          isProvisional: false,
          lastRefreshed: null,
        },
      },
      activeCallId: CALL_ID,
    });
  });

  it('keeps a local- need through refreshBoard while its SAVE_NEED event is still queued', async () => {
    mockQueuedEvents = [{ type: 'save_need', status: 'failed', data: { callId: CALL_ID, name: 'Engines' } }];
    mockGetCommandBoard.mockResolvedValue({ Data: serverBoard() }); // server board WITHOUT the need

    await act(async () => {
      await useCommandStore.getState().refreshBoard(CALL_ID);
    });

    const needs = useCommandStore.getState().boards[CALL_ID].board?.Needs ?? [];
    expect(needs.map((n) => n.IncidentNeedId)).toContain('local-need-abc');
  });

  it('drops the local- need once no matching queued event remains (server accepted it)', async () => {
    mockQueuedEvents = []; // queue drained — the server board is now the source of truth
    const accepted = serverBoard();
    accepted.Needs = [{ ...localNeed, IncidentNeedId: 'server-need-1' } as never];
    mockGetCommandBoard.mockResolvedValue({ Data: accepted });

    await act(async () => {
      await useCommandStore.getState().refreshBoard(CALL_ID);
    });

    const needs = useCommandStore.getState().boards[CALL_ID].board?.Needs ?? [];
    expect(needs.map((n) => n.IncidentNeedId)).toEqual(['server-need-1']);
  });
});
