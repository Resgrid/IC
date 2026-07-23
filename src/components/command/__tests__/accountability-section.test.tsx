import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';

import { AccountabilitySection } from '../accountability-section';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const ReactModule = require('react');
  const icon = (name: string) => (props: Record<string, unknown>) => ReactModule.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    RefreshCw: icon('refresh'),
    ShieldCheck: icon('shield-check'),
    TimerReset: icon('timer-reset'),
  };
});

const mockFetchTimerStatuses = jest.fn().mockResolvedValue(undefined);
const mockFetchPersonnelStatuses = jest.fn().mockResolvedValue(undefined);
const mockFetchResolvedTimers = jest.fn().mockResolvedValue(undefined);
const mockPerformCheckIn = jest.fn().mockResolvedValue('success');
const mockSetCallTimersEnabled = jest.fn().mockResolvedValue(true);
const mockStartPolling = jest.fn();
const mockStopPolling = jest.fn();
const mockShowToast = jest.fn();

interface MockCheckInState {
  timerStatuses: CheckInTimerStatusResultData[];
  personnelStatuses: {
    UserId: string;
    FullName: string;
    LastCheckIn: string | null;
    NeedsCheckIn: boolean;
    MinutesRemaining: number;
    Status: string;
  }[];
  isLoadingStatuses: boolean;
  isCheckingIn: boolean;
  isTogglingTimers: boolean;
  fetchTimerStatuses: typeof mockFetchTimerStatuses;
  fetchPersonnelStatuses: typeof mockFetchPersonnelStatuses;
  fetchResolvedTimers: typeof mockFetchResolvedTimers;
  performCheckIn: typeof mockPerformCheckIn;
  setCallTimersEnabled: typeof mockSetCallTimersEnabled;
  startPolling: typeof mockStartPolling;
  stopPolling: typeof mockStopPolling;
}

let mockCheckInState: MockCheckInState;

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: (selector: (state: MockCheckInState) => unknown) => selector(mockCheckInState),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: (selector: (state: { latitude: number; longitude: number }) => unknown) => selector({ latitude: 47.61, longitude: -122.33 }),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: (selector: (state: { showToast: typeof mockShowToast }) => unknown) => selector({ showToast: mockShowToast }),
}));

jest.mock('@/lib/utils', () => ({
  getTimeAgoUtc: () => '5 minutes ago',
}));

const icTimer: CheckInTimerStatusResultData = {
  TargetType: 2,
  TargetTypeName: 'IC',
  TargetEntityId: '',
  TargetName: 'Incident Command',
  UnitId: null,
  LastCheckIn: null,
  DurationMinutes: 15,
  WarningThresholdMinutes: 5,
  ElapsedMinutes: 3,
  Status: 'Green',
};

const unitTimer: CheckInTimerStatusResultData = {
  TargetType: 1,
  TargetTypeName: 'UnitType',
  TargetEntityId: '7',
  TargetName: 'Engine',
  UnitId: null,
  LastCheckIn: null,
  DurationMinutes: 20,
  WarningThresholdMinutes: 5,
  ElapsedMinutes: 4,
  Status: 'Warning',
};

const assignedEngine = {
  UnitId: '42',
  TypeId: 7,
  Name: 'Engine 42',
  Type: 'Engine',
} as UnitResultData;

const createState = (overrides: Partial<MockCheckInState> = {}): MockCheckInState => ({
  timerStatuses: [],
  personnelStatuses: [],
  isLoadingStatuses: false,
  isCheckingIn: false,
  isTogglingTimers: false,
  fetchTimerStatuses: mockFetchTimerStatuses,
  fetchPersonnelStatuses: mockFetchPersonnelStatuses,
  fetchResolvedTimers: mockFetchResolvedTimers,
  performCheckIn: mockPerformCheckIn,
  setCallTimersEnabled: mockSetCallTimersEnabled,
  startPolling: mockStartPolling,
  stopPolling: mockStopPolling,
  ...overrides,
});

describe('AccountabilitySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckInState = createState();
  });

  it('shows an activation action instead of a pre-populated critical warning when timers are inactive', async () => {
    const onTimersActivated = jest.fn();
    const { getByTestId, getByText, unmount } = render(<AccountabilitySection callId={101} initialTimersEnabled={false} units={[]} onTimersActivated={onTimersActivated} />);

    expect(getByText('command.accountability_inactive_description')).toBeTruthy();
    expect(getByTestId('command-accountability-activate')).toBeTruthy();

    fireEvent.press(getByTestId('command-accountability-activate'));

    await waitFor(() => {
      expect(mockSetCallTimersEnabled).toHaveBeenCalledWith(101, true);
      expect(onTimersActivated).toHaveBeenCalled();
    });

    unmount();
  });

  it('lets the IC complete personnel, IC, and unit-type check-ins from accountability', async () => {
    mockCheckInState = createState({
      timerStatuses: [icTimer, unitTimer],
      personnelStatuses: [
        {
          UserId: 'user-9',
          FullName: 'Alex Rivera',
          LastCheckIn: null,
          NeedsCheckIn: true,
          MinutesRemaining: -2,
          Status: 'Critical',
        },
      ],
    });

    const { getByTestId, unmount } = render(<AccountabilitySection callId={101} initialTimersEnabled={true} units={[assignedEngine]} />);

    await waitFor(() => expect(getByTestId('accountability-user-9')).toBeTruthy());

    fireEvent.press(getByTestId('accountability-check-in-user-9'));
    await waitFor(() =>
      expect(mockPerformCheckIn).toHaveBeenCalledWith({
        CallId: 101,
        CheckInType: 0,
        UserId: 'user-9',
        Latitude: '47.61',
        Longitude: '-122.33',
      })
    );

    fireEvent.press(getByTestId('accountability-timer-check-in-2-'));
    await waitFor(() =>
      expect(mockPerformCheckIn).toHaveBeenCalledWith({
        CallId: 101,
        CheckInType: 2,
        UnitId: undefined,
        Latitude: '47.61',
        Longitude: '-122.33',
      })
    );

    fireEvent.press(getByTestId('accountability-timer-check-in-1-7'));
    await waitFor(() =>
      expect(mockPerformCheckIn).toHaveBeenCalledWith({
        CallId: 101,
        CheckInType: 1,
        UnitId: 42,
        Latitude: '47.61',
        Longitude: '-122.33',
      })
    );

    unmount();
  });
});
