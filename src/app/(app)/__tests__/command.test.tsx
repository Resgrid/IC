import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Dimensions } from 'react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) => React.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    AlarmClock: icon('alarm-clock'),
    Check: icon('check'),
    ClipboardList: icon('clipboard-list'),
    CloudOff: icon('cloud-off'),
    ExternalLink: icon('external-link'),
    GripVertical: icon('grip-vertical'),
    MapPin: icon('map-pin'),
    Mic: icon('mic'),
    MicOff: icon('mic-off'),
    Phone: icon('phone'),
    PhoneOff: icon('phone-off'),
    RadioTower: icon('radio-tower'),
    Plus: icon('plus'),
    RefreshCw: icon('refresh'),
    Trash2: icon('trash'),
    Truck: icon('truck'),
    UserCog: icon('user-cog'),
    UserPlus: icon('user-plus'),
    XCircle: icon('x-circle'),
  };
});

jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

jest.mock('@/components/ui/html-renderer', () => ({
  HtmlRenderer: () => null,
}));

// AnimatePresence-driven dialog never mounts under jest — flatten to plain views
jest.mock('@/components/ui/alert-dialog', () => {
  const React = require('react');
  const passthrough = (name: string) => (props: any) => React.createElement('View', { ...props, testID: props.testID ?? `mock-${name}` }, props.children);
  return {
    AlertDialog: ({ children, isOpen }: any) => (isOpen ? children : null),
    AlertDialogBackdrop: () => null,
    AlertDialogContent: passthrough('alert-content'),
    AlertDialogHeader: passthrough('alert-header'),
    AlertDialogBody: passthrough('alert-body'),
    AlertDialogFooter: passthrough('alert-footer'),
  };
});

jest.mock('@/components/command/add-assignment-sheet', () => ({
  AddAssignmentSheet: () => null,
}));

jest.mock('@/components/command/add-resource-sheet', () => ({
  AddResourceSheet: () => null,
}));

jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  getTimeAgoUtc: jest.fn(() => '5 minutes ago'),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: jest.fn(),
}));

jest.mock('@/stores/command/store', () => ({
  useCommandStore: jest.fn(),
}));

jest.mock('@/stores/roles/store', () => ({
  useRolesStore: jest.fn(),
}));

import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useCommandStore } from '@/stores/command/store';
import { useRolesStore } from '@/stores/roles/store';

import CommandBoard from '../command';

const mockUseCoreStore = useCoreStore as unknown as jest.Mock;
const mockUseCallsStore = useCallsStore as unknown as jest.Mock;
const mockUseCommandStore = useCommandStore as unknown as jest.Mock;
const mockUseRolesStore = useRolesStore as unknown as jest.Mock;

const mockSwitchCommand = jest.fn();
const mockEndCommand = jest.fn();
const mockRefreshBoard = jest.fn();
const mockRemoveRole = jest.fn();
const mockMoveResourceAssignment = jest.fn();
const mockReleaseResourceAssignment = jest.fn();
const mockFetchTimeline = jest.fn();
const mockRefreshAccountability = jest.fn();

const serverBoard = (callId: string, overrides: Record<string, unknown> = {}) => ({
  callId,
  board: {
    Command: { IncidentCommandId: `cmd-${callId}`, DepartmentId: 1, CallId: parseInt(callId, 10), EstablishedByUserId: 'u1', EstablishedOn: '2026-07-19T10:00:00Z', CurrentCommanderUserId: 'u1', IcsLevel: 1, Status: 0 },
    Nodes: [],
    Assignments: [],
    Objectives: [],
    Timers: [],
    Annotations: [],
    Accountability: [],
    Roles: [],
    ...overrides,
  },
  adHocUnits: [],
  adHocPersonnel: [],
  isProvisional: false,
  lastRefreshed: null,
});

