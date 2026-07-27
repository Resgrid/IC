import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
    Mail: icon('mail'),
    Map: icon('map'),
    MapPin: icon('map-pin'),
    Phone: icon('phone'),
    Truck: icon('truck'),
    User: icon('user'),
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

const mockGetMapDataAndMarkers = jest.fn();
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: (...args: unknown[]) => mockGetMapDataAndMarkers(...args),
}));

import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import type { ActiveUnitRoleResultData } from '@/models/v4/unitRoles/activeUnitRoleResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';
import type { UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

import { ResourceDetailsSheet } from '../resource-details-sheet';

const unit = { UnitId: 'unit-1', Name: 'Engine 1', Type: 'Engine', GroupName: 'Station 1' } as UnitResultData;

const status = {
  UnitId: 'unit-1',
  State: 'Responding',
  StateStyle: '#d35400',
  DestinationName: 'Staging',
  Eta: '5 min',
  Note: 'En route',
  Latitude: 47.6205,
  Longitude: -122.3493,
  Timestamp: '2026-07-19T10:00:00Z',
} as UnitStatusResultData;

const unitRoles = [
  { UnitId: 'unit-1', UnitRoleId: 'r-1', Name: 'Driver', UserId: 'u-1', FullName: 'Sam Jones', UpdatedOn: '' },
  { UnitId: 'unit-1', UnitRoleId: 'r-2', Name: 'Officer', UserId: '', FullName: '', UpdatedOn: '' },
] as ActiveUnitRoleResultData[];

const person = {
  UserId: 'u-9',
  FirstName: 'Alex',
  LastName: 'Reed',
  GroupName: 'Station 2',
  IdentificationNumber: 'ID-42',
  EmailAddress: 'alex@example.com',
  MobilePhone: '555-0100',
  Status: 'Available',
  StatusColor: '#27ae60',
  Staffing: 'On Shift',
  StaffingColor: '#2980b9',
  Roles: ['Medic', 'Driver'],
} as PersonnelInfoResultData;

describe('ResourceDetailsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMapDataAndMarkers.mockResolvedValue({ Data: { MapMakerInfos: [{ Id: 'pu-9', Latitude: 47.6, Longitude: -122.3 }] } });
  });

  it('shows unit roster, status, crew, and position; fires the action and closes', async () => {
    const onAction = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByTestId, unmount } = render(
      <ResourceDetailsSheet isOpen kind="unit" resourceId="unit-1" name="Engine 1" unit={unit} status={status} unitRoles={unitRoles} actionLabel="Remove from Lane" actionTestID="details-action" onAction={onAction} onClose={onClose} />
    );

    expect(getByText('command.unit_details_title')).toBeTruthy();
    expect(getByText('Engine 1')).toBeTruthy();
    expect(getByText('Engine • Station 1')).toBeTruthy();
    expect(getByText('Responding')).toBeTruthy();
    expect(getByText('En route')).toBeTruthy();
    expect(getByText('Driver')).toBeTruthy();
    expect(getByText('Sam Jones')).toBeTruthy();
    expect(getByText('command.role_open')).toBeTruthy();

    // Unit status coordinates render without waiting on the marker fetch
    await waitFor(() => expect(getByTestId('resource-details-coords')).toBeTruthy());
    expect(getByText('47.62050, -122.34930')).toBeTruthy();

    fireEvent.press(getByTestId('details-action'));
    expect(onAction).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('shows person info, status/staffing, roles, and marker-based position', async () => {
    const { getByText, getByTestId, unmount } = render(
      <ResourceDetailsSheet isOpen kind="person" resourceId="u-9" name="Alex Reed" person={person} actionLabel="Release from Incident" actionTestID="details-action" onAction={jest.fn()} onClose={jest.fn()} />
    );

    expect(getByText('command.person_details_title')).toBeTruthy();
    expect(getByText('Alex Reed')).toBeTruthy();
    expect(getByText('Station 2 • ID-42')).toBeTruthy();
    expect(getByText('alex@example.com')).toBeTruthy();
    expect(getByText('555-0100')).toBeTruthy();
    expect(getByText('Available')).toBeTruthy();
    expect(getByTestId('resource-details-staffing')).toBeTruthy();
    expect(getByText('Medic')).toBeTruthy();
    expect(getByText('Driver')).toBeTruthy();

    // Personnel position comes from the shared map markers (p{userId})
    await waitFor(() => expect(getByTestId('resource-details-coords')).toBeTruthy());
    expect(getByText('47.60000, -122.30000')).toBeTruthy();

    unmount();
  });

  it('shows the unknown-position fallback when no coordinates exist', async () => {
    mockGetMapDataAndMarkers.mockResolvedValue({ Data: { MapMakerInfos: [] } });
    const { getByText, queryByTestId, unmount } = render(
      <ResourceDetailsSheet isOpen kind="person" resourceId="u-9" name="Alex Reed" person={person} actionLabel="Release" actionTestID="details-action" onAction={jest.fn()} onClose={jest.fn()} />
    );

    await waitFor(() => expect(getByText('command.resource_position_unknown')).toBeTruthy());
    expect(queryByTestId('resource-details-coords')).toBeNull();

    unmount();
  });

  it('shows the lane name tinted with the lane color', () => {
    const { getByTestId, getByText, unmount } = render(
      <ResourceDetailsSheet isOpen kind="unit" resourceId="unit-1" name="Engine 1" unit={unit} laneName="Division A" laneColor="#e74c3c" actionLabel="Remove from Lane" actionTestID="details-action" onAction={jest.fn()} onClose={jest.fn()} />
    );

    const laneName = getByTestId('resource-details-lane-name');
    expect(getByText('Division A')).toBeTruthy();
    expect(laneName.props.style).toEqual({ color: '#e74c3c' });

    unmount();
  });

  it('closes the sheet and navigates to the fullscreen resource map from the position row', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const { getByTestId, unmount } = render(
      <ResourceDetailsSheet isOpen kind="unit" resourceId="unit-1" name="Engine 1" unit={unit} status={status} actionLabel="Remove from Lane" actionTestID="details-action" onAction={jest.fn()} onClose={onClose} />
    );

    fireEvent.press(getByTestId('resource-details-view-map'));
    expect(onClose).toHaveBeenCalled();

    jest.advanceTimersByTime(350);
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/resource-map',
        params: expect.objectContaining({ latitude: '47.6205', longitude: '-122.3493', title: 'Engine 1' }),
      })
    );

    jest.useRealTimers();
    unmount();
  });
});
