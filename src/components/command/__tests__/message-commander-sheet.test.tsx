import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

import { MessageCommanderSheet } from '../message-commander-sheet';

describe('MessageCommanderSheet', () => {
  it('requires a body before sending and passes trimmed values through', async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    const onClose = jest.fn();
    const { getByTestId, unmount } = render(<MessageCommanderSheet isOpen={true} onClose={onClose} commanderName="Sam Jones" hasDeputies={true} onSend={onSend} />);

    // Empty body — send stays disabled
    fireEvent.press(getByTestId('message-commander-send'));
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.changeText(getByTestId('message-commander-subject'), '  Update  ');
    fireEvent.changeText(getByTestId('message-commander-body'), '  Need a PAR check  ');
    fireEvent(getByTestId('message-commander-deputies'), 'onValueChange', true);
    fireEvent.press(getByTestId('message-commander-send'));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('Update', 'Need a PAR check', true));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    unmount();
  });

  it('sends a null title when the subject is blank and hides the deputies toggle when none are assigned', async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    const { getByTestId, queryByTestId, unmount } = render(<MessageCommanderSheet isOpen={true} onClose={jest.fn()} commanderName={null} hasDeputies={false} onSend={onSend} />);

    expect(queryByTestId('message-commander-deputies')).toBeNull();

    fireEvent.changeText(getByTestId('message-commander-body'), 'Status?');
    fireEvent.press(getByTestId('message-commander-send'));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith(null, 'Status?', false));

    unmount();
  });

  it('stays open when the send fails', async () => {
    const onSend = jest.fn().mockResolvedValue(false);
    const onClose = jest.fn();
    const { getByTestId, unmount } = render(<MessageCommanderSheet isOpen={true} onClose={onClose} commanderName={null} hasDeputies={false} onSend={onSend} />);

    fireEvent.changeText(getByTestId('message-commander-body'), 'Status?');
    fireEvent.press(getByTestId('message-commander-send'));

    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();

    unmount();
  });
});
