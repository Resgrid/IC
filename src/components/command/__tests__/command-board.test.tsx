import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';

import { CommandBoard } from '../command-board';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const board = {
  Command: { IncidentCommandId: 'ic-1', CallId: 5 },
  Nodes: [
    { CommandStructureNodeId: 'n1', Name: 'Division A', NodeType: 0, SortOrder: 1, DeletedOn: null },
    { CommandStructureNodeId: 'n2', Name: 'Old Group', NodeType: 1, SortOrder: 0, DeletedOn: '2026-01-01T00:00:00Z' },
  ],
  Assignments: [{ ResourceAssignmentId: 'a1', CommandStructureNodeId: 'n1', ReleasedOn: null }],
  Objectives: [
    { TacticalObjectiveId: 'o1', Name: 'Primary search', Status: 1, SortOrder: 0 },
    { TacticalObjectiveId: 'o2', Name: 'Ventilation', Status: 0, SortOrder: 1 },
  ],
  Timers: [],
  Annotations: [],
  Accountability: [{ UserId: 'u1', FullName: 'Jane Doe', Status: 'Critical' }],
  Roles: [],
} as unknown as IncidentCommandBoard;

describe('CommandBoard', () => {
  it('renders live lanes with their ICS type and excludes deleted lanes', () => {
    render(<CommandBoard board={board} />);

    expect(screen.getByText('Division A')).toBeTruthy();
    expect(screen.getByText('Division')).toBeTruthy(); // CommandNodeType[0]
    expect(screen.queryByText('Old Group')).toBeNull();
  });

  it('renders objectives and personnel accountability', () => {
    render(<CommandBoard board={board} />);

    expect(screen.getByText('Primary search')).toBeTruthy();
    expect(screen.getByText('Ventilation')).toBeTruthy();
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('Critical')).toBeTruthy();
  });
});
