import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type IncidentCommandSummary } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useIncidentsStore } from '@/stores/command/incidents-store';


jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  router: { push: jest.fn() },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

jest.mock('@/components/command/incident-card', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    IncidentCard: ({ summary }: { summary: { CallName?: string | null; IncidentCommandId: string; Name?: string | null } }) =>
      React.createElement(Text, { testID: `incident-summary-${summary.IncidentCommandId}` }, summary.Name ?? summary.CallName),
  };
});

jest.mock('@/components/common/loading', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Loading: ({ text }: { text: string }) => React.createElement(Text, { testID: 'loading' }, text),
  };
});

jest.mock('@/components/common/zero-state', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    __esModule: true,
    default: ({ description, heading }: { description: string; heading: string }) =>
      React.createElement(View, { testID: 'zero-state' }, React.createElement(Text, null, heading), React.createElement(Text, null, description)),
  };
});

jest.mock('@/components/ui/flat-list', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    FlatList: ({
      data,
      keyExtractor,
      ListEmptyComponent,
      renderItem,
      testID,
    }: {
      data: { IncidentCommandId: string }[];
      keyExtractor: (item: { IncidentCommandId: string }) => string;
      ListEmptyComponent?: unknown;
      renderItem: (info: { item: { IncidentCommandId: string } }) => unknown;
      testID?: string;
    }) => React.createElement(View, { testID }, data.length > 0 ? data.map((item) => React.createElement(View, { key: keyExtractor(item) }, renderItem({ item }) as never)) : (ListEmptyComponent as never)),
  };
});

import IncidentsScreen from '../incidents';

const summaries: IncidentCommandSummary[] = [
  {
    IncidentCommandId: 'ic-1',
    DepartmentId: 1,
    CallId: 101,
    Name: 'Warehouse Fire',
    CallName: 'Commercial Structure Fire',
    CallNumber: 'C-1001',
    CallAddress: '100 Industrial Way',
    Status: 0,
    EstablishedOn: '2026-07-25T10:00:00Z',
    CommanderName: 'Alex Rivera',
    CommandPostLocationText: 'North entrance',
    AssignedPersonnelCount: 8,
    AssignedUnitCount: 3,
  },
  {
    IncidentCommandId: 'ic-2',
    DepartmentId: 1,
    CallId: 202,
    Name: 'Flood Response',
    CallName: 'Flooding',
    CallNumber: 'C-2002',
    CallAddress: '200 River Road',
    Status: 0,
    EstablishedOn: '2026-07-25T11:00:00Z',
    CommanderName: 'Jordan Lee',
    CommandPostLocationText: 'Community center',
    AssignedPersonnelCount: 5,
    AssignedUnitCount: 2,
  },
];

describe('IncidentsScreen search', () => {
  beforeEach(() => {
    useIncidentsStore.setState({
      summaries,
      includeClosed: false,
      isLoading: false,
      error: null,
    });
  });

  it('filters incidents by searchable summary fields', () => {
    const { unmount } = render(<IncidentsScreen />);

    fireEvent.changeText(screen.getByTestId('incidents-search'), 'C-2002');

    expect(screen.queryByTestId('incident-summary-ic-1')).toBeNull();
    expect(screen.getByTestId('incident-summary-ic-2')).toBeTruthy();
    unmount();
  });

  it('clears the search and restores the incident list', () => {
    const { unmount } = render(<IncidentsScreen />);

    fireEvent.changeText(screen.getByTestId('incidents-search'), 'warehouse');
    expect(screen.queryByTestId('incident-summary-ic-2')).toBeNull();

    fireEvent.press(screen.getByTestId('incidents-search-clear'));

    expect(screen.getByTestId('incident-summary-ic-1')).toBeTruthy();
    expect(screen.getByTestId('incident-summary-ic-2')).toBeTruthy();
    unmount();
  });

  it('shows a search-specific empty state when no incidents match', () => {
    const { unmount } = render(<IncidentsScreen />);

    fireEvent.changeText(screen.getByTestId('incidents-search'), 'not-a-real-incident');

    expect(screen.getByText('common.no_results_found')).toBeTruthy();
    expect(screen.getByText('incidents.no_search_results_description')).toBeTruthy();
    unmount();
  });
});
