import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

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

import { type IncidentNeed, IncidentNeedStatus, type IncidentNeedUpdate } from '@/models/v4/incidentCommand/incidentCommandModels';

import { NeedDetailsSheet } from '../need-details-sheet';

const need = (overrides: Partial<IncidentNeed> = {}): IncidentNeed =>
  ({
    IncidentNeedId: 'need-1',
    IncidentCommandId: 'ic-1',
    DepartmentId: 1,
    CallId: 5,
    Name: 'Engines',
    Category: 0,
    Status: IncidentNeedStatus.Open,
    QuantityRequested: 3,
    QuantityFulfilled: 0,
    Priority: 0,
    CreatedOn: '2026-07-01T10:00:00Z',
    SortOrder: 0,
    ...overrides,
  }) as IncidentNeed;

const auditRow: IncidentNeedUpdate = {
  IncidentNeedUpdateId: 'u1',
  IncidentNeedId: 'need-1',
  IncidentCommandId: 'ic-1',
  DepartmentId: 1,
  CallId: 5,
  PreviousStatus: IncidentNeedStatus.Open,
  NewStatus: IncidentNeedStatus.PartiallyMet,
  PreviousQuantityFulfilled: 0,
  NewQuantityFulfilled: 1,
  Note: 'Engine 1 from mutual aid',
  CreatedByUserId: 'u-2',
  CreatedByUserName: 'Jane Smith',
  CreatedOn: '2026-07-01T11:00:00Z',
};

describe('NeedDetailsSheet', () => {
  it('saves a partial fill with the entered note', () => {
    const onUpdate = jest.fn();
    const { getByTestId, unmount } = render(<NeedDetailsSheet isOpen={true} onClose={jest.fn()} need={need()} onUpdate={onUpdate} fetchUpdates={jest.fn().mockResolvedValue([])} />);

    fireEvent.press(getByTestId('need-fill-increase'));
    fireEvent.changeText(getByTestId('need-note-input'), 'Engine 1 from mutual aid');
    fireEvent.press(getByTestId('need-save-fill'));

    expect(onUpdate).toHaveBeenCalledWith('need-1', IncidentNeedStatus.PartiallyMet, 1, 'Engine 1 from mutual aid');

    unmount();
  });

  it('reduces the fill and derives partial status', () => {
    const onUpdate = jest.fn();
    const { getByTestId, unmount } = render(
      <NeedDetailsSheet isOpen={true} onClose={jest.fn()} need={need({ Status: IncidentNeedStatus.Met, QuantityFulfilled: 3 })} onUpdate={onUpdate} fetchUpdates={jest.fn().mockResolvedValue([])} />
    );

    fireEvent.press(getByTestId('need-fill-decrease'));
    fireEvent.press(getByTestId('need-save-fill'));

    expect(onUpdate).toHaveBeenCalledWith('need-1', IncidentNeedStatus.PartiallyMet, 2, null);

    unmount();
  });

  it('fully filling derives the Met status', () => {
    const onUpdate = jest.fn();
    const { getByTestId, unmount } = render(
      <NeedDetailsSheet isOpen={true} onClose={jest.fn()} need={need({ QuantityFulfilled: 2, Status: IncidentNeedStatus.PartiallyMet })} onUpdate={onUpdate} fetchUpdates={jest.fn().mockResolvedValue([])} />
    );

    fireEvent.press(getByTestId('need-fill-increase'));
    fireEvent.press(getByTestId('need-save-fill'));

    expect(onUpdate).toHaveBeenCalledWith('need-1', IncidentNeedStatus.Met, 3, null);

    unmount();
  });

  it('applies a quick-pick reason chip as the note', () => {
    const onUpdate = jest.fn();
    const { getByTestId, unmount } = render(<NeedDetailsSheet isOpen={true} onClose={jest.fn()} need={need()} onUpdate={onUpdate} fetchUpdates={jest.fn().mockResolvedValue([])} />);

    fireEvent.press(getByTestId('need-reason-need_reason_mutual_aid'));
    fireEvent.press(getByTestId('need-fill-increase'));
    fireEvent.press(getByTestId('need-save-fill'));

    expect(onUpdate).toHaveBeenCalledWith('need-1', IncidentNeedStatus.PartiallyMet, 1, 'command.need_reason_mutual_aid');

    unmount();
  });

  it('closing an unfilled need requires confirmation and sends Cancelled with the note', () => {
    const onUpdate = jest.fn();
    const { getByTestId, unmount } = render(<NeedDetailsSheet isOpen={true} onClose={jest.fn()} need={need({ QuantityFulfilled: 1 })} onUpdate={onUpdate} fetchUpdates={jest.fn().mockResolvedValue([])} />);

    fireEvent.changeText(getByTestId('need-note-input'), 'No longer needed');
    fireEvent.press(getByTestId('need-close'));
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('need-close-confirm'));
    expect(onUpdate).toHaveBeenCalledWith('need-1', IncidentNeedStatus.Cancelled, undefined, 'No longer needed');

    unmount();
  });

  it('renders the audit trail with author, change, and note', async () => {
    const { getByText, getByTestId, unmount } = render(<NeedDetailsSheet isOpen={true} onClose={jest.fn()} need={need()} onUpdate={jest.fn()} fetchUpdates={jest.fn().mockResolvedValue([auditRow])} />);

    await waitFor(() => expect(getByTestId('need-update-u1')).toBeTruthy());
    expect(getByText('Jane Smith')).toBeTruthy();
    expect(getByText('Engine 1 from mutual aid')).toBeTruthy();

    unmount();
  });
});
