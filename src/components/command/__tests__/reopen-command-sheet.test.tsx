import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

import { type IncidentCommand } from '@/models/v4/incidentCommand/incidentCommandModels';

import { ReopenCommandSheet } from '../reopen-command-sheet';

const priorCommand = {
  IncidentCommandId: 'ic-1',
  DepartmentId: 1,
  CallId: 5,
  Status: 1,
  EstablishedOn: '2026-07-01T10:00:00Z',
  ClosedOn: '2026-07-01T14:00:00Z',
} as unknown as IncidentCommand;

describe('ReopenCommandSheet', () => {
  it('reopens with the entered reason and closes', () => {
    const onReopen = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, unmount } = render(<ReopenCommandSheet isOpen={true} onClose={onClose} priorCommand={priorCommand} onReopen={onReopen} onStartNew={jest.fn()} />);

    fireEvent.changeText(getByTestId('reopen-reason-input'), 'Fire rekindled');
    fireEvent.press(getByTestId('reopen-confirm'));

    expect(onReopen).toHaveBeenCalledWith('Fire rekindled');
    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('falls through to a new command when requested', () => {
    const onStartNew = jest.fn();
    const onReopen = jest.fn();
    const { getByTestId, unmount } = render(<ReopenCommandSheet isOpen={true} onClose={jest.fn()} priorCommand={priorCommand} onReopen={onReopen} onStartNew={onStartNew} />);

    fireEvent.press(getByTestId('reopen-start-new'));

    expect(onStartNew).toHaveBeenCalled();
    expect(onReopen).not.toHaveBeenCalled();

    unmount();
  });
});
