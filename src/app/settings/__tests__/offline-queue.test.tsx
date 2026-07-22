import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}));

jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

jest.mock('@/components/ui/alert-dialog', () => {
  const React = require('react');
  const passthrough = (name: string) => (props: any) => React.createElement('View', { ...props, testID: props.testID ?? `mock-${name}` }, props.children);
  return {
    AlertDialog: ({ children, isOpen }: any) => (isOpen ? children : null),
    AlertDialogBackdrop: () => null,
    AlertDialogContent: passthrough('alert-content'),
    AlertDialogHeader: passthrough('alert-header'),
    AlertDialogBody: passthrough('alert-body'),
    AlertDialogFooter: passthrough('alert-footer'),
  };
});

jest.mock('@/services/offline-event-manager.service', () => ({
  offlineEventManager: { syncNow: jest.fn() },
}));

import { type QueuedEvent, QueuedEventStatus, QueuedEventType } from '@/models/offline-queue/queued-event';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { useToastStore } from '@/stores/toast/store';

import OfflineQueue from '../offline-queue';

const mockSyncNow = offlineEventManager.syncNow as jest.Mock;

const failedEvent: QueuedEvent = {
  id: 'evt-1',
  type: QueuedEventType.CLOSE_COMMAND,
  status: QueuedEventStatus.FAILED,
  data: { callId: '101', incidentCommandId: 'ic-1' },
  retryCount: 3,
  maxRetries: 3,
  createdAt: 1750000000000,
  lastAttemptAt: 1750000100000,
  error: 'Request failed with status code 500',
};

const pendingEvent: QueuedEvent = {
  id: 'evt-2',
  type: QueuedEventType.SAVE_OBJECTIVE,
  status: QueuedEventStatus.PENDING,
  data: { callId: '101', name: 'Primary search', objectiveType: 0 },
  retryCount: 0,
  maxRetries: 3,
  createdAt: 1750000200000,
};

const setupStore = (events: QueuedEvent[], overrides: Record<string, unknown> = {}) => {
  useOfflineQueueStore.setState({
    isConnected: true,
    isNetworkReachable: true,
    queuedEvents: events,
    isProcessing: false,
    processingEventId: null,
    ...overrides,
  } as never);
};

describe('OfflineQueue screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useToastStore.setState({ showToast: jest.fn() } as never);
  });

  it('lists queued events with type, status, and error details', () => {
    setupStore([failedEvent, pendingEvent]);
    const { getByTestId, getByText, unmount } = render(<OfflineQueue />);

    expect(getByTestId('queue-event-evt-1')).toBeTruthy();
    expect(getByTestId('queue-event-evt-2')).toBeTruthy();
    expect(getByText('offline_queue.type_close_command')).toBeTruthy();
    expect(getByText('offline_queue.type_save_objective')).toBeTruthy();
    expect(getByTestId('queue-event-error-evt-1')).toHaveTextContent('Request failed with status code 500');

    unmount();
  });

  it('retries a failed event and kicks a sync', () => {
    setupStore([failedEvent]);
    const { getByTestId, unmount } = render(<OfflineQueue />);

    fireEvent.press(getByTestId('queue-event-retry-evt-1'));

    expect(useOfflineQueueStore.getState().queuedEvents[0].status).toBe(QueuedEventStatus.PENDING);
    expect(mockSyncNow).toHaveBeenCalled();

    unmount();
  });

  it('cancels a single queued event only after confirmation', () => {
    setupStore([failedEvent, pendingEvent]);
    const { getByTestId, unmount } = render(<OfflineQueue />);

    fireEvent.press(getByTestId('queue-event-cancel-evt-2'));
    // Still queued until confirmed.
    expect(useOfflineQueueStore.getState().queuedEvents).toHaveLength(2);

    fireEvent.press(getByTestId('offline-queue-confirm-ok'));

    expect(useOfflineQueueStore.getState().queuedEvents.map((event) => event.id)).toEqual(['evt-1']);

    unmount();
  });

  it('clears the entire queue after confirmation', () => {
    setupStore([failedEvent, pendingEvent]);
    const { getByTestId, unmount } = render(<OfflineQueue />);

    fireEvent.press(getByTestId('offline-queue-clear-all'));
    fireEvent.press(getByTestId('offline-queue-confirm-ok'));

    expect(useOfflineQueueStore.getState().queuedEvents).toHaveLength(0);

    unmount();
  });

  it('sync-now triggers the offline event manager', () => {
    setupStore([pendingEvent]);
    const { getByTestId, unmount } = render(<OfflineQueue />);

    fireEvent.press(getByTestId('offline-queue-sync-now'));

    expect(mockSyncNow).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('shows the empty state when nothing is queued', () => {
    setupStore([]);
    const { getByText, unmount } = render(<OfflineQueue />);

    expect(getByText('offline_queue.empty_heading')).toBeTruthy();

    unmount();
  });
});
