import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

import { SideDrawer } from '../side-drawer';

describe('SideDrawer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing until opened', () => {
    const { queryByTestId, unmount } = render(
      <SideDrawer isOpen={false} onClose={jest.fn()} testID="drawer">
        <Text>Menu</Text>
      </SideDrawer>
    );

    expect(queryByTestId('drawer-panel')).toBeNull();

    unmount();
  });

  it('shows the panel with its content when open', () => {
    const { getByTestId, getByText, unmount } = render(
      <SideDrawer isOpen={true} onClose={jest.fn()} testID="drawer">
        <Text>Menu</Text>
      </SideDrawer>
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(getByTestId('drawer-panel')).toBeTruthy();
    expect(getByText('Menu')).toBeTruthy();

    unmount();
  });

  it('dismisses when tapping the backdrop outside the panel', () => {
    const onClose = jest.fn();
    const { getByTestId, unmount } = render(
      <SideDrawer isOpen={true} onClose={onClose} testID="drawer">
        <Text>Menu</Text>
      </SideDrawer>
    );

    // The backdrop only accepts taps after the open animation settles (guards the opening tap).
    act(() => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.press(getByTestId('drawer-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
  });
});
