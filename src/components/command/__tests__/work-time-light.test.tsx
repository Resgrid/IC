import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) => React.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    CloudOff: icon('cloud-off'),
    GripVertical: icon('grip-vertical'),
    Plus: icon('plus'),
    Trash2: icon('trash'),
    UserPlus: icon('user-plus'),
  };
});

import { WorkTimeLight, workTimeColor } from '../landscape-structure-board';

describe('WorkTimeLight', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-20T10:30:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows elapsed minutes without a rotation badge inside the lane limit', () => {
    const { getByText, queryByTestId, unmount } = render(<WorkTimeLight assignedOn="2026-07-20T10:20:00Z" rotationAfterMinutes={20} testID="wtl" />);

    expect(getByText('10m')).toBeTruthy();
    expect(queryByTestId('wtl-rotation')).toBeNull();

    unmount();
  });

  it('flags rotation-due when the lane MaxTimeInRole is exceeded', () => {
    const { getByText, getByTestId, unmount } = render(<WorkTimeLight assignedOn="2026-07-20T10:00:00Z" rotationAfterMinutes={20} testID="wtl" />);

    expect(getByText('30m')).toBeTruthy();
    expect(getByTestId('wtl-rotation')).toBeTruthy();
    expect(getByText('command.rotation_due')).toBeTruthy();

    unmount();
  });

  it('keeps the default fatigue thresholds when no lane limit is set', () => {
    expect(workTimeColor(10)).toBe('#22c55e');
    expect(workTimeColor(25)).toBe('#f59e0b');
    expect(workTimeColor(45)).toBe('#ef4444');
  });
});
