import { getBundle } from '@/api/command/sync';
import { type IncidentCommandBundle } from '@/models/v4/incidentCommand/incidentCommandBundle';

import { useIncidentsStore } from '../incidents-store';

jest.mock('@/api/command/sync');
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockGetBundle = getBundle as jest.MockedFunction<typeof getBundle>;

const fakeBundle = {
  ServerTimestampMs: 1700000000000,
  Boards: [{ Command: { CallId: 5 } }],
  AdHocUnits: [],
  AdHocPersonnel: [],
} as unknown as IncidentCommandBundle;

const bundleResult = { Data: fakeBundle } as unknown as Awaited<ReturnType<typeof getBundle>>;

describe('useIncidentsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useIncidentsStore.setState({ incidents: [], adHocUnits: [], adHocPersonnel: [], serverTimestampMs: null, isLoading: false, error: null });
  });

  it('fetchActiveIncidents populates incidents + cursor from the bundle', async () => {
    mockGetBundle.mockResolvedValue(bundleResult);

    await useIncidentsStore.getState().fetchActiveIncidents();

    const state = useIncidentsStore.getState();
    expect(state.incidents).toBe(fakeBundle.Boards);
    expect(state.serverTimestampMs).toBe(1700000000000);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchActiveIncidents tolerates a null bundle payload', async () => {
    mockGetBundle.mockResolvedValue({ Data: null } as unknown as Awaited<ReturnType<typeof getBundle>>);

    await useIncidentsStore.getState().fetchActiveIncidents();

    expect(useIncidentsStore.getState().incidents).toEqual([]);
  });

  it('fetchActiveIncidents sets an error and clears loading on failure', async () => {
    mockGetBundle.mockRejectedValue(new Error('boom'));

    await useIncidentsStore.getState().fetchActiveIncidents();

    const state = useIncidentsStore.getState();
    expect(state.error).toBe('Failed to load incidents');
    expect(state.isLoading).toBe(false);
  });

  it('clear resets the loaded incidents', () => {
    useIncidentsStore.setState({ incidents: fakeBundle.Boards, serverTimestampMs: 1 });

    useIncidentsStore.getState().clear();

    expect(useIncidentsStore.getState().incidents).toEqual([]);
    expect(useIncidentsStore.getState().serverTimestampMs).toBeNull();
  });
});
