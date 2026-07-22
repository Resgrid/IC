import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type IncidentCommandSummary } from '@/models/v4/incidentCommand/incidentCommandModels';

import { formatIncidentDuration, IncidentCard } from '../incident-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const summary = {
  IncidentCommandId: 'ic-1',
  DepartmentId: 1,
  CallId: 5,
  Name: 'Main St Structure Fire',
  CallName: 'Structure Fire',
  CallNumber: 'C-1042',
  CallAddress: '123 Main St',
  Status: 0,
  EstablishedOn: '2026-07-01T10:00:00Z',
  ClosedOn: null,
  CommanderUserId: 'u1',
  CommanderName: 'Jane Smith',
  CommandPostLocationText: 'Front lobby',
  AssignedUnitCount: 2,
  AssignedPersonnelCount: 3,
} as unknown as IncidentCommandSummary;

describe('formatIncidentDuration', () => {
  it('formats an ended incident duration from established to closed', () => {
    expect(formatIncidentDuration('2026-07-01T10:00:00Z', '2026-07-01T13:24:00Z')).toBe('3h 24m');
  });

  it('formats multi-day durations as days + hours', () => {
    expect(formatIncidentDuration('2026-07-01T10:00:00Z', '2026-07-03T15:00:00Z')).toBe('2d 5h');
  });

  it('falls back to a dash for an unparseable start', () => {
    expect(formatIncidentDuration('not-a-date', '2026-07-01T13:24:00Z')).toBe('—');
  });
});

describe('IncidentCard', () => {
  it('renders name, commander, location, and unit/personnel counts', () => {
    render(<IncidentCard summary={summary} onPress={() => {}} />);

    expect(screen.getByText('Main St Structure Fire')).toBeTruthy();
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    expect(screen.getByText('Front lobby')).toBeTruthy();
    expect(screen.getByText('incidents.units: 2')).toBeTruthy();
    expect(screen.getByText('incidents.personnel: 3')).toBeTruthy();
    expect(screen.getByTestId('incident-active-badge')).toBeTruthy();
  });

  it('shows the ended badge and falls back to the call address for ended incidents', () => {
    const ended = { ...summary, Name: null, Status: 1, ClosedOn: '2026-07-01T14:00:00Z', CommandPostLocationText: null } as unknown as IncidentCommandSummary;
    render(<IncidentCard summary={ended} onPress={() => {}} />);

    expect(screen.getByText('Structure Fire')).toBeTruthy();
    expect(screen.getByTestId('incident-ended-badge')).toBeTruthy();
    expect(screen.getByText('123 Main St')).toBeTruthy();
    expect(screen.getByTestId('incident-duration')).toHaveTextContent('4h 00m');
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<IncidentCard summary={summary} onPress={onPress} />);

    fireEvent.press(screen.getByTestId('incident-card'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
