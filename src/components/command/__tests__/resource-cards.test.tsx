import { act, fireEvent, render } from '@testing-library/react-native';
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
    Eye: icon('eye'),
    MapPin: icon('map-pin'),
    Truck: icon('truck'),
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('View', props) };
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
    const onView = jest.fn();
    const { getByText, getByTestId, unmount } = render(<UnitResourceCard isLocal={false} laneLabel="Division A" name="Engine 1" onView={onView} roles={roles} status={status} testID="card-1" unit={unit} viewTestID="view-1" />);

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

    fireEvent.press(getByTestId('view-1'));
    expect(onView).toHaveBeenCalled();

    unmount();
  });

  it('renders without roster data using just the resolved name', () => {
    const { getByText, queryByTestId, unmount } = render(<UnitResourceCard isLocal={true} laneLabel="command.unassigned" name="unit-77" onView={jest.fn()} roles={[]} testID="card-2" viewTestID="view-2" />);

    expect(getByText('unit-77')).toBeTruthy();
    expect(queryByTestId('card-2-status')).toBeNull();
    expect(queryByTestId('card-2-roles')).toBeNull();
    expect(getByText('command.unassigned')).toBeTruthy();

    unmount();
  });

  it('shows the unit type icon in place of the truck glyph when the type has one, and the truck otherwise', () => {
    const iconUrl = 'https://api.resgrid.dev/api/v4/UnitTypes/Icon/mug.png';
    const typed = { ...unit, TypeIconUrl: iconUrl, TypeMapIcon: 'ambulance' } as UnitResultData;
    const { getByTestId, queryByTestId, rerender, unmount } = render(<UnitResourceCard isLocal={false} laneLabel="Division A" name="MUG 1" onView={jest.fn()} roles={[]} testID="card-5" unit={typed} viewTestID="view-5" />);

    // Decorative image, hidden from assistive tech — so the query has to opt in to hidden elements.
    expect(getByTestId('card-5-type-icon', { includeHiddenElements: true }).props.source).toEqual({ uri: iconUrl });
    expect(queryByTestId('mock-truck-icon')).toBeNull();

    // Older servers omit the fields: the truck glyph stays.
    rerender(<UnitResourceCard isLocal={false} laneLabel="Division A" name="Engine 1" onView={jest.fn()} roles={[]} testID="card-5" unit={unit} viewTestID="view-5" />);
    expect(queryByTestId('card-5-type-icon', { includeHiddenElements: true })).toBeNull();
    expect(getByTestId('mock-truck-icon')).toBeTruthy();

    unmount();
  });
});

describe('PersonnelResourceCard', () => {
  it('shows group, id number, status, staffing, and department role chips', () => {
    const { getByText, getByTestId, unmount } = render(<PersonnelResourceCard isLocal={false} laneLabel="command.unassigned" name="Alex Reed" onView={jest.fn()} person={person} testID="card-3" viewTestID="view-3" />);

    expect(getByText('Alex Reed')).toBeTruthy();
    expect(getByText('AR')).toBeTruthy();
    expect(getByText('Station 2 • ID-42')).toBeTruthy();
    expect(getByTestId('card-3-status')).toBeTruthy();
    expect(getByTestId('card-3-staffing')).toBeTruthy();
    expect(getByText('Medic')).toBeTruthy();
    expect(getByText('Driver')).toBeTruthy();

    unmount();
  });

  it('pairs each status badge with text that reads on it, swapping a colour it cannot read for grey', () => {
    const tinted = { ...person, StatusColor: '#ffff0080', StaffingColor: 'rgb(255, 255, 0)' } as PersonnelInfoResultData;
    const { getByText, getByTestId, unmount } = render(<PersonnelResourceCard isLocal={false} laneLabel="command.unassigned" name="Alex Reed" onView={jest.fn()} person={tinted} testID="card-4" viewTestID="view-4" />);

    expect(getByTestId('card-4-status')).toHaveStyle({ backgroundColor: '#6b7280' });
    expect(getByText('Available')).toHaveStyle({ color: '#FFFFFF' });
    expect(getByTestId('card-4-staffing')).toHaveStyle({ backgroundColor: 'rgb(255, 255, 0)' });
    expect(getByText('On Shift')).toHaveStyle({ color: '#000000' });

    unmount();
  });

  it('shows the role icon in place of the initials when the person has one', () => {
    const iconUrl = 'https://api.resgrid.dev/api/v4/PersonnelRoles/Icon/medic.png';
    const withIcon = { ...person, RoleIconUrl: iconUrl } as PersonnelInfoResultData;
    const { getByTestId, getByText, queryByText, unmount } = render(<PersonnelResourceCard isLocal={false} laneLabel="Rehab" name="Alex Reed" onView={jest.fn()} person={withIcon} testID="card-6" viewTestID="view-6" />);

    // Decorative image, hidden from assistive tech — so the query has to opt in to hidden elements.
    const icon = getByTestId('card-6-role-icon', { includeHiddenElements: true });
    expect(icon.props.source).toEqual({ uri: iconUrl });
    expect(icon).toHaveStyle({ width: 24, height: 24 });
    expect(queryByText('AR')).toBeNull();
    // Everything else on the card, accessibility labels included, is unchanged.
    expect(getByText('Alex Reed')).toBeTruthy();
    expect(getByText('Medic')).toBeTruthy();
    expect(getByTestId('view-6').props.accessibilityLabel).toBe('command.view_details');

    unmount();
  });

  it('falls back to the initials when the role icon fails to load', () => {
    const withIcon = { ...person, RoleIconUrl: 'https://api.resgrid.dev/api/v4/PersonnelRoles/Icon/gone.png' } as PersonnelInfoResultData;
    const { getByTestId, getByText, queryByTestId, unmount } = render(<PersonnelResourceCard isLocal={false} laneLabel="Rehab" name="Alex Reed" onView={jest.fn()} person={withIcon} testID="card-7" viewTestID="view-7" />);

    act(() => {
      fireEvent(getByTestId('card-7-role-icon', { includeHiddenElements: true }), 'error', { error: 'HTTP 404' });
    });

    expect(queryByTestId('card-7-role-icon', { includeHiddenElements: true })).toBeNull();
    expect(getByText('AR')).toBeTruthy();

    unmount();
  });

  it('keeps the initials when the person has no role icon (null, or omitted by older servers)', () => {
    const { getByText, queryByTestId, rerender, unmount } = render(
      <PersonnelResourceCard isLocal={false} laneLabel="Rehab" name="Alex Reed" onView={jest.fn()} person={{ ...person, RoleIconUrl: null } as PersonnelInfoResultData} testID="card-8" viewTestID="view-8" />
    );

    expect(queryByTestId('card-8-role-icon', { includeHiddenElements: true })).toBeNull();
    expect(getByText('AR')).toBeTruthy();

    rerender(<PersonnelResourceCard isLocal={false} laneLabel="Rehab" name="Alex Reed" onView={jest.fn()} person={person} testID="card-8" viewTestID="view-8" />);
    expect(queryByTestId('card-8-role-icon', { includeHiddenElements: true })).toBeNull();
    expect(getByText('AR')).toBeTruthy();

    unmount();
  });
});
