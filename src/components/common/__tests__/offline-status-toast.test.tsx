import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { QueuedEventStatus, QueuedEventType, type QueuedEvent } from '@/models/offline-queue/queued-event';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { useToastStore } from '@/stores/toast/store';

import { OfflineStatusToast } from '../offline-status-toast';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));

const pendingEvent: QueuedEvent = {
  id: 'pending-1',
  type: QueuedEventType.SAVE_OBJECTIVE,
  status: QueuedEventStatus.PENDING,
  data: { callId: '101' },
  retryCount: 0,
  maxRetries: 3,
  createdAt: 1750000000000,
};

describe('OfflineStatusToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    useOfflineQueueStore.setState({
      isConnected: true,
      isNetworkReachable: true,
      queuedEvents: [],
      isProcessing: false,
      processingEventId: null,
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('shows a tappable pending-sync toast that opens the queue without syncing', async () => {
    useOfflineQueueStore.setState({ queuedEvents: [pendingEvent] });
    const { unmount } = render(<OfflineStatusToast />);

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    const toast = useToastStore.getState().toasts[0];

    expect(toast.type).toBe('info');
    expect(toast.title).toContain('offline.pending_count');
    expect(toast.message).toBe('settings.view_sync_queue');

    act(() => {
      toast.onPress?.();
    });
    expect(mockPush).toHaveBeenCalledWith('/settings/offline-queue');

    unmount();
  });

  it('shows a dismissable warning instead of a layout bar while offline', async () => {
    useOfflineQueueStore.setState({
      isConnected: false,
      isNetworkReachable: false,
    });
    const { toJSON, unmount } = render(<OfflineStatusToast />);

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));

    expect(toJSON()).toBeNull();
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'warning',
      message: 'offline.offline_message',
    });

    unmount();
  });
});
