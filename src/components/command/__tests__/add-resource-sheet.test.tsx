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

import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';

import { AddResourceSheet } from '../add-resource-sheet';

const units = [
  { UnitId: 'unit-1', Name: 'Engine 1', Type: 'Engine', GroupName: 'Station 1' },
  { UnitId: 'unit-2', Name: 'Ladder 7', Type: 'Ladder', GroupName: 'Station 2' },
] as UnitResultData[];

const personnel = [
  { UserId: 'user-1', FirstName: 'Sam', LastName: 'Jones', GroupName: 'Station 1', Status: 'Available', StatusColor: '#00ff00' },
  { UserId: 'user-2', FirstName: 'Alex', LastName: 'Reed', GroupName: 'Station 2', Status: 'Responding', StatusColor: '' },
] as PersonnelInfoResultData[];

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  units,
  personnel,
  trackedUnitIds: [] as string[],
  trackedUserIds: [] as string[],
  onAddUnit: jest.fn(),
  onAddPersonnel: jest.fn(),
  onSaveExternal: jest.fn(),
};

describe('AddResourceSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to the department units roster and adds a unit on tap', () => {
    const { getByTestId, getByText, unmount } = render(<AddResourceSheet {...baseProps} />);

    expect(getByText('Engine 1')).toBeTruthy();
    expect(getByText('Engine • Station 1')).toBeTruthy();

    fireEvent.press(getByTestId('roster-unit-unit-1'));
    expect(baseProps.onAddUnit).toHaveBeenCalledWith('unit-1');

    unmount();
  });

  it('marks already-tracked units and does not add them again', () => {
    const { getByTestId, unmount } = render(<AddResourceSheet {...baseProps} trackedUnitIds={['unit-1']} />);

    expect(getByTestId('mock-check-icon')).toBeTruthy();
    fireEvent.press(getByTestId('roster-unit-unit-1'));
    expect(baseProps.onAddUnit).not.toHaveBeenCalled();

    unmount();
  });

  it('switches to personnel, filters by search, and adds a person on tap', () => {
    const { getByTestId, getByText, queryByText, unmount } = render(<AddResourceSheet {...baseProps} />);

    fireEvent.press(getByTestId('resource-tab-personnel'));
    expect(getByText('Sam Jones')).toBeTruthy();
    expect(getByText('Station 1 • Available')).toBeTruthy();

    fireEvent.changeText(getByTestId('resource-roster-search'), 'alex');
    expect(queryByText('Sam Jones')).toBeNull();

    fireEvent.press(getByTestId('roster-person-user-2'));
    expect(baseProps.onAddPersonnel).toHaveBeenCalledWith('user-2');

    unmount();
  });

  it('adds an external person with role and agency from the external tab', () => {
    const { getByTestId, unmount } = render(<AddResourceSheet {...baseProps} />);

    fireEvent.press(getByTestId('resource-tab-external'));
    fireEvent.press(getByTestId('resource-kind-person'));
    fireEvent.changeText(getByTestId('resource-name-input'), 'Pat Smith');
    fireEvent.changeText(getByTestId('resource-note-input'), 'Medic');
    fireEvent.changeText(getByTestId('resource-agency-input'), 'Red Cross');
    fireEvent.press(getByTestId('resource-save'));

    expect(baseProps.onSaveExternal).toHaveBeenCalledWith('person', 'Pat Smith', 'Medic', 'Red Cross');
    expect(baseProps.onClose).toHaveBeenCalled();

    unmount();
  });
});
