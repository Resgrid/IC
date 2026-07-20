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
    AlarmClock: icon('alarm-clock'),
    Check: icon('check'),
    Plus: icon('plus'),
  };
});

import type { IncidentTimer } from '@/models/v4/incidentCommand/incidentCommandModels';

import { TimersSection } from '../timers-section';

const timer = (overrides: Partial<IncidentTimer>): IncidentTimer =>
  ({
    IncidentTimerId: 't-1',
    IncidentCommandId: 'cmd-1',
    DepartmentId: 1,
    CallId: 101,
    TimerType: 3,
    ScopeType: 0,
    Name: 'PAR Check',
    IntervalSeconds: 900,
    StartedOn: '2026-07-19T10:00:00Z',
    Status: 0,
    ...overrides,
  }) as IncidentTimer;

describe('TimersSection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-19T10:10:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a running timer with its countdown and acknowledges on tap', () => {
    const onAcknowledge = jest.fn();
    const { getByTestId, getByText, unmount } = render(<TimersSection timers={[timer({ NextDueOn: '2026-07-19T10:15:00Z' })]} onStartTimer={jest.fn()} onAcknowledge={onAcknowledge} />);

    expect(getByText('PAR Check')).toBeTruthy();
    expect(getByText('command.timer_due_in:05:00')).toBeTruthy();

    fireEvent.press(getByTestId('timer-ack-t-1'));
    expect(onAcknowledge).toHaveBeenCalledWith('t-1');

    unmount();
  });

  it('flags an overdue timer', () => {
    const { getByText, unmount } = render(<TimersSection timers={[timer({ NextDueOn: '2026-07-19T10:05:00Z' })]} onStartTimer={jest.fn()} onAcknowledge={jest.fn()} />);

    expect(getByText('command.timer_overdue')).toBeTruthy();
    expect(getByText('command.timer_overdue_by:05:00')).toBeTruthy();

    unmount();
  });

  it('hides stopped timers and shows the empty state', () => {
    const { getByText, unmount } = render(<TimersSection timers={[timer({ Status: 3 })]} onStartTimer={jest.fn()} onAcknowledge={jest.fn()} />);

    expect(getByText('command.empty_timers')).toBeTruthy();

    unmount();
  });

  it('starts a new timer from the inline form with a preset interval', () => {
    const onStartTimer = jest.fn();
    const { getByTestId, unmount } = render(<TimersSection timers={[]} onStartTimer={onStartTimer} onAcknowledge={jest.fn()} />);

    fireEvent.press(getByTestId('command-timers-add'));
    fireEvent.changeText(getByTestId('timer-name-input'), 'Rehab rotation');
    fireEvent.press(getByTestId('timer-preset-20'));
    fireEvent.press(getByTestId('timer-start'));

    expect(onStartTimer).toHaveBeenCalledWith('Rehab rotation', 1200);

    unmount();
  });
});
