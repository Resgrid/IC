import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) => React.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    ChevronRight: icon('chevron-right'),
    ClipboardList: icon('clipboard-list'),
    CloudAlert: icon('cloud-alert'),
    Map: icon('map'),
    Megaphone: icon('megaphone'),
    Settings: icon('settings'),
  };
});

import Sidebar from '../sidebar-content';

describe('Sidebar menu', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders a link for every page', () => {
    const { getByTestId, unmount } = render(<Sidebar />);

    expect(getByTestId('sidebar-link-map')).toBeTruthy();
    expect(getByTestId('sidebar-link-calls')).toBeTruthy();
    expect(getByTestId('sidebar-link-command')).toBeTruthy();
    expect(getByTestId('sidebar-link-weather-alerts')).toBeTruthy();
    expect(getByTestId('sidebar-link-settings')).toBeTruthy();

    unmount();
  });

  it('renders translated labels', () => {
    const { getByText, unmount } = render(<Sidebar />);

    expect(getByText('sidebar.menu')).toBeTruthy();
    expect(getByText('tabs.map')).toBeTruthy();
    expect(getByText('tabs.calls')).toBeTruthy();
    expect(getByText('tabs.command_board')).toBeTruthy();
    expect(getByText('tabs.weather_alerts')).toBeTruthy();
    expect(getByText('tabs.settings')).toBeTruthy();

    unmount();
  });

  it('navigates and closes the drawer when a link is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId, unmount } = render(<Sidebar onClose={onClose} />);

    fireEvent.press(getByTestId('sidebar-link-command'));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/command');

    unmount();
  });

  it('navigates to the map root from the map link', () => {
    const { getByTestId, unmount } = render(<Sidebar />);

    fireEvent.press(getByTestId('sidebar-link-map'));

    expect(mockPush).toHaveBeenCalledWith('/');

    unmount();
  });
});
