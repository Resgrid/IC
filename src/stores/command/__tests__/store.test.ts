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

const mockEstablishCommand = jest.fn();
const mockGetCommandBoard = jest.fn();
const mockCloseCommand = jest.fn();
const mockGetAccountability = jest.fn();
const mockEvaluateAccountability = jest.fn();

const mockSaveCommandNode = jest.fn();
const mockDeleteCommandNode = jest.fn();
const mockAssignResource = jest.fn();
const mockMoveResource = jest.fn();
const mockReleaseResource = jest.fn();
const mockSaveObjective = jest.fn();
const mockCompleteObjective = jest.fn();

jest.mock('@/api/incidentCommand/incidentCommand', () => ({
  establishCommand: (...args: unknown[]) => mockEstablishCommand(...args),
  getCommandBoard: (...args: unknown[]) => mockGetCommandBoard(...args),
  closeCommand: (...args: unknown[]) => mockCloseCommand(...args),
  getAccountability: (...args: unknown[]) => mockGetAccountability(...args),
  evaluateAccountability: (...args: unknown[]) => mockEvaluateAccountability(...args),
  saveCommandNode: (...args: unknown[]) => mockSaveCommandNode(...args),
  deleteCommandNode: (...args: unknown[]) => mockDeleteCommandNode(...args),
  assignResource: (...args: unknown[]) => mockAssignResource(...args),
  moveResource: (...args: unknown[]) => mockMoveResource(...args),
  releaseResource: (...args: unknown[]) => mockReleaseResource(...args),
  saveObjective: (...args: unknown[]) => mockSaveObjective(...args),
  completeObjective: (...args: unknown[]) => mockCompleteObjective(...args),
}));

const mockCreateAdHocUnit = jest.fn();
const mockGetAdHocUnits = jest.fn();
const mockReleaseAdHocUnit = jest.fn();

const mockCreateAdHocPersonnel = jest.fn();
const mockGetAdHocPersonnel = jest.fn();
const mockReleaseAdHocPersonnel = jest.fn();

jest.mock('@/api/incidentCommand/incidentVoice', () => ({
  createIncidentChannel: jest.fn().mockResolvedValue({ Data: { DepartmentVoiceChannelId: 'ch-1', Name: 'Tactical' } }),
  getChannelsForCall: jest.fn().mockResolvedValue({ Data: [] }),
  closeIncidentChannels: jest.fn().mockResolvedValue({ Data: true }),
  logTransmission: jest.fn().mockResolvedValue({ Data: null }),
  getTransmissionLog: jest.fn().mockResolvedValue({ Data: [] }),
}));

jest.mock('@/api/incidentCommand/incidentResources', () => ({
  createAdHocUnit: (...args: unknown[]) => mockCreateAdHocUnit(...args),
  getAdHocUnits: (...args: unknown[]) => mockGetAdHocUnits(...args),
  releaseAdHocUnit: (...args: unknown[]) => mockReleaseAdHocUnit(...args),
  createAdHocPersonnel: (...args: unknown[]) => mockCreateAdHocPersonnel(...args),
  getAdHocPersonnel: (...args: unknown[]) => mockGetAdHocPersonnel(...args),
  releaseAdHocPersonnel: (...args: unknown[]) => mockReleaseAdHocPersonnel(...args),
}));

const mockAssignIncidentRole = jest.fn();
const mockRemoveIncidentRole = jest.fn();

jest.mock('@/api/incidentCommand/incidentRoles', () => ({
  assignIncidentRole: (...args: unknown[]) => mockAssignIncidentRole(...args),
  removeIncidentRole: (...args: unknown[]) => mockRemoveIncidentRole(...args),
}));

const mockGetSyncBundle = jest.fn();

jest.mock('@/api/incidentCommand/sync', () => ({
  getSyncBundle: (...args: unknown[]) => mockGetSyncBundle(...args),
}));

import { CommandNodeType, IncidentRoleType, ResourceAssignmentKind, TacticalObjectiveStatus, TacticalObjectiveType } from '@/models/v4/incidentCommand/incidentCommandModels';

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
  Nodes: [],
  Assignments: [],
  Objectives: [],
  Needs: [],
  Timers: [],
  Annotations: [],
  Accountability: [],
  Roles: [],
});

