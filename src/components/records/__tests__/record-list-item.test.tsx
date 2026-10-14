import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { type RecordSummaryData, RmsRecordState } from '@/models/v4/records';
import { type PendingRecordDraft } from '@/stores/records/store';
import { terminologyStore } from '@/stores/terminology/store';

import { PendingDraftItem, RecordListItem } from '../record-list-item';

interface MockChildrenProps {
  children?: React.ReactNode;
  testID?: string;
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => ({
  AlertTriangle: () => null,
  CloudOff: () => null,
  FileText: () => null,
}));

const mockRecordsState = {
  entryFor: jest.fn((_definitionKey: string): { Name: string } | null => null),
};
jest.mock('@/stores/records/store', () => ({
  useRecordsStore: (selector: (state: typeof mockRecordsState) => unknown) => selector(mockRecordsState),
}));

jest.mock('@/components/ui/badge', () => {
  const { Text, View } = require('react-native');
  return {
    Badge: ({ children }: MockChildrenProps) => <View>{children}</View>,
    BadgeText: ({ children }: MockChildrenProps) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children }: MockChildrenProps) => <View>{children}</View> };
});

jest.mock('@/components/ui/hstack', () => {
  const { View } = require('react-native');
  return { HStack: ({ children }: MockChildrenProps) => <View>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children }: MockChildrenProps) => <View>{children}</View> };
});

jest.mock('@/components/ui/pressable', () => {
  const { View } = require('react-native');
  return { Pressable: ({ children, testID }: MockChildrenProps) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

const summary = (overrides: Partial<RecordSummaryData> = {}): RecordSummaryData => ({
  RecordId: 'r1',
  RecordNumber: 'RUN-1',
  DefinitionKey: 'system.run',
  DefinitionVersion: 1,
  State: RmsRecordState.Draft,
  StateName: 'Draft',
  CreatedOn: '2026-10-13T00:00:00Z',
  ModifiedOn: '2026-10-13T00:00:00Z',
  RowVersion: 1,
  ...overrides,
});

const draft = (overrides: Partial<PendingRecordDraft> = {}): PendingRecordDraft => ({
  clientRecordId: 'draft-1',
  recordId: null,
  definitionKey: 'system.run',
  definitionVersion: 1,
  name: 'Run',
  values: [],
  updatedOn: '2026-10-13T00:00:00Z',
  ...overrides,
});

describe('RecordListItem', () => {
  beforeEach(() => {
    mockRecordsState.entryFor.mockReset();
    mockRecordsState.entryFor.mockReturnValue(null);
    terminologyStore.setState({ names: {} });
  });

  afterAll(() => {
    terminologyStore.setState({ names: {} });
  });

  it("shows the department's name for a renamed built-in type", () => {
    terminologyStore.setState({ names: { 'record-type.run': 'Incident report' } });

    render(<RecordListItem record={summary()} onPress={jest.fn()} />);

    expect(screen.getByText('Incident report')).toBeTruthy();
    expect(screen.queryByText('system.run')).toBeNull();
  });

  it('prefers the renamed type over the catalog name', () => {
    mockRecordsState.entryFor.mockReturnValue({ Name: 'Run' });
    terminologyStore.setState({ names: { 'record-type.run': 'Incident report' } });

    render(<RecordListItem record={summary()} onPress={jest.fn()} />);

    expect(screen.getByText('Incident report')).toBeTruthy();
    expect(screen.queryByText('Run')).toBeNull();
  });

  it('never shows the raw key of a built-in type the department kept', () => {
    render(<RecordListItem record={summary({ RecordNumber: null, DraftReference: null, DefinitionKey: 'system.unit-activity' })} onPress={jest.fn()} />);

    expect(screen.getAllByText('Unit activity').length).toBeGreaterThan(0);
    expect(screen.queryByText('system.unit-activity')).toBeNull();
  });

  it("uses the catalog's name for a department definition", () => {
    mockRecordsState.entryFor.mockReturnValue({ Name: 'Hydrant inspection' });

    render(<RecordListItem record={summary({ DefinitionKey: 'hydrant-inspection' })} onPress={jest.fn()} />);

    expect(screen.getByText('Hydrant inspection')).toBeTruthy();
  });

  it('keeps the summary when the server sent one', () => {
    terminologyStore.setState({ names: { 'record-type.run': 'Incident report' } });

    render(<RecordListItem record={summary({ DisplaySummary: 'Structure fire, 12 Main St' })} onPress={jest.fn()} />);

    expect(screen.getByText('Structure fire, 12 Main St')).toBeTruthy();
    expect(screen.getByText('RUN-1')).toBeTruthy();
  });
});

describe('PendingDraftItem', () => {
  beforeEach(() => {
    terminologyStore.setState({ names: {} });
  });

  afterAll(() => {
    terminologyStore.setState({ names: {} });
  });

  it("labels a new draft with the department's name for its type", () => {
    terminologyStore.setState({ names: { 'record-type.run': 'Incident report' } });

    render(<PendingDraftItem draft={draft()} onPress={jest.fn()} />);

    expect(screen.getByText('Incident report')).toBeTruthy();
  });

  it("keeps a saved Record's number on a draft editing it", () => {
    terminologyStore.setState({ names: { 'record-type.run': 'Incident report' } });

    render(<PendingDraftItem draft={draft({ recordId: 'r1', name: 'RUN-1' })} onPress={jest.fn()} />);

    expect(screen.getByText('RUN-1')).toBeTruthy();
    expect(screen.queryByText('Incident report')).toBeNull();
  });
});
