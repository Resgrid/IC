import { Stack } from 'expo-router';
import { CloudOff, Inbox, RefreshCw, RotateCcw, Trash2, Wifi } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import ZeroState from '@/components/common/zero-state';
import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { type QueuedEvent, QueuedEventStatus } from '@/models/offline-queue/queued-event';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { useToastStore } from '@/stores/toast/store';

type ConfirmAction = { kind: 'clear_all' } | { kind: 'remove'; eventId: string } | null;

const statusBadgeAction = (status: QueuedEventStatus): 'muted' | 'info' | 'error' | 'success' => {
  switch (status) {
    case QueuedEventStatus.PROCESSING:
      return 'info';
    case QueuedEventStatus.FAILED:
      return 'error';
    case QueuedEventStatus.COMPLETED:
      return 'success';
    default:
      return 'muted';
  }
};

/**
 * Sync queue inspector: every queued offline write with its status, attempts, and error, plus
 * retry / cancel per event and sync-now / retry-failed / clear actions for the whole queue.
 */
export default function OfflineQueue() {
  const { t } = useTranslation();
  const isConnected = useOfflineQueueStore((state) => state.isConnected);
  const isNetworkReachable = useOfflineQueueStore((state) => state.isNetworkReachable);
  const queuedEvents = useOfflineQueueStore((state) => state.queuedEvents);
  const isProcessing = useOfflineQueueStore((state) => state.isProcessing);
  const processingEventId = useOfflineQueueStore((state) => state.processingEventId);
  const removeEvent = useOfflineQueueStore((state) => state.removeEvent);
  const retryEvent = useOfflineQueueStore((state) => state.retryEvent);
  const retryAllFailedEvents = useOfflineQueueStore((state) => state.retryAllFailedEvents);
  const clearCompletedEvents = useOfflineQueueStore((state) => state.clearCompletedEvents);
  const clearAllEvents = useOfflineQueueStore((state) => state.clearAllEvents);
  const showToast = useToastStore((state) => state.showToast);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const isOffline = !isConnected || !isNetworkReachable;

  const events = useMemo(() => [...queuedEvents].sort((a, b) => b.createdAt - a.createdAt), [queuedEvents]);
  const pendingCount = useMemo(() => queuedEvents.filter((event) => event.status === QueuedEventStatus.PENDING || event.status === QueuedEventStatus.PROCESSING).length, [queuedEvents]);
  const failedCount = useMemo(() => queuedEvents.filter((event) => event.status === QueuedEventStatus.FAILED).length, [queuedEvents]);
  const completedCount = useMemo(() => queuedEvents.filter((event) => event.status === QueuedEventStatus.COMPLETED).length, [queuedEvents]);

  const handleSyncNow = useCallback(() => {
    offlineEventManager.syncNow();
    showToast('info', t('offline_queue.sync_started'));
  }, [showToast, t]);

  const handleRetryAll = useCallback(() => {
    retryAllFailedEvents();
    if (!isOffline) {
      offlineEventManager.syncNow();
    }
    showToast('info', t('offline_queue.retry_all_started'));
  }, [retryAllFailedEvents, isOffline, showToast, t]);

  const handleRetryEvent = useCallback(
    (eventId: string) => {
      retryEvent(eventId);
      if (!isOffline) {
        offlineEventManager.syncNow();
      }
    },
    [retryEvent, isOffline]
  );

  const handleConfirm = useCallback(() => {
    if (!confirmAction) {
      return;
    }
    if (confirmAction.kind === 'clear_all') {
      clearAllEvents();
      showToast('success', t('offline_queue.cleared'));
    } else {
      removeEvent(confirmAction.eventId);
      showToast('success', t('offline_queue.event_cancelled'));
    }
    setConfirmAction(null);
  }, [confirmAction, clearAllEvents, removeEvent, showToast, t]);

  const statusLabel = useCallback(
    (status: QueuedEventStatus) => {
      switch (status) {
        case QueuedEventStatus.PROCESSING:
          return t('offline_queue.status_processing');
        case QueuedEventStatus.FAILED:
          return t('offline_queue.status_failed');
        case QueuedEventStatus.COMPLETED:
          return t('offline_queue.status_completed');
        default:
          return t('offline_queue.status_pending');
      }
    },
    [t]
  );

  const renderEvent = useCallback(
    ({ item }: { item: QueuedEvent }) => {
      const callId = typeof item.data?.callId === 'string' || typeof item.data?.callId === 'number' ? String(item.data.callId) : null;
      const isEventProcessing = processingEventId === item.id;
      const exhausted = item.status === QueuedEventStatus.FAILED && item.retryCount >= item.maxRetries;

      return (
        <Box className="mb-2 rounded-lg bg-white p-3 dark:bg-gray-800" testID={`queue-event-${item.id}`}>
          <HStack className="items-center justify-between">
            <Text className="min-w-0 flex-1 pr-2 text-sm font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
              {t(`offline_queue.type_${item.type}`)}
            </Text>
            <Badge action={statusBadgeAction(item.status)} size="sm" testID={`queue-event-status-${item.id}`}>
              <BadgeText>{isEventProcessing ? t('offline_queue.status_processing') : statusLabel(item.status)}</BadgeText>
            </Badge>
          </HStack>

          <HStack space="sm" className="mt-1 flex-wrap items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.createdAt).toLocaleString()}</Text>
            {callId ? <Text className="text-xs text-gray-500 dark:text-gray-400">{`${t('offline_queue.call_label')} ${callId}`}</Text> : null}
            <Text className="text-xs text-gray-500 dark:text-gray-400">{t('offline_queue.attempts', { count: item.retryCount, max: item.maxRetries })}</Text>
          </HStack>

          {item.error ? (
            <Text className="mt-1 text-xs text-error-600 dark:text-error-400" testID={`queue-event-error-${item.id}`}>
              {item.error}
            </Text>
          ) : null}
          {exhausted ? <Text className="mt-1 text-xs text-error-600 dark:text-error-400">{t('offline_queue.retries_exhausted')}</Text> : null}

          <HStack space="sm" className="mt-2 justify-end">
            {item.status === QueuedEventStatus.FAILED ? (
              <Button size="xs" variant="outline" onPress={() => handleRetryEvent(item.id)} testID={`queue-event-retry-${item.id}`}>
                <ButtonIcon as={RotateCcw} />
                <ButtonText>{t('offline_queue.retry')}</ButtonText>
              </Button>
            ) : null}
            {item.status !== QueuedEventStatus.PROCESSING ? (
              <Button size="xs" variant="outline" action="negative" onPress={() => setConfirmAction({ kind: 'remove', eventId: item.id })} testID={`queue-event-cancel-${item.id}`}>
                <ButtonIcon as={Trash2} />
                <ButtonText>{t('offline_queue.cancel_event')}</ButtonText>
              </Button>
            ) : null}
          </HStack>
        </Box>
      );
    },
    [t, processingEventId, statusLabel, handleRetryEvent]
  );

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900" testID="offline-queue-screen">
      <Stack.Screen options={{ title: t('offline_queue.title'), headerShown: true }} />
      <FocusAwareStatusBar />

      <Box className="flex-1 px-4 pt-3">
        {/* Connection + queue summary */}
        <Box className="mb-3 rounded-lg bg-white p-3 dark:bg-gray-800" testID="offline-queue-summary">
          <HStack className="items-center justify-between">
            <HStack space="sm" className="items-center">
              <Icon as={isOffline ? CloudOff : Wifi} size="sm" className={isOffline ? 'text-amber-500' : 'text-success-600'} />
              <Text className="text-sm font-medium text-gray-900 dark:text-white">{isOffline ? t('offline_queue.offline') : t('offline_queue.online')}</Text>
              {isProcessing ? (
                <Badge action="info" size="sm">
                  <BadgeText>{t('offline_queue.status_processing')}</BadgeText>
                </Badge>
              ) : null}
            </HStack>
            <Text className="text-xs text-gray-500 dark:text-gray-400" testID="offline-queue-counts">
              {t('offline_queue.counts', { pending: pendingCount, failed: failedCount, completed: completedCount })}
            </Text>
          </HStack>

          <HStack space="sm" className="mt-3 flex-wrap">
            <Button size="xs" onPress={handleSyncNow} isDisabled={isOffline || isProcessing || pendingCount === 0} testID="offline-queue-sync-now">
              <ButtonIcon as={RefreshCw} />
              <ButtonText>{t('offline_queue.sync_now')}</ButtonText>
            </Button>
            <Button size="xs" variant="outline" onPress={handleRetryAll} isDisabled={failedCount === 0} testID="offline-queue-retry-all">
              <ButtonIcon as={RotateCcw} />
              <ButtonText>{t('offline_queue.retry_all')}</ButtonText>
            </Button>
            <Button size="xs" variant="outline" onPress={clearCompletedEvents} isDisabled={completedCount === 0} testID="offline-queue-clear-completed">
              <ButtonText>{t('offline_queue.clear_completed')}</ButtonText>
            </Button>
            <Button size="xs" variant="outline" action="negative" onPress={() => setConfirmAction({ kind: 'clear_all' })} isDisabled={queuedEvents.length === 0} testID="offline-queue-clear-all">
              <ButtonIcon as={Trash2} />
              <ButtonText>{t('offline_queue.clear_all')}</ButtonText>
            </Button>
          </HStack>
        </Box>

        <FlatList<QueuedEvent>
          testID="offline-queue-list"
          data={events}
          keyExtractor={(item: QueuedEvent) => item.id}
          renderItem={renderEvent}
          ListEmptyComponent={<ZeroState icon={Inbox} heading={t('offline_queue.empty_heading')} description={t('offline_queue.empty_description')} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </Box>

      {/* Destructive confirmation: cancel one queued write, or clear the whole queue */}
      <AlertDialog isOpen={confirmAction !== null} onClose={() => setConfirmAction(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="offline-queue-confirm-dialog">
          <AlertDialogHeader>
            <Heading size="md">{confirmAction?.kind === 'clear_all' ? t('offline_queue.clear_all_confirm_title') : t('offline_queue.cancel_event_confirm_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">{confirmAction?.kind === 'clear_all' ? t('offline_queue.clear_all_confirm_message') : t('offline_queue.cancel_event_confirm_message')}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setConfirmAction(null)} testID="offline-queue-confirm-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button action="negative" onPress={handleConfirm} testID="offline-queue-confirm-ok">
              <ButtonText>{confirmAction?.kind === 'clear_all' ? t('offline_queue.clear_all') : t('offline_queue.cancel_event')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
