import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  return {
    Check: (props: any) => React.createElement('View', { ...props, testID: 'mock-check-icon' }),
  };
});

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

import { ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandModels';

import { type AssignableResourceOption, AssignResourceSheet } from '../assign-resource-sheet';

const options: AssignableResourceOption[] = [
  { kind: ResourceAssignmentKind.RealUnit, id: 'unit-1', name: 'Engine 1', detail: 'Engine • Station 1', statusLabel: 'Enroute', assignedNodeId: 'lane-1' },
  { kind: ResourceAssignmentKind.RealUnit, id: 'unit-2', name: 'Brush 1', detail: 'Brush • Station 1', assignedNodeId: 'lane-2' },
  { kind: ResourceAssignmentKind.RealUnit, id: 'unit-3', name: 'Utility 2', assignedNodeId: '' },
  { kind: ResourceAssignmentKind.RealPersonnel, id: 'user-1', name: 'Sam Jones', detail: 'Station 1 • Available', chips: ['Medic', 'Driver'] },
];

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  options,
  targetNodeId: 'lane-1',
  resolveLaneName: (nodeId?: string | null) => (nodeId === 'lane-2' ? 'Division B' : 'command.unassigned'),
  onSave: jest.fn(),
};

describe('AssignResourceSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables resources already in the target lane and cannot select them', () => {
    const { getByTestId, unmount } = render(<AssignResourceSheet {...baseProps} />);

    expect(getByTestId('resource-option-in-lane-0-unit-1')).toBeTruthy();
    fireEvent.press(getByTestId('resource-option-0-unit-1'));
    fireEvent.press(getByTestId('resource-assign-save'));
    expect(baseProps.onSave).not.toHaveBeenCalled();

    unmount();
  });

  it('shows the current lane badge for resources assigned elsewhere and the pool badge for unassigned', () => {
    const { getByTestId, getByText, unmount } = render(<AssignResourceSheet {...baseProps} />);

    expect(getByTestId('resource-option-other-lane-0-unit-2')).toBeTruthy();
    expect(getByText('Division B')).toBeTruthy();
    expect(getByText('command.unassigned')).toBeTruthy();
    expect(getByText('Engine • Station 1')).toBeTruthy();
    expect(getByText('Enroute')).toBeTruthy();

    unmount();
  });

  it('shows personnel detail and role chips and saves a selectable resource', () => {
    const { getByTestId, getByText, unmount } = render(<AssignResourceSheet {...baseProps} />);

    fireEvent.press(getByTestId('resource-kind-tab-1'));
    expect(getByText('Station 1 • Available')).toBeTruthy();
    expect(getByText('Medic')).toBeTruthy();
    expect(getByText('Driver')).toBeTruthy();

    fireEvent.press(getByTestId('resource-option-1-user-1'));
    fireEvent.press(getByTestId('resource-assign-save'));
    expect(baseProps.onSave).toHaveBeenCalledWith(ResourceAssignmentKind.RealPersonnel, 'user-1');
    expect(baseProps.onClose).toHaveBeenCalled();

    unmount();
  });
});