describe('Command Store (server-backed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnline = true;
    useCommandStore.setState({ boards: {}, activeCallId: null, lastSyncTimestampMs: 0, isRefreshing: false });

    mockEstablishCommand.mockResolvedValue({ Data: serverBoard(101).Command });
    mockGetCommandBoard.mockResolvedValue({ Data: serverBoard(101) });
    mockGetAdHocUnits.mockResolvedValue({ Data: [] });
    mockGetAdHocPersonnel.mockResolvedValue({ Data: [] });
    mockCreateAdHocPersonnel.mockResolvedValue({ Data: {} });
    mockReleaseAdHocPersonnel.mockResolvedValue({ Data: true });
    mockCloseCommand.mockResolvedValue({ Data: serverBoard(101).Command });
    mockAssignIncidentRole.mockResolvedValue({ Data: {} });
    mockRemoveIncidentRole.mockResolvedValue({ Data: true });
    mockCreateAdHocUnit.mockResolvedValue({ Data: {} });
    mockReleaseAdHocUnit.mockResolvedValue({ Data: true });
    mockGetAccountability.mockResolvedValue({ Data: [] });
    mockEvaluateAccountability.mockResolvedValue({ Data: [] });
    mockGetSyncBundle.mockResolvedValue({ Data: { ServerTimestampMs: 123, Boards: [], AdHocUnits: [], AdHocPersonnel: [] } });
    mockSaveCommandNode.mockResolvedValue({ Data: {} });
    mockDeleteCommandNode.mockResolvedValue({ Data: true });
    mockAssignResource.mockResolvedValue({ Data: { RequirementsWarning: false } });
    mockMoveResource.mockResolvedValue({ Data: { RequirementsWarning: false } });
    mockReleaseResource.mockResolvedValue({ Data: true });
    mockSaveObjective.mockResolvedValue({ Data: {} });
    mockCompleteObjective.mockResolvedValue({ Data: {} });
  });

  it('startCommand establishes on the server and loads the board', async () => {
    await act(async () => {
      await useCommandStore.getState().startCommand('101');
    });

    expect(mockEstablishCommand).toHaveBeenCalledWith({ CallId: 101, CommandDefinitionId: null });
    expect(mockGetCommandBoard).toHaveBeenCalledWith('101');
    const state = useCommandStore.getState();
    expect(state.boards['101'].board?.Command.IncidentCommandId).toBe('cmd-101');
    expect(state.boards['101'].isProvisional).toBe(false);
    expect(state.activeCallId).toBe('101');
    expect(mockSetActiveCall).toHaveBeenCalledWith('101');
  });

  it('startCommand offline creates a provisional board and queues the establish event', async () => {
    mockOnline = false;

    await act(async () => {
      await useCommandStore.getState().startCommand('101');
    });

    expect(mockEstablishCommand).not.toHaveBeenCalled();
    expect(mockAddEvent).toHaveBeenCalledWith('establish_command', { callId: '101', commandDefinitionId: null });
    const state = useCommandStore.getState();
    expect(state.boards['101'].isProvisional).toBe(true);
    expect(state.boards['101'].board).toBeNull();
  });

  it('supports multiple concurrent boards and switching', async () => {
    mockGetCommandBoard.mockImplementation((callId: unknown) => Promise.resolve({ Data: serverBoard(parseInt(String(callId), 10)) }));

    await act(async () => {
      await useCommandStore.getState().startCommand('101');
      await useCommandStore.getState().startCommand('102');
      await useCommandStore.getState().switchCommand('101');
    });

    const state = useCommandStore.getState();
    expect(Object.keys(state.boards).sort()).toEqual(['101', '102']);
    expect(state.activeCallId).toBe('101');
    expect(mockSetActiveCall).toHaveBeenLastCalledWith('101');
  });

  it('endCommand closes on the server and activates the next open board', async () => {
    mockGetCommandBoard.mockImplementation((callId: unknown) => Promise.resolve({ Data: serverBoard(parseInt(String(callId), 10)) }));

    await act(async () => {
      await useCommandStore.getState().startCommand('101');
      await useCommandStore.getState().startCommand('102');
      await useCommandStore.getState().endCommand('102');
    });

    expect(mockCloseCommand).toHaveBeenCalledWith('cmd-102');
    const state = useCommandStore.getState();
    expect(state.boards['102']).toBeUndefined();
    expect(state.activeCallId).toBe('101');
  });

  it('endCommand offline queues the close event', async () => {
    await act(async () => {
      await useCommandStore.getState().startCommand('101');
    });

    mockOnline = false;
    await act(async () => {
      await useCommandStore.getState().endCommand('101');
    });

    expect(mockAddEvent).toHaveBeenCalledWith('close_command', { callId: '101', incidentCommandId: 'cmd-101' });
    expect(useCommandStore.getState().boards['101']).toBeUndefined();
    expect(mockSetActiveCall).toHaveBeenLastCalledWith(null);
  });

  it('assignRole calls the IncidentRoles API and refreshes the board', async () => {
    await act(async () => {
      await useCommandStore.getState().startCommand('101');
      await useCommandStore.getState().assignRole('101', IncidentRoleType.SafetyOfficer, 'user-9');
    });

    expect(mockAssignIncidentRole).toHaveBeenCalledWith(expect.objectContaining({ CallId: 101, RoleType: IncidentRoleType.SafetyOfficer, UserId: 'user-9' }));
  });

  it('assignRole offline queues the event and applies an optimistic local row', async () => {
    await act(async () => {
      await useCommandStore.getState().startCommand('101');
    });

    mockOnline = false;
    await act(async () => {
      await useCommandStore.getState().assignRole('101', IncidentRoleType.IncidentCommander, 'user-1');
    });

    expect(mockAddEvent).toHaveBeenCalledWith('assign_incident_role', { callId: '101', roleType: IncidentRoleType.IncidentCommander, userId: 'user-1' });
    const roles = useCommandStore.getState().boards['101'].board?.Roles ?? [];
    expect(roles).toHaveLength(1);
    expect(roles[0].IncidentRoleAssignmentId.startsWith('local-')).toBe(true);
  });

  it('removeRole for a local-only assignment does not queue or call the API', async () => {
    await act(async () => {
      await useCommandStore.getState().startCommand('101');
    });
    mockOnline = false;
    await act(async () => {
      await useCommandStore.getState().assignRole('101', IncidentRoleType.IncidentCommander, 'user-1');
    });
    const localId = useCommandStore.getState().boards['101'].board!.Roles[0].IncidentRoleAssignmentId;
    mockAddEvent.mockClear();

    await act(async () => {
      await useCommandStore.getState().removeRole('101', localId);
    });

    expect(mockRemoveIncidentRole).not.toHaveBeenCalled();
    expect(mockAddEvent).not.toHaveBeenCalled();
    expect(useCommandStore.getState().boards['101'].board?.Roles).toHaveLength(0);
  });

  it('addAdHocUnit calls the IncidentResources API when online and queues offline', async () => {
    await act(async () => {
      await useCommandStore.getState().startCommand('101');
      await useCommandStore.getState().addAdHocUnit('101', 'Mutual Aid Engine', 'Engine');
    });
    expect(mockCreateAdHocUnit).toHaveBeenCalledWith({ CallId: 101, Name: 'Mutual Aid Engine', Type: 'Engine' });

    mockOnline = false;
    await act(async () => {
      await useCommandStore.getState().addAdHocUnit('101', 'Offline Tender', 'Tender');
    });
    expect(mockAddEvent).toHaveBeenCalledWith('create_adhoc_unit', { callId: '101', name: 'Offline Tender', type: 'Tender' });
    expect(useCommandStore.getState().boards['101'].adHocUnits.some((u) => u.Name === 'Offline Tender')).toBe(true);
  });

  it('syncFromServer hydrates boards from the Sync Bundle and stores the cursor', async () => {
    mockGetSyncBundle.mockResolvedValue({
      Data: {
        ServerTimestampMs: 999,
        Boards: [serverBoard(202)],
        AdHocUnits: [{ IncidentAdHocUnitId: 'ah-1', DepartmentId: 1, CallId: 202, Name: 'Aid 1', CreatedByUserId: 'u1', CreatedOn: '2026-07-19T10:00:00Z' }],
        AdHocPersonnel: [],
      },
    });

    await act(async () => {
      await useCommandStore.getState().syncFromServer();
    });

    const state = useCommandStore.getState();
    expect(state.boards['202'].board?.Command.IncidentCommandId).toBe('cmd-202');
    expect(state.boards['202'].adHocUnits).toHaveLength(1);
    expect(state.lastSyncTimestampMs).toBe(999);
  });

  it('refreshAccountability evaluates then reloads PAR data', async () => {
    mockGetAccountability.mockResolvedValue({ Data: [{ UserId: 'u1', FullName: 'Smith', NeedsCheckIn: false, MinutesRemaining: 10, Status: 'Green', DurationMinutes: 20, WarningThresholdMinutes: 5 }] });

    await act(async () => {
      await useCommandStore.getState().startCommand('101');
      await useCommandStore.getState().refreshAccountability('101');
    });

    expect(mockEvaluateAccountability).toHaveBeenCalledWith('101');
    expect(useCommandStore.getState().boards['101'].board?.Accountability).toHaveLength(1);
  });

  describe('command structure lanes', () => {
    it('addNode saves the lane against the server command', async () => {
      await act(async () => {
        await useCommandStore.getState().startCommand('101');
        await useCommandStore.getState().addNode('101', 'Division A', CommandNodeType.Division);
      });

      expect(mockSaveCommandNode).toHaveBeenCalledWith(expect.objectContaining({ IncidentCommandId: 'cmd-101', CallId: 101, Name: 'Division A', NodeType: CommandNodeType.Division }));
    });

    it('addNode offline queues the event and adds an optimistic lane', async () => {
      await act(async () => {
        await useCommandStore.getState().startCommand('101');
      });
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().addNode('101', 'Staging', CommandNodeType.Staging);
      });

      expect(mockAddEvent).toHaveBeenCalledWith('save_command_node', { callId: '101', name: 'Staging', nodeType: CommandNodeType.Staging });
      const nodes = useCommandStore.getState().boards['101'].board?.Nodes ?? [];
      expect(nodes).toHaveLength(1);
      expect(nodes[0].CommandStructureNodeId.startsWith('local-')).toBe(true);
    });

    it('assignResourceToNode returns a blocked outcome when the lane forces unmet requirements', async () => {
      // Forced rejection: HTTP 200, no Data, reason in Message
      mockAssignResource.mockResolvedValue({ Data: null, Status: 'Failure', Message: "Unit 'Brush 1' does not match the unit types required by lane 'Entry Group'." });

      let outcome: import("../store").AssignmentOutcome | null = null;
      await act(async () => {
        await useCommandStore.getState().startCommand('101');
        outcome = await useCommandStore.getState().assignResourceToNode('101', 'node-1', ResourceAssignmentKind.RealUnit, 'unit-9');
      });

      expect(outcome).toEqual({ blocked: "Unit 'Brush 1' does not match the unit types required by lane 'Entry Group'." });
    });

    it('assignResourceToNode returns the requirements warning message', async () => {
      mockAssignResource.mockResolvedValue({ Data: { RequirementsWarning: true, RequirementsWarningMessage: 'Needs 2 personnel' } });

      let warning: import("../store").AssignmentOutcome | null = null;
      await act(async () => {
        await useCommandStore.getState().startCommand('101');
        warning = await useCommandStore.getState().assignResourceToNode('101', 'node-1', ResourceAssignmentKind.RealUnit, 'unit-5');
      });

      expect(mockAssignResource).toHaveBeenCalledWith(expect.objectContaining({ CommandStructureNodeId: 'node-1', ResourceKind: ResourceAssignmentKind.RealUnit, ResourceId: 'unit-5' }));
      expect(warning).toEqual({ warning: 'Needs 2 personnel' });
    });

    it('moveResourceAssignment uses the move endpoint and returns requirements warnings', async () => {
      const board = {
        ...serverBoard(101),
        Assignments: [
          {
            ResourceAssignmentId: 'assignment-1',
            IncidentCommandId: 'cmd-101',
            DepartmentId: 1,
            CallId: 101,
            CommandStructureNodeId: 'node-1',
            ResourceKind: ResourceAssignmentKind.RealUnit,
            ResourceId: 'unit-5',
            AssignedByUserId: 'u1',
            AssignedOn: '2026-07-19T10:00:00Z',
            RequirementsWarning: false,
          },
        ],
      };
      useCommandStore.setState({ boards: { '101': { callId: '101', board, adHocUnits: [], adHocPersonnel: [], isProvisional: false, lastRefreshed: null } }, activeCallId: '101' });
      mockMoveResource.mockResolvedValue({ Data: { RequirementsWarning: true, RequirementsWarningMessage: 'Supervisor required' } });

      let warning: import("../store").AssignmentOutcome | null = null;
      await act(async () => {
        warning = await useCommandStore.getState().moveResourceAssignment('101', 'assignment-1', 'node-2');
      });

      expect(mockMoveResource).toHaveBeenCalledWith({ ResourceAssignmentId: 'assignment-1', TargetNodeId: 'node-2' });
      expect(warning).toEqual({ warning: 'Supervisor required' });
    });

    it('moveResourceAssignment updates the lane immediately and queues the move offline', async () => {
      const board = {
        ...serverBoard(101),
        Assignments: [
          {
            ResourceAssignmentId: 'assignment-1',
            IncidentCommandId: 'cmd-101',
            DepartmentId: 1,
            CallId: 101,
            CommandStructureNodeId: 'node-1',
            ResourceKind: ResourceAssignmentKind.RealPersonnel,
            ResourceId: 'user-5',
            AssignedByUserId: 'u1',
            AssignedOn: '2026-07-19T10:00:00Z',
            RequirementsWarning: false,
          },
        ],
      };
      useCommandStore.setState({ boards: { '101': { callId: '101', board, adHocUnits: [], adHocPersonnel: [], isProvisional: false, lastRefreshed: null } }, activeCallId: '101' });
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().moveResourceAssignment('101', 'assignment-1', 'node-2');
      });

      expect(useCommandStore.getState().boards['101'].board?.Assignments[0].CommandStructureNodeId).toBe('node-2');
      expect(mockAddEvent).toHaveBeenCalledWith('move_command_resource', { callId: '101', resourceAssignmentId: 'assignment-1', targetNodeId: 'node-2' });
      expect(mockMoveResource).not.toHaveBeenCalled();
    });

    it('deleteNode drops local lanes without calling the API', async () => {
      await act(async () => {
        await useCommandStore.getState().startCommand('101');
      });
      mockOnline = false;
      await act(async () => {
        await useCommandStore.getState().addNode('101', 'Staging', CommandNodeType.Staging);
      });
      const nodeId = useCommandStore.getState().boards['101'].board!.Nodes[0].CommandStructureNodeId;
      mockAddEvent.mockClear();

      await act(async () => {
        await useCommandStore.getState().deleteNode('101', nodeId);
      });

      expect(mockDeleteCommandNode).not.toHaveBeenCalled();
      expect(mockAddEvent).not.toHaveBeenCalled();
      expect(useCommandStore.getState().boards['101'].board?.Nodes).toHaveLength(0);
    });
  });

  describe('tactical objectives', () => {
    it('addObjective saves against the server command', async () => {
      await act(async () => {
        await useCommandStore.getState().startCommand('101');
        await useCommandStore.getState().addObjective('101', 'Primary search', TacticalObjectiveType.Benchmark);
      });

      expect(mockSaveObjective).toHaveBeenCalledWith(expect.objectContaining({ IncidentCommandId: 'cmd-101', CallId: 101, Name: 'Primary search', ObjectiveType: TacticalObjectiveType.Benchmark }));
    });

    it('completeObjectiveEntry optimistically completes and calls the API', async () => {
      const boardWithObjective = serverBoard(101) as any;
      boardWithObjective.Objectives = [
        { TacticalObjectiveId: 'obj-1', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, Name: 'Vent roof', ObjectiveType: 0, Status: TacticalObjectiveStatus.Pending, AutoPopulated: false, SortOrder: 0 },
      ];
      mockGetCommandBoard.mockResolvedValue({ Data: boardWithObjective });

      await act(async () => {
        await useCommandStore.getState().startCommand('101');
        await useCommandStore.getState().completeObjectiveEntry('101', 'obj-1');
      });

      expect(mockCompleteObjective).toHaveBeenCalledWith('obj-1');
      expect(useCommandStore.getState().boards['101'].board?.Objectives[0].Status).toBe(TacticalObjectiveStatus.Complete);
    });

    it('addObjective offline queues the event with an optimistic pending row', async () => {
      await act(async () => {
        await useCommandStore.getState().startCommand('101');
      });
      mockOnline = false;

      await act(async () => {
        await useCommandStore.getState().addObjective('101', 'Utilities secured', TacticalObjectiveType.General);
      });

      expect(mockAddEvent).toHaveBeenCalledWith('save_objective', { callId: '101', name: 'Utilities secured', objectiveType: TacticalObjectiveType.General });
      const objectives = useCommandStore.getState().boards['101'].board?.Objectives ?? [];
      expect(objectives).toHaveLength(1);
      expect(objectives[0].Status).toBe(TacticalObjectiveStatus.Pending);
    });
  });
});
