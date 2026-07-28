import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  return {
    Check: (props: any) => React.createElement('View', { ...props, testID: 'mock-check-icon' }),
  };
});

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

import { CommandNodeType } from '@/models/v4/incidentCommand/incidentCommandModels';

import { AddLaneSheet } from '../add-lane-sheet';

describe('AddLaneSheet', () => {
  it('saves a lane with color and parsed optional limits', () => {
    const onSave = jest.fn();
    const { getByTestId, unmount } = render(<AddLaneSheet isOpen={true} onClose={jest.fn()} onSave={onSave} />);

    fireEvent.changeText(getByTestId('lane-name-input'), 'Fire Attack');
    fireEvent.press(getByTestId('lane-type-1'));
    fireEvent.press(getByTestId('lane-color-e74c3c'));

    fireEvent.press(getByTestId('lane-limits-toggle'));
    fireEvent.changeText(getByTestId('limit-min-units'), '1');
    fireEvent.changeText(getByTestId('limit-max-units'), '3');
    fireEvent.changeText(getByTestId('limit-min-riding'), '2');
    fireEvent.changeText(getByTestId('limit-max-time'), '30');

    fireEvent.press(getByTestId('lane-save'));

    expect(onSave).toHaveBeenCalledWith('Fire Attack', CommandNodeType.Group, '#e74c3c', { minUnits: 1, maxUnits: 3, minUnitPersonnel: 2, maxTimeInRole: 30, workTimeAmberMinutes: 20, workTimeRedMinutes: 40 });

    unmount();
  });

  it('passes the default work-time thresholds when no limits are entered', () => {
    const onSave = jest.fn();
    const { getByTestId, unmount } = render(<AddLaneSheet isOpen={true} onClose={jest.fn()} onSave={onSave} />);

    fireEvent.changeText(getByTestId('lane-name-input'), 'Staging');
    fireEvent.press(getByTestId('lane-save'));

    expect(onSave).toHaveBeenCalledWith('Staging', CommandNodeType.Division, undefined, { workTimeAmberMinutes: 20, workTimeRedMinutes: 40 });

    unmount();
  });

  it('saves custom work-time thresholds and omits cleared ones', () => {
    const onSave = jest.fn();
    const { getByTestId, unmount } = render(<AddLaneSheet isOpen={true} onClose={jest.fn()} onSave={onSave} />);

    fireEvent.changeText(getByTestId('lane-name-input'), 'Rehab');
    fireEvent.press(getByTestId('lane-limits-toggle'));
    fireEvent.changeText(getByTestId('limit-worktime-amber'), '15');
    fireEvent.changeText(getByTestId('limit-worktime-red'), '');
    fireEvent.press(getByTestId('lane-save'));

    expect(onSave).toHaveBeenCalledWith('Rehab', CommandNodeType.Division, undefined, { workTimeAmberMinutes: 15 });

    unmount();
  });
});
