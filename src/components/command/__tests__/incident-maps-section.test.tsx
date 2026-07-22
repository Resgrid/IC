import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

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

import { type IncidentMap } from '@/models/v4/incidentCommand/incidentCommandModels';

import { IncidentMapsSection, isMapExpired } from '../incident-maps-section';

const map = (overrides: Partial<IncidentMap> = {}): IncidentMap =>
  ({
    IncidentMapId: 'map-1',
    IncidentCommandId: 'ic-1',
    DepartmentId: 1,
    CallId: 101,
    Name: 'North sector cleanup',
    Description: 'Debris removal area',
    CreatedByUserId: 'u1',
    CreatedOn: '2026-07-01T10:00:00Z',
    ...overrides,
  }) as IncidentMap;

describe('isMapExpired', () => {
  it('flags past expiry and accepts future/absent expiry', () => {
    expect(isMapExpired(map({ ExpiresOn: '2000-01-01T00:00:00Z' }))).toBe(true);
    expect(isMapExpired(map({ ExpiresOn: '2100-01-01T00:00:00Z' }))).toBe(false);
    expect(isMapExpired(map())).toBe(false);
  });
});

describe('IncidentMapsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a named map with name and description', () => {
    const onCreate = jest.fn();
    const { getByTestId, unmount } = render(<IncidentMapsSection callId="101" maps={[]} onCreate={onCreate} onDelete={jest.fn()} />);

    fireEvent.press(getByTestId('incident-maps-add'));
    fireEvent.changeText(getByTestId('incident-map-name-input'), 'North sector cleanup');
    fireEvent.changeText(getByTestId('incident-map-description-input'), 'Debris removal area');
    fireEvent.press(getByTestId('incident-map-create-save'));

    expect(onCreate).toHaveBeenCalledWith('North sector cleanup', 'Debris removal area', null);

    unmount();
  });

  it('opens a map in the fullscreen editor on tap', () => {
    const { getByTestId, unmount } = render(<IncidentMapsSection callId="101" maps={[map()]} onCreate={jest.fn()} onDelete={jest.fn()} />);

    fireEvent.press(getByTestId('incident-map-map-1'));

    expect(mockPush).toHaveBeenCalledWith('/command-map/101?mapId=map-1');

    unmount();
  });

  it('deletes only after confirmation and shows the expired badge', () => {
    const onDelete = jest.fn();
    const expired = map({ ExpiresOn: '2000-01-01T00:00:00Z' });
    const { getByTestId, unmount } = render(<IncidentMapsSection callId="101" maps={[expired]} onCreate={jest.fn()} onDelete={onDelete} />);

    expect(getByTestId('incident-map-expired-map-1')).toBeTruthy();

    fireEvent.press(getByTestId('incident-map-delete-map-1'));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('incident-map-delete-confirm'));
    expect(onDelete).toHaveBeenCalledWith('map-1');

    unmount();
  });
});
