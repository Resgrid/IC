import { CloudOff, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { QueuedEventStatus } from '@/models/offline-queue/queued-event';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';

/**
 * Thin status bar shown above the tab content:
 * - offline: warns that data is stale and writes are queued
 * - online with queued writes: shows the pending count and a manual "Sync Now" action
 */
export const OfflineStatusBar: React.FC = () => {
  const { t } = useTranslation();
  const isConnected = useOfflineQueueStore((state) => state.isConnected);
  const isNetworkReachable = useOfflineQueueStore((state) => state.isNetworkReachable);
  const queuedEvents = useOfflineQueueStore((state) => state.queuedEvents);
  const isProcessing = useOfflineQueueStore((state) => state.isProcessing);

  const pendingCount = useMemo(() => queuedEvents.filter((event) => event.status !== QueuedEventStatus.COMPLETED).length, [queuedEvents]);

  const isOffline = !isConnected || !isNetworkReachable;

  const handleSyncNow = useCallback(() => {
    offlineEventManager.syncNow();
  }, []);

  if (isOffline) {
    return (
      <HStack className="items-center justify-center gap-2 bg-amber-500 px-3 py-1.5" testID="offline-status-bar">
        <Icon as={CloudOff} size="sm" className="text-white" />
        <Text className="text-xs font-medium text-white">{pendingCount > 0 ? t('offline.offline_with_pending', { count: pendingCount }) : t('offline.offline_message')}</Text>
      </HStack>
    );
  }

  if (pendingCount > 0) {
    return (
      <HStack className="items-center justify-center gap-3 bg-blue-600 px-3 py-1.5" testID="offline-pending-bar">
        <Text className="text-xs font-medium text-white">{t('offline.pending_count', { count: pendingCount })}</Text>
        <Pressable onPress={handleSyncNow} disabled={isProcessing} testID="sync-now-button">
          <HStack className="items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
            <Icon as={RefreshCw} size="xs" className="text-white" />
            <Text className="text-xs font-semibold text-white">{isProcessing ? t('offline.syncing') : t('offline.sync_now')}</Text>
          </HStack>
        </Pressable>
      </HStack>
    );
  }

  return null;
};
