import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { useToastStore } from '@/stores/toast/store';

import { ToastMessage } from '../toast';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ToastMessage', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('can be explicitly dismissed', () => {
    useToastStore.setState({
      toasts: [{ id: 'dismissable', type: 'info', message: 'Pending changes' }],
    });
    render(<ToastMessage id="dismissable" type="info" message="Pending changes" />);

    fireEvent.press(screen.getByTestId('toast-dismiss-dismissable'), {
      stopPropagation: jest.fn(),
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('runs its action and dismisses when the toast is pressed', () => {
    const onPress = jest.fn();
    useToastStore.setState({
      toasts: [{ id: 'actionable', type: 'info', message: 'View queue', onPress }],
    });
    render(<ToastMessage id="actionable" type="info" message="View queue" onPress={onPress} />);

    fireEvent.press(screen.getByTestId('toast-message-actionable'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
