import { act } from '@testing-library/react-native';

const mockSetActiveCall = jest.fn(() => Promise.resolve());
const mockAddEvent = jest.fn(() => 'event-id');

let mockOnline = true;

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
      isConnected: mockOnline,
      isNetworkReachable: mockOnline,
      addEvent: mockAddEvent,
    })),
  },
}));

const mockGetCommandBoard = jest.fn();
const mockSaveCommandNode = jest.fn();
const mockSaveNeed = jest.fn();
const mockSetNeedStatus = jest.fn();
const mockUpdateObjectiveProgress = jest.fn();
const mockUpdateCommandDetails = jest.fn();

jest.mock('@/api/incidentCommand/incidentCommand', () => ({
  establishCommand: jest.fn(),
  getCommandBoard: (...args: unknown[]) => mockGetCommandBoard(...args),
  closeCommand: jest.fn(),
  getAccountability: jest.fn(),
  evaluateAccountability: jest.fn(),
  saveCommandNode: (...args: unknown[]) => mockSaveCommandNode(...args),
  deleteCommandNode: jest.fn(),
  assignResource: jest.fn(),
  moveResource: jest.fn(),
  releaseResource: jest.fn(),
  saveObjective: jest.fn(),
  completeObjective: jest.fn(),
  saveNeed: (...args: unknown[]) => mockSaveNeed(...args),
  setNeedStatus: (...args: unknown[]) => mockSetNeedStatus(...args),
  updateObjectiveProgress: (...args: unknown[]) => mockUpdateObjectiveProgress(...args),
  updateCommandDetails: (...args: unknown[]) => mockUpdateCommandDetails(...args),
  getCommandTimeline: jest.fn(),
  startIncidentTimer: jest.fn(),
  acknowledgeIncidentTimer: jest.fn(),
  transferCommand: jest.fn(),
}));

jest.mock('@/api/incidentCommand/incidentVoice', () => ({
  createIncidentChannel: jest.fn(),
  getChannelsForCall: jest.fn(),
  closeIncidentChannels: jest.fn(),
  logTransmission: jest.fn(),
  getTransmissionLog: jest.fn(),
}));

jest.mock('@/api/incidentCommand/incidentResources', () => ({
  createAdHocUnit: jest.fn(),
  getAdHocUnits: jest.fn(),
  releaseAdHocUnit: jest.fn(),
  createAdHocPersonnel: jest.fn(),
  getAdHocPersonnel: jest.fn(),
  releaseAdHocPersonnel: jest.fn(),
}));

jest.mock('@/api/incidentCommand/incidentRoles', () => ({
  assignIncidentRole: jest.fn(),
  removeIncidentRole: jest.fn(),
}));

jest.mock('@/api/incidentCommand/sync', () => ({
  getSyncBundle: jest.fn(),
}));

import { QueuedEventType } from '@/models/offline-queue/queued-event';
import { IncidentNeedCategory, IncidentNeedStatus, TacticalObjectiveStatus } from '@/models/v4/incidentCommand/incidentCommandModels';

import { useCommandStore } from '../store';