const setupStores = ({ boards = {} as Record<string, unknown>, activeCallId = null as string | null, calls = [] as any[], users = [] as any[] }) => {
  const commandState = {
    boards,
    activeCallId,
    isRefreshing: false,
    switchCommand: mockSwitchCommand,
    endCommand: mockEndCommand,
    refreshBoard: mockRefreshBoard,
    assignRole: jest.fn(),
    removeRole: mockRemoveRole,
    addAdHocUnit: jest.fn(),
    releaseAdHocUnitEntry: jest.fn(),
    addAdHocPersonnel: jest.fn(),
    releaseAdHocPersonnelEntry: jest.fn(),
    refreshAccountability: mockRefreshAccountability,
    moveResourceAssignment: mockMoveResourceAssignment,
    releaseResourceAssignment: mockReleaseResourceAssignment,
    startTimer: jest.fn(),
    createVoiceChannel: jest.fn(),
    fetchVoiceChannels: jest.fn(),
    closeVoiceChannels: jest.fn(),
    fetchTransmissionLog: jest.fn(),
    recordTransmission: jest.fn(),
    acknowledgeTimer: jest.fn(),
    transferIncidentCommand: jest.fn(),
    fetchTimeline: mockFetchTimeline,
  };
  mockUseCommandStore.mockImplementation((selector: any) => (selector ? selector(commandState) : commandState));

  const coreState = { activeCall: null, activePriority: null };
  mockUseCoreStore.mockImplementation((selector: any) => (selector ? selector(coreState) : coreState));

  const callsState = { calls };
  mockUseCallsStore.mockImplementation((selector: any) => (selector ? selector(callsState) : callsState));

  const rolesState = { users, roles: [] as any[], fetchUsers: jest.fn() };
  mockUseRolesStore.mockImplementation((selector: any) => (selector ? selector(rolesState) : rolesState));
};

