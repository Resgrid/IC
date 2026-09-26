import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { getReadinessPacket } from '@/api/checklists/readiness';
import { type ReadinessPacket } from '@/lib/checklists/readiness';

import { UnitReadinessPanel } from '../unit-readiness-panel';

interface MockChildrenProps {
  children?: React.ReactNode;
  testID?: string;
}

interface MockButtonProps extends MockChildrenProps {
  onPress?: () => void;
}

jest.mock('@/api/checklists/readiness', () => ({
  getReadinessPacket: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, testID }: MockButtonProps) => (
      <TouchableOpacity onPress={onPress} testID={testID}>
        {children}
      </TouchableOpacity>
    ),
    ButtonText: ({ children }: MockChildrenProps) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/hstack', () => {
  const { View } = require('react-native');
  return { HStack: ({ children, testID }: MockChildrenProps) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children, testID }: MockChildrenProps) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

const mockGetReadinessPacket = getReadinessPacket as jest.MockedFunction<typeof getReadinessPacket>;

const packetFor = (callId: number, unitId: number, name: string): ReadinessPacket => ({
  CallId: callId,
  CoverageStartUtc: '2026-08-26T00:00:00Z',
  CoverageEndUtc: '2026-09-25T00:00:00Z',
  Units: [{ UnitId: unitId, Name: name, DispatchedUtc: '2026-09-25T00:00:00Z' }],
  Checklists: [],
  WorkOrders: [],
  UnavailableSources: [],
});

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe('UnitReadinessPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the readiness of the units on the call', async () => {
    mockGetReadinessPacket.mockResolvedValue(packetFor(1, 11, 'Engine 11'));

    const { unmount } = render(<UnitReadinessPanel callId={1} />);

    expect(await screen.findByTestId('unit-readiness-11')).toBeTruthy();
    expect(mockGetReadinessPacket).toHaveBeenCalledWith(1);
    unmount();
  });

  it('keeps the current call when an earlier call answers after it', async () => {
    const first = deferred<ReadinessPacket>();
    const second = deferred<ReadinessPacket>();
    mockGetReadinessPacket.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { rerender, unmount } = render(<UnitReadinessPanel callId={1} />);
    rerender(<UnitReadinessPanel callId={2} />);

    await act(async () => {
      second.resolve(packetFor(2, 22, 'Ladder 22'));
    });
    await act(async () => {
      first.resolve(packetFor(1, 11, 'Engine 11'));
    });

    expect(screen.getByTestId('unit-readiness-22')).toBeTruthy();
    expect(screen.queryByTestId('unit-readiness-11')).toBeNull();
    expect(screen.queryByTestId('spinner')).toBeNull();
    unmount();
  });

  it('does not show a failure from an earlier call once the current one has loaded', async () => {
    const first = deferred<ReadinessPacket>();
    mockGetReadinessPacket.mockReturnValueOnce(first.promise.then(() => Promise.reject(new Error('offline')))).mockResolvedValueOnce(packetFor(2, 22, 'Ladder 22'));

    const { rerender, unmount } = render(<UnitReadinessPanel callId={1} />);
    rerender(<UnitReadinessPanel callId={2} />);
    expect(await screen.findByTestId('unit-readiness-22')).toBeTruthy();

    await act(async () => {
      first.resolve(packetFor(1, 11, 'Engine 11'));
    });

    expect(screen.queryByTestId('unit-readiness-retry')).toBeNull();
    unmount();
  });
});