const serverBoard = (callId: number) => ({
  Command: {
    IncidentCommandId: `cmd-${callId}`,
    DepartmentId: 1,
    CallId: callId,
    EstablishedByUserId: 'u1',
    EstablishedOn: '2026-07-19T10:00:00Z',
    CurrentCommanderUserId: 'u1',
    IcsLevel: 1,
    Status: 0,
  },
  Nodes: [
    {
      CommandStructureNodeId: 'node-1',
      IncidentCommandId: `cmd-${callId}`,
      DepartmentId: 1,
      CallId: callId,
      NodeType: 1,
      Name: 'Medical',
      SortOrder: 0,
    },
  ],
  Assignments: [],
  Objectives: [
    {
      TacticalObjectiveId: 'obj-1',
      IncidentCommandId: `cmd-${callId}`,
      DepartmentId: 1,
      CallId: callId,
      Name: 'Primary search',
      ObjectiveType: 0,
      Status: TacticalObjectiveStatus.Pending,
      AutoPopulated: false,
      ProgressPercent: 0,
      Priority: 0,
      SortOrder: 0,
    },
  ],
  Needs: [
    {
      IncidentNeedId: 'need-1',
      IncidentCommandId: `cmd-${callId}`,
      DepartmentId: 1,
      CallId: callId,
      Name: 'Fuel truck',
      Category: IncidentNeedCategory.Logistics,
      Status: IncidentNeedStatus.Open,
      QuantityRequested: 2,
      QuantityFulfilled: 0,
      Priority: 0,
      CreatedOn: '2026-07-19T10:00:00Z',
      SortOrder: 0,
    },
  ],
  Timers: [],
  Annotations: [],
  Accountability: [],
  Roles: [],
});

const seedBoard = (callId = 101) => {
  useCommandStore.setState({
    boards: { [String(callId)]: { callId: String(callId), board: serverBoard(callId) as never, adHocUnits: [], adHocPersonnel: [], isProvisional: false, lastRefreshed: null } },
    activeCallId: String(callId),
  });
};

