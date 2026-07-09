import { establishCommand, getCommandBoard } from '@/api/command/board';
import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';

import { useCommandBoardStore } from '../board-store';

jest.mock('@/api/command/board');
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockGetBoard = getCommandBoard as jest.MockedFunction<typeof getCommandBoard>;
const mockEstablish = establishCommand as jest.MockedFunction<typeof establishCommand>;

const fakeBoard = {
  Command: { IncidentCommandId: 'ic-1', CallId: 5, Status: 0 },
  Nodes: [],
  Assignments: [],
  Objectives: [],
  Timers: [],
  Annotations: [],
  Accountability: [],
  Roles: [],
} as unknown as IncidentCommandBoard;

const boardResult = { Data: fakeBoard } as unknown as Awaited<ReturnType<typeof getCommandBoard>>;
const emptyEstablish = { Data: null } as unknown as Awaited<ReturnType<typeof establishCommand>>;

describe('useCommandBoardStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCommandBoardStore.setState({ board: null, currentCallId: null, isLoading: false, error: null });
  });

  it('fetchBoard loads the board and tracks the call id', async () => {
    mockGetBoard.mockResolvedValue(boardResult);

    await useCommandBoardStore.getState().fetchBoard(5);

    const state = useCommandBoardStore.getState();
    expect(mockGetBoard).toHaveBeenCalledWith(5);
    expect(state.board).toBe(fakeBoard);
    expect(state.currentCallId).toBe(5);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchBoard leaves a null board when the call has no command established', async () => {
    mockGetBoard.mockResolvedValue({ Data: null } as unknown as Awaited<ReturnType<typeof getCommandBoard>>);

    await useCommandBoardStore.getState().fetchBoard(7);

    expect(useCommandBoardStore.getState().board).toBeNull();
  });

  it('fetchBoard sets an error and clears loading when the request fails', async () => {
    mockGetBoard.mockRejectedValue(new Error('network'));

    await useCommandBoardStore.getState().fetchBoard(5);

    const state = useCommandBoardStore.getState();
    expect(state.error).toBe('Failed to load command board');
    expect(state.isLoading).toBe(false);
    expect(state.board).toBeNull();
  });

  it('establishCommand establishes then reloads the board and returns true', async () => {
    mockEstablish.mockResolvedValue(emptyEstablish);
    mockGetBoard.mockResolvedValue(boardResult);

    const ok = await useCommandBoardStore.getState().establishCommand(5, 9);

    expect(ok).toBe(true);
    expect(mockEstablish).toHaveBeenCalledWith(5, 9);
    expect(mockGetBoard).toHaveBeenCalledWith(5);
    expect(useCommandBoardStore.getState().board).toBe(fakeBoard);
  });

  it('establishCommand returns false and sets an error when establish fails', async () => {
    mockEstablish.mockRejectedValue(new Error('boom'));

    const ok = await useCommandBoardStore.getState().establishCommand(5);

    expect(ok).toBe(false);
    expect(mockGetBoard).not.toHaveBeenCalled();
    expect(useCommandBoardStore.getState().error).toBe('Failed to establish command');
  });

  it('clearBoard resets the loaded board', () => {
    useCommandBoardStore.setState({ board: fakeBoard, currentCallId: 5, error: 'x' });

    useCommandBoardStore.getState().clearBoard();

    const state = useCommandBoardStore.getState();
    expect(state.board).toBeNull();
    expect(state.currentCallId).toBeNull();
    expect(state.error).toBeNull();
  });
});
