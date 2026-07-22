import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) => React.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    CheckCircle2: icon('check'),
    CloudOff: icon('cloudoff'),
    Plus: icon('plus'),
    RotateCcw: icon('rotate'),
  };
});

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

import { type IncidentNeed, IncidentNeedCategory, IncidentNeedStatus } from '@/models/v4/incidentCommand/incidentCommandModels';

import { NeedsSection } from '../needs-section';

const need = (overrides: Partial<IncidentNeed> = {}): IncidentNeed => ({
  IncidentNeedId: 'need-1',
  IncidentCommandId: 'cmd-1',
  DepartmentId: 1,
  CallId: 101,
  Name: 'Fuel truck',
  Category: IncidentNeedCategory.Logistics,
  Status: IncidentNeedStatus.Open,
  QuantityRequested: 2,
  QuantityFulfilled: 0,
  Priority: 0,
  CreatedOn: '2026-07-19T10:00:00Z',
  SortOrder: 0,
  ...overrides,
});

describe('NeedsSection', () => {
  it('renders needs with category, quantity, and status badge', () => {
    const { getByTestId, getByText, unmount } = render(<NeedsSection needs={[need()]} onAdd={jest.fn()} onSetStatus={jest.fn()} fetchNeedUpdates={jest.fn().mockResolvedValue([])} />);

    expect(getByTestId('need-need-1')).toBeTruthy();
    expect(getByText('Fuel truck')).toBeTruthy();
    expect(getByText(/command.need_category_logistics/)).toBeTruthy();
    expect(getByText(/0\/2/)).toBeTruthy();

    unmount();
  });

  it('marks an open need met and reopens a met need', () => {
    const onSetStatus = jest.fn();
    const { getByTestId, rerender, unmount } = render(<NeedsSection needs={[need()]} onAdd={jest.fn()} onSetStatus={onSetStatus} fetchNeedUpdates={jest.fn().mockResolvedValue([])} />);

    fireEvent.press(getByTestId('need-met-need-1'));
    expect(onSetStatus).toHaveBeenCalledWith('need-1', IncidentNeedStatus.Met);

    rerender(<NeedsSection needs={[need({ Status: IncidentNeedStatus.Met, QuantityFulfilled: 2 })]} onAdd={jest.fn()} onSetStatus={onSetStatus} fetchNeedUpdates={jest.fn().mockResolvedValue([])} />);
    fireEvent.press(getByTestId('need-reopen-need-1'));
    expect(onSetStatus).toHaveBeenCalledWith('need-1', IncidentNeedStatus.Open);

    unmount();
  });

  it('hides cancelled needs from the list', () => {
    const { queryByTestId, unmount } = render(<NeedsSection needs={[need({ Status: IncidentNeedStatus.Cancelled })]} onAdd={jest.fn()} onSetStatus={jest.fn()} fetchNeedUpdates={jest.fn().mockResolvedValue([])} />);

    expect(queryByTestId('need-need-1')).toBeNull();

    unmount();
  });

  it('saves a new need with category and quantity from the add sheet', () => {
    const onAdd = jest.fn();
    const { getByTestId, unmount } = render(<NeedsSection needs={[]} onAdd={onAdd} onSetStatus={jest.fn()} fetchNeedUpdates={jest.fn().mockResolvedValue([])} />);

    fireEvent.press(getByTestId('command-needs-add'));
    fireEvent.press(getByTestId(`need-category-${IncidentNeedCategory.Equipment}`));
    fireEvent.changeText(getByTestId('need-name-input'), 'Light tower');
    fireEvent.changeText(getByTestId('need-quantity-input'), '3');
    fireEvent.changeText(getByTestId('need-description-input'), 'North side');
    fireEvent.press(getByTestId('need-save'));

    expect(onAdd).toHaveBeenCalledWith('Light tower', IncidentNeedCategory.Equipment, { description: 'North side', quantityRequested: 3 });

    unmount();
  });
});
