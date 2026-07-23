import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { WeatherAlertBanner } from '../weather-alert-banner';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('@/lib/weather-alert-utils', () => ({
  getSeverityColor: jest.fn(() => '#D32F2F'),
}));

const createMockAlert = (overrides = {}) => ({
  WeatherAlertId: 'alert-1',
  DepartmentId: 1,
  Event: 'Tornado Warning',
  Headline: 'Tornado Warning for County',
  Description: '',
  Instructions: '',
  Severity: 0,
  Category: 0,
  Urgency: 0,
  Certainty: 0,
  Status: 0,
  SourceType: 0,
  SourceAlertId: '',
  SenderName: '',
  AreaDescription: '',
  Polygon: '',
  CenterGeoLocation: '',
  EffectiveUtc: '',
  OnsetUtc: '',
  ExpiresUtc: '',
  Ends: '',
  ReceivedOnUtc: '',
  UpdatedOnUtc: '',
  WebUrl: '',
  ZoneCode: '',
  MessageType: '',
  ...overrides,
});

describe('WeatherAlertBanner', () => {
  const mockOnPress = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when no alerts', () => {
    const { toJSON } = render(<WeatherAlertBanner alerts={[]} onPress={mockOnPress} onDismiss={mockOnDismiss} />);
    expect(toJSON()).toBeNull();
  });

  it('should render top alert headline', () => {
    render(<WeatherAlertBanner alerts={[createMockAlert()]} onPress={mockOnPress} onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Tornado Warning for County')).toBeTruthy();
  });

  it('should show +N more badge when multiple alerts', () => {
    const alerts = [createMockAlert({ WeatherAlertId: 'a1' }), createMockAlert({ WeatherAlertId: 'a2' }), createMockAlert({ WeatherAlertId: 'a3' })];
    render(<WeatherAlertBanner alerts={alerts} onPress={mockOnPress} onDismiss={mockOnDismiss} />);
    // The badge should show +2 more
    expect(screen.getByText(/more_alerts/)).toBeTruthy();
  });

  it('should dismiss before navigating when banner is pressed', () => {
    const callOrder: string[] = [];
    mockOnDismiss.mockImplementation(() => callOrder.push('dismiss'));
    mockOnPress.mockImplementation(() => callOrder.push('press'));

    render(<WeatherAlertBanner alerts={[createMockAlert()]} onPress={mockOnPress} onDismiss={mockOnDismiss} />);
    fireEvent.press(screen.getByText('Tornado Warning for County'));

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['dismiss', 'press']);
  });

  it('should dismiss without navigating when the close button is pressed', () => {
    const stopPropagation = jest.fn();
    render(<WeatherAlertBanner alerts={[createMockAlert()]} onPress={mockOnPress} onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByTestId('weather-alert-banner-dismiss');
    fireEvent.press(dismissButton, { stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnPress).not.toHaveBeenCalled();
    expect(dismissButton.props.hitSlop).toBe(8);
  });

  it('should use event name when headline is empty', () => {
    render(<WeatherAlertBanner alerts={[createMockAlert({ Headline: '' })]} onPress={mockOnPress} onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Tornado Warning')).toBeTruthy();
  });
});
