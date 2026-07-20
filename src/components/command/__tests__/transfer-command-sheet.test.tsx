import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

import { TransferCommandSheet } from '../transfer-command-sheet';

const personnel = [
  { UserId: 'u-1', FirstName: 'Sam', LastName: 'Jones', GroupName: 'Station 1', Status: 'Available' },
  { UserId: 'u-2', FirstName: 'Alex', LastName: 'Reed', GroupName: 'Station 2', Status: 'On Scene' },
] as PersonnelInfoResultData[];

describe('TransferCommandSheet', () => {
  it('marks the current commander, prevents selecting them, and transfers to another user', () => {
    const onTransfer = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText, unmount } = render(<TransferCommandSheet isOpen={true} onClose={onClose} personnel={personnel} currentCommanderUserId="u-1" onTransfer={onTransfer} />);

    expect(getByText('command.current_commander')).toBeTruthy();

    // Commander row is disabled — pressing it selects nothing
    fireEvent.press(getByTestId('transfer-person-u-1'));
    fireEvent.press(getByTestId('transfer-confirm'));
    expect(onTransfer).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('transfer-person-u-2'));
    fireEvent.press(getByTestId('transfer-confirm'));
    expect(onTransfer).toHaveBeenCalledWith('u-2');
    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('filters personnel by search', () => {
    const { getByTestId, queryByText, unmount } = render(<TransferCommandSheet isOpen={true} onClose={jest.fn()} personnel={personnel} onTransfer={jest.fn()} />);

    fireEvent.changeText(getByTestId('transfer-search'), 'alex');
    expect(queryByText('Sam Jones')).toBeNull();

    unmount();
  });
});
