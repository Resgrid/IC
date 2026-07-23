import { router } from 'expo-router';
import { type FC, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { QueuedEventStatus } from '@/models/offline-queue/queued-event';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { useToastStore } from '@/stores/toast/store';

/**
 * Publishes network and pending-sync state through the global toast system without
 * taking up layout space above the navigator. Pending-sync toasts open the queue;
 * manual sync stays on the queue screen.
 */
export const OfflineStatusToast: FC = () => {
  const { t } = useTranslation();
  const isConnected = useOfflineQueueStore((state) => state.isConnected);
  const isNetworkReachable = useOfflineQueueStore((state) => state.isNetworkReachable);
  const queuedEvents = useOfflineQueueStore((state) => state.queuedEvents);
  const showToast = useToastStore((state) => state.showToast);
  const removeToast = useToastStore((state) => state.removeToast);
  const activeToastIdRef = useRef<string | null>(null);

  const pendingCount = useMemo(() => queuedEvents.filter((event) => event.status !== QueuedEventStatus.COMPLETED).length, [queuedEvents]);
  const isOffline = !isConnected || !isNetworkReachable;

  const handleOpenQueue = useCallback(() => {
    router.push('/settings/offline-queue');
  }, []);

  useEffect(() => {
    if (activeToastIdRef.current) {
      removeToast(activeToastIdRef.current);
      activeToastIdRef.current = null;
    }

    if (isOffline) {
      activeToastIdRef.current = showToast(
        'warning',
        pendingCount > 0 ? t('settings.view_sync_queue') : t('offline.offline_message'),
        pendingCount > 0 ? t('offline.offline_with_pending', { count: pendingCount }) : undefined,
        {
          duration: 6000,
          onPress: pendingCount > 0 ? handleOpenQueue : undefined,
        }
      );
    } else if (pendingCount > 0) {
      activeToastIdRef.current = showToast('info', t('settings.view_sync_queue'), t('offline.pending_count', { count: pendingCount }), {
        duration: 6000,
        onPress: handleOpenQueue,
      });
    }
  }, [handleOpenQueue, isOffline, pendingCount, removeToast, showToast, t]);

  useEffect(
    () => () => {
      if (activeToastIdRef.current) {
        removeToast(activeToastIdRef.current);
      }
    },
    [removeToast]
  );

  return null;
};
