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
    RefreshCw: (props: any) => React.createElement('View', { ...props, testID: 'mock-refresh-icon' }),
  };
});

import type { CommandLogEntry } from '@/models/v4/incidentCommand/incidentCommandModels';

import { SceneClock, TimelineSection } from '../timeline-section';

const entry = (id: string, description: string): CommandLogEntry =>
  ({
    CommandLogEntryId: id,
    IncidentCommandId: 'cmd-1',
    DepartmentId: 1,
    CallId: 101,
    EntryType: 0,
    Description: description,
    OccurredOn: '2026-07-19T10:00:00Z',
  }) as CommandLogEntry;

describe('TimelineSection', () => {
  it('renders log entries and refreshes on demand', () => {
    const onRefresh = jest.fn();
    const { getByTestId, getByText, unmount } = render(<TimelineSection entries={[entry('e-1', "Timer 'PAR Check' started")]} onRefresh={onRefresh} />);

    expect(getByText("Timer 'PAR Check' started")).toBeTruthy();
    fireEvent.press(getByTestId('command-timeline-refresh'));
    expect(onRefresh).toHaveBeenCalled();

    unmount();
  });

  it('shows the empty state and paginates long logs', () => {
    const many = Array.from({ length: 20 }, (_, i) => entry(`e-${i}`, `Entry ${i}`));
    const { getByTestId, getByText, queryByText, rerender, unmount } = render(<TimelineSection entries={[]} onRefresh={jest.fn()} />);

    expect(getByText('command.empty_timeline')).toBeTruthy();

    rerender(<TimelineSection entries={many} onRefresh={jest.fn()} />);
    expect(queryByText('Entry 16')).toBeNull();
    fireEvent.press(getByTestId('command-timeline-more'));
    expect(getByText('Entry 16')).toBeTruthy();

    unmount();
  });
});

describe('SceneClock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-19T11:01:05Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows elapsed incident time and ticks forward', () => {
    const { getByTestId, unmount } = render(<SceneClock startedOn="2026-07-19T10:00:00Z" />);

    expect(getByTestId('command-scene-clock').props.children).toBe('01:01:05');

    unmount();
  });

  it('renders nothing without a start time', () => {
    const { queryByTestId, unmount } = render(<SceneClock />);
    expect(queryByTestId('command-scene-clock')).toBeNull();
    unmount();
  });
});