describe('Command Store — needs, progress, leads, details', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnline = true;
    mockGetCommandBoard.mockResolvedValue({ Data: serverBoard(101) });
    useCommandStore.setState({ boards: {}, activeCallId: null, lastSyncTimestampMs: 0, isRefreshing: false });
  });

  describe('addNeed', () => {
    it('saves the need with the parent command id and refreshes the board', async () => {
      seedBoard();
      mockSaveNeed.mockResolvedValue({ Data: { IncidentNeedId: 'need-2' } });

      await act(async () => {
        await useCommandStore.getState().addNeed('101', 'Light tower', IncidentNeedCategory.Equipment, { quantityRequested: 3 });
      });

      expect(mockSaveNeed).toHaveBeenCalledWith(
        expect.objectContaining({ IncidentCommandId: 'cmd-101', CallId: 101, Name: 'Light tower', Category: IncidentNeedCategory.Equipment, QuantityRequested: 3 })
      );
      expect(mockGetCommandBoard).toHaveBeenCalled();
    });

    it('queues and applies an optimistic row when offline', async () => {
      seedBoard();
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().addNeed('101', 'Light tower', IncidentNeedCategory.Equipment);
      });

      expect(mockSaveNeed).not.toHaveBeenCalled();
      expect(mockAddEvent).toHaveBeenCalledWith(QueuedEventType.SAVE_NEED, expect.objectContaining({ callId: '101', name: 'Light tower' }));
      const needs = useCommandStore.getState().boards['101']?.board?.Needs ?? [];
      expect(needs).toHaveLength(2);
      expect(needs[1]?.IncidentNeedId?.startsWith('local-')).toBe(true);
    });
  });

  describe('setNeedStatusEntry', () => {
    it('optimistically marks the need met (defaulting fulfilled quantity) and calls the API', async () => {
      seedBoard();
      mockSetNeedStatus.mockResolvedValue({ Data: {} });

      await act(async () => {
        await useCommandStore.getState().setNeedStatusEntry('101', 'need-1', IncidentNeedStatus.Met);
      });

      expect(mockSetNeedStatus).toHaveBeenCalledWith({ IncidentNeedId: 'need-1', Status: IncidentNeedStatus.Met, QuantityFulfilled: undefined });
    });

    it('queues the transition when offline and flips the row locally', async () => {
      seedBoard();
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().setNeedStatusEntry('101', 'need-1', IncidentNeedStatus.Met);
      });

      expect(mockAddEvent).toHaveBeenCalledWith(QueuedEventType.SET_NEED_STATUS, expect.objectContaining({ incidentNeedId: 'need-1', status: IncidentNeedStatus.Met }));
      const need = useCommandStore.getState().boards['101']?.board?.Needs?.[0];
      expect(need?.Status).toBe(IncidentNeedStatus.Met);
      expect(need?.QuantityFulfilled).toBe(2);
      expect(need?.MetOn).toBeTruthy();
    });
  });

  describe('updateObjectiveProgressEntry', () => {
    it('sets partial progress and flips a pending objective to in-progress', async () => {
      seedBoard();
      mockUpdateObjectiveProgress.mockResolvedValue({ Data: {} });

      await act(async () => {
        await useCommandStore.getState().updateObjectiveProgressEntry('101', 'obj-1', 40);
      });

      expect(mockUpdateObjectiveProgress).toHaveBeenCalledWith({ TacticalObjectiveId: 'obj-1', ProgressPercent: 40 });
    });

    it('marks the objective complete locally at 100% and queues offline', async () => {
      seedBoard();
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().updateObjectiveProgressEntry('101', 'obj-1', 100);
      });

      expect(mockAddEvent).toHaveBeenCalledWith(QueuedEventType.UPDATE_OBJECTIVE_PROGRESS, expect.objectContaining({ tacticalObjectiveId: 'obj-1', progressPercent: 100 }));
      const objective = useCommandStore.getState().boards['101']?.board?.Objectives?.[0];
      expect(objective?.Status).toBe(TacticalObjectiveStatus.Complete);
      expect(objective?.ProgressPercent).toBe(100);
    });
  });

  describe('updateNodeDetails', () => {
    it('merges the patch into the stored lane and saves the full node', async () => {
      seedBoard();
      mockSaveCommandNode.mockResolvedValue({ Data: {} });

      await act(async () => {
        await useCommandStore.getState().updateNodeDetails('101', 'node-1', { PrimaryLeadUserId: 'lead-1', PrimaryObjectiveId: 'obj-1' });
      });

      expect(mockSaveCommandNode).toHaveBeenCalledWith(
        expect.objectContaining({ CommandStructureNodeId: 'node-1', Name: 'Medical', PrimaryLeadUserId: 'lead-1', PrimaryObjectiveId: 'obj-1' })
      );
    });

    it('queues the lane edit when offline and updates the board locally', async () => {
      seedBoard();
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().updateNodeDetails('101', 'node-1', { SecondaryLeadName: 'Jane External', SecondaryLeadPhone: '555-0100' });
      });

      expect(mockSaveCommandNode).not.toHaveBeenCalled();
      expect(mockAddEvent).toHaveBeenCalledWith(QueuedEventType.UPDATE_COMMAND_NODE, expect.objectContaining({ callId: '101' }));
      const node = useCommandStore.getState().boards['101']?.board?.Nodes?.[0];
      expect(node?.SecondaryLeadName).toBe('Jane External');
    });
  });

  describe('updateCommandDetailsEntry', () => {
    it('saves estimated end and important information against the command', async () => {
      seedBoard();
      mockUpdateCommandDetails.mockResolvedValue({ Data: {} });

      await act(async () => {
        await useCommandStore.getState().updateCommandDetailsEntry('101', '2026-07-20T18:00:00Z', 'Stage east');
      });

      expect(mockUpdateCommandDetails).toHaveBeenCalledWith({ IncidentCommandId: 'cmd-101', EstimatedEndOn: '2026-07-20T18:00:00Z', ImportantInformation: 'Stage east' });
      const command = useCommandStore.getState().boards['101']?.board?.Command;
      expect(command?.ImportantInformation).toBe('Stage east');
    });

    it('queues the details update when offline', async () => {
      seedBoard();
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().updateCommandDetailsEntry('101', null, 'Watch the north wall');
      });

      expect(mockUpdateCommandDetails).not.toHaveBeenCalled();
      expect(mockAddEvent).toHaveBeenCalledWith(QueuedEventType.UPDATE_COMMAND_DETAILS, expect.objectContaining({ callId: '101', importantInformation: 'Watch the north wall' }));
    });
  });
});
