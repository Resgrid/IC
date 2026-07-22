import { fireEvent, render } from '@testing-library/react-native';
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

import { type TacticalObjective, TacticalObjectiveOutcome, TacticalObjectiveStatus } from '@/models/v4/incidentCommand/incidentCommandModels';

import { ObjectiveDetailsSheet } from '../objective-details-sheet';

const objective = (overrides: Partial<TacticalObjective> = {}): TacticalObjective =>
  ({
    TacticalObjectiveId: 'obj-1',
    IncidentCommandId: 'ic-1',
    DepartmentId: 1,
    CallId: 5,
    Name: 'Primary search',
    ObjectiveType: 0,
    Status: TacticalObjectiveStatus.InProgress,
    AutoPopulated: false,
    ProgressPercent: 50,
    Priority: 0,
    SortOrder: 0,
    ...overrides,
  }) as TacticalObjective;

describe('ObjectiveDetailsSheet', () => {
  it('completes only after confirmation, with the chosen outcome and note', () => {
    const onComplete = jest.fn();
    const { getByTestId, unmount } = render(<ObjectiveDetailsSheet isOpen={true} onClose={jest.fn()} objective={objective()} onComplete={onComplete} />);

    fireEvent.press(getByTestId(`objective-outcome-${TacticalObjectiveOutcome.Partial}`));
    fireEvent.changeText(getByTestId('objective-note-input'), 'South wing inaccessible');
    fireEvent.press(getByTestId('objective-complete-button'));
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('objective-complete-confirm'));
    expect(onComplete).toHaveBeenCalledWith('obj-1', TacticalObjectiveOutcome.Partial, 'South wing inaccessible');

    unmount();
  });

  it('defaults the outcome to Successful', () => {
    const onComplete = jest.fn();
    const { getByTestId, unmount } = render(<ObjectiveDetailsSheet isOpen={true} onClose={jest.fn()} objective={objective()} onComplete={onComplete} />);

    fireEvent.press(getByTestId('objective-complete-button'));
    fireEvent.press(getByTestId('objective-complete-confirm'));

    expect(onComplete).toHaveBeenCalledWith('obj-1', TacticalObjectiveOutcome.Successful, null);

    unmount();
  });

  it('updates progress from the quick-set row', () => {
    const onUpdateProgress = jest.fn();
    const { getByTestId, unmount } = render(<ObjectiveDetailsSheet isOpen={true} onClose={jest.fn()} objective={objective()} onComplete={jest.fn()} onUpdateProgress={onUpdateProgress} />);

    fireEvent.press(getByTestId('objective-sheet-progress-75'));

    expect(onUpdateProgress).toHaveBeenCalledWith('obj-1', 75);

    unmount();
  });

  it('shows read-only close-out details for a completed objective', () => {
    const completed = objective({
      Status: TacticalObjectiveStatus.Complete,
      Outcome: TacticalObjectiveOutcome.Unsuccessful,
      CompletionNote: 'Fire overtook the wing',
      CompletedByUserId: 'u-2',
      CompletedOn: '2026-07-01T12:00:00Z',
    });
    const { getByTestId, getByText, queryByTestId, unmount } = render(
      <ObjectiveDetailsSheet isOpen={true} onClose={jest.fn()} objective={completed} onComplete={jest.fn()} resolveUserName={() => 'Jane Smith'} />
    );

    expect(getByTestId('objective-details-outcome')).toBeTruthy();
    expect(getByText('Fire overtook the wing')).toBeTruthy();
    expect(queryByTestId('objective-complete-button')).toBeNull();

    unmount();
  });
});