describe('CommandBoard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the zero state with a link to calls when no board is open', () => {
    setupStores({});

    const { getByTestId, getByText, unmount } = render(<CommandBoard />);

    expect(getByTestId('command-board-screen')).toBeTruthy();
    expect(getByText('command.empty_heading')).toBeTruthy();

    fireEvent.press(getByTestId('command-go-to-calls'));
    expect(mockPush).toHaveBeenCalledWith('/calls');

    unmount();
  });

  it('renders the board sections for the active board', () => {
    setupStores({
      boards: { '101': serverBoard('101') },
      activeCallId: '101',
      calls: [{ CallId: '101', Number: '26-14', Name: 'Structure Fire', Address: '123 Main St', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
    });

    const { getByTestId, unmount } = render(<CommandBoard />);

    expect(getByTestId('command-active-call')).toBeTruthy();
    expect(getByTestId('command-roles-section')).toBeTruthy();
    expect(getByTestId('command-resources-section')).toBeTruthy();
    expect(getByTestId('command-accountability-section')).toBeTruthy();

    unmount();
  });

  it('shows a board switcher when multiple commands are open and switches on tap', () => {
    setupStores({
      boards: { '101': serverBoard('101'), '102': serverBoard('102') },
      activeCallId: '101',
      calls: [
        { CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' },
        { CallId: '102', Number: '26-15', Name: 'MVA', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' },
      ],
    });

    const { getByTestId, unmount } = render(<CommandBoard />);

    expect(getByTestId('command-board-switcher')).toBeTruthy();
    fireEvent.press(getByTestId('command-board-tab-102'));
    expect(mockSwitchCommand).toHaveBeenCalledWith('102');

    unmount();
  });

  it('renders server roles, ad-hoc units, and PAR accountability rows', () => {
    const board = serverBoard('101', {
      Roles: [{ IncidentRoleAssignmentId: 'ra-1', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, UserId: 'u-9', RoleType: 7, AssignedByUserId: 'u1', AssignedOn: '2026-07-19T10:00:00Z' }],
      Accountability: [{ UserId: 'u-2', FullName: 'Crew A Leader', LastCheckIn: '2026-07-19T10:30:00Z', NeedsCheckIn: false, MinutesRemaining: 12, Status: 'Green', DurationMinutes: 20, WarningThresholdMinutes: 5 }],
    }) as any;
    board.adHocUnits = [{ IncidentAdHocUnitId: 'ah-1', DepartmentId: 1, CallId: 101, Name: 'Mutual Aid Engine', Type: 'Engine', CreatedByUserId: 'u1', CreatedOn: '2026-07-19T10:00:00Z' }];

    setupStores({
      boards: { '101': board },
      activeCallId: '101',
      calls: [{ CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
      users: [{ UserId: 'u-9', FirstName: 'Sam', LastName: 'Jones' }],
    });

    const { getByTestId, getByText, unmount } = render(<CommandBoard />);

    expect(getByText('Sam Jones')).toBeTruthy();
    expect(getByText('Mutual Aid Engine')).toBeTruthy();
    expect(getByText('Crew A Leader')).toBeTruthy();
    expect(getByText('command.par_green')).toBeTruthy();

    fireEvent.press(getByTestId('assignment-remove-ra-1'));
    expect(mockRemoveRole).toHaveBeenCalledWith('101', 'ra-1');

    unmount();
  });

  it('lists tracked department units and personnel as resources with their lane and releases on remove', () => {
    const board = serverBoard('101', {
      Nodes: [{ CommandStructureNodeId: 'lane-1', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, NodeType: 0, Name: 'Division A', SortOrder: 0 }],
      Assignments: [
        // Department unit assigned to a lane
        { ResourceAssignmentId: 'as-1', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, CommandStructureNodeId: 'lane-1', ResourceKind: 0, ResourceId: 'unit-5', AssignedByUserId: 'u1', AssignedOn: '2026-07-19T10:00:00Z', RequirementsWarning: false },
        // Department person in the unassigned pool (no lane)
        { ResourceAssignmentId: 'as-2', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, CommandStructureNodeId: '', ResourceKind: 1, ResourceId: 'u-9', AssignedByUserId: 'u1', AssignedOn: '2026-07-19T10:00:00Z', RequirementsWarning: false },
      ],
    }) as any;

    setupStores({
      boards: { '101': board },
      activeCallId: '101',
      calls: [{ CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
      users: [{ UserId: 'u-9', FirstName: 'Sam', LastName: 'Jones', GroupName: 'Station 1', Status: 'Responding' }],
    });

    const { getByTestId, getByText, unmount } = render(<CommandBoard />);

    expect(getByTestId('resource-dept-as-1')).toBeTruthy();
    expect(getByTestId('resource-dept-as-2')).toBeTruthy();
    expect(getByText('Sam Jones')).toBeTruthy();
    expect(getByText('Station 1')).toBeTruthy();
    expect(getByTestId('resource-dept-as-2-status')).toBeTruthy();
    expect(getByText('command.unassigned')).toBeTruthy();

    fireEvent.press(getByTestId('resource-dept-remove-as-1'));
    expect(mockReleaseResourceAssignment).toHaveBeenCalledWith('101', 'as-1');

    unmount();
  });

  it('prompts to move a resource already assigned to another lane and moves on confirm', async () => {
    const board = serverBoard('101', {
      Nodes: [
        { CommandStructureNodeId: 'lane-1', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, NodeType: 0, Name: 'Division A', SortOrder: 0 },
        { CommandStructureNodeId: 'lane-2', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, NodeType: 2, Name: 'Medical', SortOrder: 1 },
      ],
      Assignments: [
        { ResourceAssignmentId: 'as-9', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, CommandStructureNodeId: 'lane-1', ResourceKind: 4, ResourceId: 'ah-1', AssignedByUserId: 'u1', AssignedOn: '2026-07-19T10:00:00Z', RequirementsWarning: false },
      ],
    }) as any;
    board.adHocUnits = [{ IncidentAdHocUnitId: 'ah-1', DepartmentId: 1, CallId: 101, Name: 'Mutual Aid Engine', Type: 'Engine', CreatedByUserId: 'u1', CreatedOn: '2026-07-19T10:00:00Z' }];

    setupStores({
      boards: { '101': board },
      activeCallId: '101',
      calls: [{ CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
    });

    const { getByTestId, queryByTestId, unmount } = render(<CommandBoard />);

    // Open the assign sheet for the OTHER lane and pick the already-assigned ad-hoc unit
    fireEvent.press(getByTestId('lane-assign-lane-2'));
    await waitFor(() => expect(getByTestId('resource-kind-tab-2')).toBeTruthy());
    fireEvent.press(getByTestId('resource-kind-tab-2'));
    fireEvent.press(getByTestId('resource-option-4-ah-1'));
    fireEvent.press(getByTestId('resource-assign-save'));

    // Conflict dialog appears; cancel does nothing
    await waitFor(() => expect(getByTestId('move-conflict-dialog')).toBeTruthy());
    fireEvent.press(getByTestId('move-conflict-cancel'));
    expect(mockMoveResourceAssignment).not.toHaveBeenCalled();

    // Repeat and confirm — the existing assignment is moved, not duplicated
    fireEvent.press(getByTestId('lane-assign-lane-2'));
    await waitFor(() => expect(getByTestId('resource-kind-tab-2')).toBeTruthy());
    fireEvent.press(getByTestId('resource-kind-tab-2'));
    fireEvent.press(getByTestId('resource-option-4-ah-1'));
    fireEvent.press(getByTestId('resource-assign-save'));
    await waitFor(() => expect(getByTestId('move-conflict-dialog')).toBeTruthy());
    fireEvent.press(getByTestId('move-conflict-confirm'));

    await waitFor(() => expect(mockMoveResourceAssignment).toHaveBeenCalledWith('101', 'as-9', 'lane-2'));
    expect(queryByTestId('move-conflict-dialog')).toBeNull();

    unmount();
  });

  it('ends the active command and supports manual refresh', () => {
    setupStores({
      boards: { '101': serverBoard('101') },
      activeCallId: '101',
      calls: [{ CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
    });

    const { getByTestId, unmount } = render(<CommandBoard />);

    fireEvent.press(getByTestId('command-end-command'));
    expect(mockEndCommand).toHaveBeenCalledWith('101');

    fireEvent.press(getByTestId('command-refresh'));
    expect(mockRefreshBoard).toHaveBeenCalledWith('101');
    expect(mockRefreshAccountability).toHaveBeenCalledWith('101');

    unmount();
  });

  it('shows the provisional badge for a board established offline', () => {
    const board = serverBoard('101') as any;
    board.isProvisional = true;
    board.board = null;

    setupStores({
      boards: { '101': board },
      activeCallId: '101',
      calls: [{ CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
    });

    const { getByTestId, unmount } = render(<CommandBoard />);

    expect(getByTestId('command-provisional-badge')).toBeTruthy();

    unmount();
  });

  it('keeps the vertical layout on a phone in landscape', () => {
    const landscapePhone = { fontScale: 1, height: 390, scale: 1, width: 844 };
    act(() => Dimensions.set({ screen: landscapePhone, window: landscapePhone }));
    setupStores({
      activeCallId: '101',
      boards: { '101': serverBoard('101') },
      calls: [{ CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
    });

    const { getByTestId, queryByTestId, unmount } = render(<CommandBoard />);

    expect(getByTestId('command-structure-section')).toBeTruthy();
    expect(queryByTestId('command-landscape-structure-board')).toBeNull();

    unmount();
    const portrait = { fontScale: 1, height: 844, scale: 1, width: 390 };
    act(() => Dimensions.set({ screen: portrait, window: portrait }));
  });

  it('uses horizontal swimlanes on landscape tablets and moves a selected resource on lane tap', async () => {
    const landscape = { fontScale: 1, height: 800, scale: 1, width: 1200 };
    act(() => Dimensions.set({ screen: landscape, window: landscape }));
    const board = serverBoard('101', {
      Assignments: [
        {
          ResourceAssignmentId: 'resource-assignment-1',
          IncidentCommandId: 'cmd-101',
          DepartmentId: 1,
          CallId: 101,
          CommandStructureNodeId: 'lane-1',
          ResourceKind: 1,
          ResourceId: 'u-9',
          AssignedByUserId: 'u1',
          AssignedOn: '2026-07-19T10:00:00Z',
          RequirementsWarning: false,
        },
      ],
      Nodes: [
        { CommandStructureNodeId: 'lane-1', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, NodeType: 0, Name: 'Division A', SortOrder: 0 },
        { CommandStructureNodeId: 'lane-2', IncidentCommandId: 'cmd-101', DepartmentId: 1, CallId: 101, NodeType: 6, Name: 'Staging', SortOrder: 1 },
      ],
    });
    setupStores({
      activeCallId: '101',
      boards: { '101': board },
      calls: [{ CallId: '101', Number: '26-14', Name: 'Fire', Address: '', Nature: '', LoggedOnUtc: '2026-07-19T10:00:00Z' }],
      users: [{ UserId: 'u-9', FirstName: 'Sam', LastName: 'Jones' }],
    });

    const { getByTestId, unmount } = render(<CommandBoard />);

    expect(getByTestId('command-landscape-structure-board')).toBeTruthy();
    expect(getByTestId('command-landscape-lanes')).toBeTruthy();
    const resourceCard = getByTestId('landscape-resource-resource-assignment-1');
    fireEvent(resourceCard, 'longPress');
    expect(getByTestId('landscape-drop-target-lane-2')).toBeTruthy();
    fireEvent(resourceCard, 'pressOut');
    await waitFor(() => expect(resourceCard.props.className).not.toContain('bg-primary-50'));
    fireEvent.press(resourceCard);
    fireEvent.press(getByTestId('landscape-lane-lane-2'));

    await waitFor(() => expect(mockMoveResourceAssignment).toHaveBeenCalledWith('101', 'resource-assignment-1', 'lane-2'));

    unmount();
    const portrait = { fontScale: 1, height: 844, scale: 1, width: 390 };
    act(() => Dimensions.set({ screen: portrait, window: portrait }));
  });
});
