import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockMoveResourceAssignment = jest.fn().mockResolvedValue(null);
const mockReleaseResourceAssignment = jest.fn().mockResolvedValue(undefined);
const mockAssignResourceToNode = jest.fn().mockResolvedValue(null);

let mockCommandState: Record<string, unknown>;

jest.mock('@/stores/command/store', () => ({
  useCommandStore: (selector: any) => selector(mockCommandState),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: (selector: any) => selector({ showToast: jest.fn() }),
}));

import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import { CommandMarkerActions } from '../command-marker-actions';

const board = {
  Command: { IncidentCommandId: 'cmd-1' },
  Nodes: [
    { CommandStructureNodeId: 'lane-1', Name: 'Division A', Color: '#e74c3c', NodeType: 0, SortOrder: 0 },
    { CommandStructureNodeId: 'lane-2', Name: 'Medical', Color: null, NodeType: 2, SortOrder: 1 },
  ],
  Assignments: [{ ResourceAssignmentId: 'as-1', CommandStructureNodeId: 'lane-1', ResourceKind: 0, ResourceId: '5', AssignedOn: '2026-07-19T10:00:00Z' }],
};

const unitPin = { Id: 'u5', Title: 'Engine 1', Latitude: 39, Longitude: -119, Type: 1 } as MapMakerInfoData;
const untrackedPin = { Id: 'u9', Title: 'Brush 1', Latitude: 39, Longitude: -119, Type: 1 } as MapMakerInfoData;
const poiPin = { Id: 'poi-1', Title: 'Hydrant', Latitude: 39, Longitude: -119, Type: 4 } as MapMakerInfoData;

describe('CommandMarkerActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCommandState = {
      boards: { '101': { callId: '101', board } },
      activeCallId: '101',
      moveResourceAssignment: mockMoveResourceAssignment,
      releaseResourceAssignment: mockReleaseResourceAssignment,
      assignResourceToNode: mockAssignResourceToNode,
    };
  });

  it('shows lane chips for a tracked unit and moves it to a tapped lane', async () => {
    const onDone = jest.fn();
    const { getByTestId, getByText, unmount } = render(<CommandMarkerActions pin={unitPin} onDone={onDone} />);

    expect(getByText('Division A')).toBeTruthy();
    fireEvent.press(getByTestId('marker-lane-lane-2'));
    await waitFor(() => expect(mockMoveResourceAssignment).toHaveBeenCalledWith('101', 'as-1', 'lane-2'));
    expect(onDone).toHaveBeenCalled();

    unmount();
  });

  it('releases a tracked resource from the command', async () => {
    const { getByTestId, unmount } = render(<CommandMarkerActions pin={unitPin} />);

    fireEvent.press(getByTestId('marker-release'));
    await waitFor(() => expect(mockReleaseResourceAssignment).toHaveBeenCalledWith('101', 'as-1'));

    unmount();
  });

  it('offers Add to Command for an untracked department unit', async () => {
    const { getByTestId, unmount } = render(<CommandMarkerActions pin={untrackedPin} />);

    fireEvent.press(getByTestId('marker-add-to-command'));
    await waitFor(() => expect(mockAssignResourceToNode).toHaveBeenCalledWith('101', '', 0, '9'));

    unmount();
  });

  it('renders nothing for non-resource markers or without an active board', () => {
    const { queryByTestId, rerender, unmount } = render(<CommandMarkerActions pin={poiPin} />);
    expect(queryByTestId('command-marker-actions')).toBeNull();

    mockCommandState = { ...mockCommandState, activeCallId: null };
    rerender(<CommandMarkerActions pin={unitPin} />);
    expect(queryByTestId('command-marker-actions')).toBeNull();

    unmount();
  });
});
