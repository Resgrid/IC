import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';

import { IncidentCard } from '../incident-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const board = {
  Command: { IncidentCommandId: 'ic-1', CallId: 5 },
  Nodes: [
    { CommandStructureNodeId: 'n1', DeletedOn: null },
    { CommandStructureNodeId: 'n2', DeletedOn: '2026-01-01T00:00:00Z' },
  ],
  Assignments: [{ ResourceAssignmentId: 'a1', ReleasedOn: null }],
  Objectives: [],
  Timers: [],
  Annotations: [],
  Accountability: [
    { UserId: 'u1', Status: 'Critical' },
    { UserId: 'u2', Status: 'Warning' },
  ],
  Roles: [],
} as unknown as IncidentCommandBoard;

describe('IncidentCard', () => {
  it('renders the title and live counts (excluding deleted lanes / released resources)', () => {
    render(<IncidentCard board={board} title="Structure Fire" onPress={() => {}} />);

    expect(screen.getByText('Structure Fire')).toBeTruthy();
    expect(screen.getByText('incidents.lanes: 1')).toBeTruthy();
    expect(screen.getByText('incidents.resources: 1')).toBeTruthy();
    expect(screen.getByText('incidents.par_critical: 1')).toBeTruthy();
    expect(screen.getByText('incidents.par_warning: 1')).toBeTruthy();
  });

  it('omits PAR badges when accountability is all clear', () => {
    const calm = { ...board, Accountability: [] } as unknown as IncidentCommandBoard;
    render(<IncidentCard board={calm} title="EMS Call" onPress={() => {}} />);

    expect(screen.queryByText(/par_critical/)).toBeNull();
    expect(screen.queryByText(/par_warning/)).toBeNull();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<IncidentCard board={board} title="Structure Fire" onPress={onPress} />);

    fireEvent.press(screen.getByTestId('incident-card'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
