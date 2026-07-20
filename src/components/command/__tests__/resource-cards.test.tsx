import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${Object.values(params).join('/')}` : key),
  }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) => React.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    CloudOff: icon('cloud-off'),
    MapPin: icon('map-pin'),
    Trash2: icon('trash'),
    Truck: icon('truck'),
  };
});

import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import type { ActiveUnitRoleResultData } from '@/models/v4/unitRoles/activeUnitRoleResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';
import type { UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

import { PersonnelResourceCard, UnitResourceCard } from '../resource-cards';

const unit = { UnitId: 'unit-1', Name: 'Engine 1', Type: 'Engine', GroupName: 'Station 1' } as UnitResultData;

const status = { UnitId: 'unit-1', State: 'Responding', StateStyle: '#d35400', DestinationName: 'Staging', Eta: '5 min' } as UnitStatusResultData;

const roles = [
  { UnitId: 'unit-1', UnitRoleId: 'r-1', Name: 'Driver', UserId: 'u-1', FullName: 'Sam Jones', UpdatedOn: '' },
  { UnitId: 'unit-1', UnitRoleId: 'r-2', Name: 'Officer', UserId: '', FullName: '', UpdatedOn: '' },
] as ActiveUnitRoleResultData[];

const person = {
  UserId: 'u-9',
  FirstName: 'Alex',
  LastName: 'Reed',
  GroupName: 'Station 2',
  IdentificationNumber: 'ID-42',
  Status: 'Available',
  StatusColor: '#27ae60',
  Staffing: 'On Shift',
  StaffingColor: '#2980b9',
  Roles: ['Medic', 'Driver'],
} as PersonnelInfoResultData;

describe('UnitResourceCard', () => {
  it('shows roster info, live status, destination, and role seats with assignees', () => {
    const onRelease = jest.fn();
    const { getByText, getByTestId, unmount } = render(
      <UnitResourceCard isLocal={false} laneLabel="Division A" name="Engine 1" onRelease={onRelease} removeTestID="remove-1" roles={roles} status={status} testID="card-1" unit={unit} />
    );

    expect(getByText('Engine 1')).toBeTruthy();
    expect(getByText('Engine • Station 1')).toBeTruthy();
    expect(getByTestId('card-1-status')).toBeTruthy();
    expect(getByText('Responding')).toBeTruthy();
    expect(getByText('Staging • command.unit_eta:5 min')).toBeTruthy();
    expect(getByText('command.unit_roles_count:1/2')).toBeTruthy();
    expect(getByText('Driver')).toBeTruthy();
    expect(getByText('Sam Jones')).toBeTruthy();
    expect(getByText('command.role_open')).toBeTruthy();
    expect(getByText('Division A')).toBeTruthy();

    fireEvent.press(getByTestId('remove-1'));
    expect(onRelease).toHaveBeenCalled();

    unmount();
  });

  it('renders without roster data using just the resolved name', () => {
    const { getByText, queryByTestId, unmount } = render(<UnitResourceCard isLocal={true} laneLabel="command.unassigned" name="unit-77" onRelease={jest.fn()} removeTestID="remove-2" roles={[]} testID="card-2" />);

    expect(getByText('unit-77')).toBeTruthy();
    expect(queryByTestId('card-2-status')).toBeNull();
    expect(queryByTestId('card-2-roles')).toBeNull();
    expect(getByText('command.unassigned')).toBeTruthy();

    unmount();
  });
});

describe('PersonnelResourceCard', () => {
  it('shows group, id number, status, staffing, and department role chips', () => {
    const { getByText, getByTestId, unmount } = render(
      <PersonnelResourceCard isLocal={false} laneLabel="command.unassigned" name="Alex Reed" onRelease={jest.fn()} person={person} removeTestID="remove-3" testID="card-3" />
    );

    expect(getByText('Alex Reed')).toBeTruthy();
    expect(getByText('AR')).toBeTruthy();
    expect(getByText('Station 2 • ID-42')).toBeTruthy();
    expect(getByTestId('card-3-status')).toBeTruthy();
    expect(getByTestId('card-3-staffing')).toBeTruthy();
    expect(getByText('Medic')).toBeTruthy();
    expect(getByText('Driver')).toBeTruthy();

    unmount();
  });
});
