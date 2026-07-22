import { getCommandList } from '@/api/incidentCommand/incidentCommand';
import { type IncidentCommandSummary } from '@/models/v4/incidentCommand/incidentCommandModels';

import { useIncidentsStore } from '../incidents-store';

jest.mock('@/api/incidentCommand/incidentCommand');
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockGetCommandList = getCommandList as jest.MockedFunction<typeof getCommandList>;

const summaries = [
  { IncidentCommandId: 'ic-1', CallId: 5, Status: 0, EstablishedOn: '2026-07-01T10:00:00Z', AssignedUnitCount: 2, AssignedPersonnelCount: 3 },
  { IncidentCommandId: 'ic-2', CallId: 6, Status: 1, EstablishedOn: '2026-06-01T10:00:00Z', ClosedOn: '2026-06-01T14:00:00Z', AssignedUnitCount: 0, AssignedPersonnelCount: 0 },
] as unknown as IncidentCommandSummary[];

const listResult = { Data: summaries } as unknown as Awaited<ReturnType<typeof getCommandList>>;

describe('useIncidentsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useIncidentsStore.setState({ summaries: [], includeClosed: false, isLoading: false, error: null });
  });

  it('fetchIncidents loads summaries for the active-only filter by default', async () => {
    mockGetCommandList.mockResolvedValue(listResult);

    await useIncidentsStore.getState().fetchIncidents();

    expect(mockGetCommandList).toHaveBeenCalledWith(false);
    const state = useIncidentsStore.getState();
    expect(state.summaries).toBe(summaries);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setIncludeClosed(true) refetches with ended incidents included', async () => {
    mockGetCommandList.mockResolvedValue(listResult);

    useIncidentsStore.getState().setIncludeClosed(true);
    await Promise.resolve();

    expect(useIncidentsStore.getState().includeClosed).toBe(true);
    expect(mockGetCommandList).toHaveBeenCalledWith(true);
  });

  it('fetchIncidents tolerates a null payload', async () => {
    mockGetCommandList.mockResolvedValue({ Data: null } as unknown as Awaited<ReturnType<typeof getCommandList>>);

    await useIncidentsStore.getState().fetchIncidents();

    expect(useIncidentsStore.getState().summaries).toEqual([]);
  });

  it('fetchIncidents sets an error and clears loading on failure', async () => {
    mockGetCommandList.mockRejectedValue(new Error('boom'));

    await useIncidentsStore.getState().fetchIncidents();

    const state = useIncidentsStore.getState();
    expect(state.error).toBe('Failed to load incidents');
    expect(state.isLoading).toBe(false);
  });

  it('clear resets the loaded summaries', () => {
    useIncidentsStore.setState({ summaries });

    useIncidentsStore.getState().clear();

    expect(useIncidentsStore.getState().summaries).toEqual([]);
  });
});
