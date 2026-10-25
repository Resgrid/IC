import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 30, left: 0, right: 0 }),
}));

import { MapLegendButton } from '../map-legend-button';

describe('MapLegendButton', () => {
  it('is an accessible round control above the bottom safe area that calls onPress', () => {
    const onPress = jest.fn();
    render(<MapLegendButton onPress={onPress} />);

    const button = screen.getByTestId('map-legend-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(screen.getByLabelText('maps.legend.title')).toBeTruthy();
    expect(button).toHaveStyle({ position: 'absolute', right: 20, bottom: 50, width: 48, height: 48, borderRadius: 24, backgroundColor: '#3b82f6' });

    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('stacks at the requested offset', () => {
    render(<MapLegendButton onPress={jest.fn()} bottomOffset={76} testID="legend" />);

    expect(screen.getByTestId('legend')).toHaveStyle({ bottom: 106 });
  });
});
