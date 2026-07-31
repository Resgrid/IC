import { useNotifications } from '@novu/react-native';
import { router } from 'expo-router';
import { CheckCircle, ChevronRight, Circle, ExternalLink, MoreVertical, Trash2, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Dimensions, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import { deleteMessage } from '@/api/novu/inbox';
import { NotificationDetail } from '@/components/notifications/NotificationDetail';
import { Button } from '@/components/ui/button';
import { FlatList } from '@/components/ui/flat-list';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/auth';
import { useCoreStore } from '@/stores/app/core-store';
import { useToastStore } from '@/stores/toast/store';
import { type NotificationPayload } from '@/types/notification';

// Constants
const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.85, 400);
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

/** The notification item shape returned by Novu's useNotifications hook. */
type NovuNotification = NonNullable<ReturnType<typeof useNotifications>['notifications']>[number];

/**
 * Maps a Novu inbox notification to our display payload. Reference info comes from the trigger
 * payload (`data`): either explicit referenceType/referenceId, or the eventCode prefix scheme
 * the server uses (C{callId} = call, N/M{messageId} = message/notification).
 */
const toNotificationPayload = (item: NovuNotification): NotificationPayload => {
  const data = (item.data ?? {}) as Record<string, unknown>;
  const eventCode = typeof data.eventCode === 'string' ? data.eventCode : undefined;
  const eventId = typeof data.eventId === 'string' ? data.eventId : undefined;

  let referenceType = typeof data.referenceType === 'string' ? data.referenceType : undefined;
  let referenceId = typeof data.referenceId === 'string' ? data.referenceId : undefined;

  if ((!referenceType || !referenceId) && eventCode && eventCode.length > 1) {
    const prefix = eventCode.charAt(0).toUpperCase();
    if (prefix === 'C') {
      referenceType = 'call';
      referenceId = referenceId ?? eventId ?? eventCode.slice(1);
    }
  }

  return {
    id: item.id,
    title: item.subject,
    body: item.body,
    createdAt: item.createdAt,
    read: item.isRead,
    type: typeof data.type === 'string' ? data.type : undefined,
    referenceId,
    referenceType: referenceType as NotificationPayload['referenceType'],
    metadata: data,
  };
};

interface NotificationInboxProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationRowProps {
  item: NovuNotification;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPress: (notification: NotificationPayload) => void;
  onLongPress: (notificationId: string) => void;
  onNavigateToReference: (referenceType: string, referenceId: string) => void;
}

const parseNotificationDate = (createdAt: string | undefined | null): Date | null => {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatNotificationDate = (createdAt: string | undefined | null): string => parseNotificationDate(createdAt)?.toLocaleDateString() ?? '';

const formatNotificationTime = (createdAt: string | undefined | null): string => parseNotificationDate(createdAt)?.toLocaleTimeString() ?? '';

const NotificationRow = React.memo<NotificationRowProps>(({ item, isSelectionMode, isSelected, onPress, onLongPress, onNavigateToReference }) => {
  const { colorScheme } = useColorScheme();
  const themed = React.useMemo(() => createThemedStyles(colorScheme === 'dark'), [colorScheme]);
  const notification: NotificationPayload = React.useMemo(() => toNotificationPayload(item), [item]);

  const formattedDate = React.useMemo(() => formatNotificationDate(notification.createdAt), [notification.createdAt]);
  const formattedTime = React.useMemo(() => formatNotificationTime(notification.createdAt), [notification.createdAt]);

  const handlePress = React.useCallback(() => onPress(notification), [onPress, notification]);
  const handleLongPress = React.useCallback(() => onLongPress(notification.id), [onLongPress, notification.id]);
  const handleNavigate = React.useCallback(() => {
    if (notification.referenceType && notification.referenceId) {
      onNavigateToReference(notification.referenceType, notification.referenceId);
    }
  }, [onNavigateToReference, notification.referenceType, notification.referenceId]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={[styles.notificationItem, themed.notificationItem, !notification.read ? themed.unreadNotificationItem : {}, isSelected ? themed.selectedNotificationItem : {}]}
    >
      {!notification.read ? <View style={[styles.unreadIndicator, themed.unreadIndicator]} /> : null}

      {isSelectionMode ? (
        <View style={styles.selectionIndicator}>
          {isSelected ? <CheckCircle size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} /> : <Circle size={24} className="text-gray-400 dark:text-gray-500" strokeWidth={2} />}
        </View>
      ) : null}

      <View style={styles.notificationContent}>
        <Text style={[styles.notificationBody, themed.notificationBody, !notification.read ? themed.unreadNotificationText : {}]}>{notification.title}</Text>
        <Text style={[styles.timestamp, themed.timestamp]}>
          {formattedDate} {formattedTime}
        </Text>
      </View>

      {!isSelectionMode ? (
        notification.referenceType && notification.referenceId ? (
          <View style={styles.actionButtons}>
            <Button onPress={handleNavigate} variant="outline" className="size-8 p-0">
              <ExternalLink size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
            </Button>
            <ChevronRight size={24} className="ml-2 text-gray-400" strokeWidth={2} />
          </View>
        ) : (
          <ChevronRight size={24} className="ml-2 text-gray-400" strokeWidth={2} />
        )
      ) : null}
    </Pressable>
  );
});
NotificationRow.displayName = 'NotificationRow';

export const NotificationInbox = ({ isOpen, onClose }: NotificationInboxProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const themed = React.useMemo(() => createThemedStyles(colorScheme === 'dark'), [colorScheme]);
  const userId = useAuthStore((state) => state.userId);
  const config = useCoreStore((state) => state.config);
  const { notifications, isLoading, fetchMore, hasMore, refetch } = useNotifications();
  const showToast = useToastStore((state) => state.showToast);
  const [selectedNotification, setSelectedNotification] = useState<NotificationPayload | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out and reset state
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SIDEBAR_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset selection state when closing
      setIsSelectionMode(false);
      setSelectedNotificationIds(new Set());
      setSelectedNotification(null);
      setShowDeleteConfirmModal(false);
    }
  }, [isOpen, slideAnim, fadeAnim]);

  const handleNotificationPress = React.useCallback(
    (notification: NotificationPayload) => {
      if (isSelectionMode) {
        setSelectedNotificationIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(notification.id)) {
            newSet.delete(notification.id);
          } else {
            newSet.add(notification.id);
          }
          return newSet;
        });
      } else {
        setSelectedNotification(notification);
      }
    },
    [isSelectionMode]
  );

  const handleNotificationLongPress = React.useCallback(
    (notificationId: string) => {
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        setSelectedNotificationIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(notificationId);
          return newSet;
        });
      }
    },
    [isSelectionMode]
  );

  const enterSelectionMode = React.useCallback(() => {
    setIsSelectionMode(true);
    setSelectedNotificationIds(new Set());
  }, []);

  const exitSelectionMode = React.useCallback(() => {
    setIsSelectionMode(false);
    setSelectedNotificationIds(new Set());
  }, []);

  const selectAllNotifications = React.useCallback(() => {
    const allIds = notifications?.map((item) => item.id) ?? [];
    setSelectedNotificationIds(new Set(allIds));
  }, [notifications]);

  const deselectAllNotifications = React.useCallback(() => {
    setSelectedNotificationIds(new Set());
  }, []);

  const handleBulkDelete = React.useCallback(() => {
    if (selectedNotificationIds.size > 0) {
      setShowDeleteConfirmModal(true);
    }
  }, [selectedNotificationIds.size]);

  const confirmBulkDelete = React.useCallback(async () => {
    setIsDeletingSelected(true);
    setShowDeleteConfirmModal(false);

    try {
      const results = await Promise.allSettled(Array.from(selectedNotificationIds).map((id) => deleteMessage(id)));
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;

      if (failed === 0) {
        showToast('success', t('notifications.delete_success', { count: succeeded }));
        exitSelectionMode();
      } else if (succeeded > 0) {
        showToast('warning', t('notifications.delete_partial', { succeeded, failed }));
        exitSelectionMode();
      } else {
        showToast('error', t('notifications.delete_error'));
      }
      refetch();
    } finally {
      setIsDeletingSelected(false);
    }
  }, [selectedNotificationIds, showToast, exitSelectionMode, refetch, t]);

  const handleDeleteNotification = React.useCallback(
    async (id: string) => {
      try {
        await deleteMessage(id);
        showToast('success', t('notifications.delete_one_success'));
        refetch();
      } catch {
        showToast('error', t('notifications.delete_one_error'));
      }
    },
    [showToast, refetch, t]
  );

  const handleNavigateToReference = React.useCallback(
    (referenceType: string, referenceId: string) => {
      onClose();
      if (referenceType === 'call') {
        router.push(`/call/${referenceId}`);
      }
    },
    [onClose]
  );

  const renderItem = React.useCallback(
    ({ item }: { item: NovuNotification }) => (
      <NotificationRow
        item={item}
        isSelectionMode={isSelectionMode}
        isSelected={selectedNotificationIds.has(item.id)}
        onPress={handleNotificationPress}
        onLongPress={handleNotificationLongPress}
        onNavigateToReference={handleNavigateToReference}
      />
    ),
    [isSelectionMode, selectedNotificationIds, handleNotificationPress, handleNotificationLongPress, handleNavigateToReference]
  );

  const renderFooter = React.useCallback(() => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2196F3" />
      </View>
    );
  }, [hasMore]);

  const renderEmpty = React.useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text>{t('notifications.empty')}</Text>
      </View>
    ),
    [t]
  );

  if (!isOpen) {
    return null;
  }

  // Additional safety check to prevent rendering overlay without proper config
  if (!userId || !config || !config.NovuApplicationId || !config.NovuBackendApiUrl || !config.NovuSocketUrl) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop for tapping outside to close */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Sidebar container */}
      <Animated.View style={[styles.sidebarContainer, themed.sidebarContainer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
          {selectedNotification ? (
            <NotificationDetail notification={selectedNotification} onClose={() => setSelectedNotification(null)} onDelete={handleDeleteNotification} onNavigateToReference={handleNavigateToReference} />
          ) : (
            <>
              <View style={styles.header}>
                {isSelectionMode ? (
                  <>
                    <View style={styles.selectionHeader}>
                      <Text style={[styles.selectionCount, themed.selectionCount]}>{t('notifications.selected_count', { count: selectedNotificationIds.size })}</Text>
                      <View style={styles.selectionActions}>
                        <Button onPress={selectedNotificationIds.size === notifications?.length ? deselectAllNotifications : selectAllNotifications} variant="outline" className="mr-2">
                          <Text>{selectedNotificationIds.size === notifications?.length ? t('notifications.deselect_all') : t('notifications.select_all')}</Text>
                        </Button>
                        <Button onPress={handleBulkDelete} variant="outline" className="mr-2" disabled={selectedNotificationIds.size === 0 || isDeletingSelected}>
                          {isDeletingSelected ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={16} className="text-red-500" strokeWidth={2} />}
                        </Button>
                        <Button onPress={exitSelectionMode} variant="outline">
                          <Text>{t('common.cancel')}</Text>
                        </Button>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
                    <View style={styles.headerActions}>
                      <Pressable onPress={enterSelectionMode} style={styles.actionButton}>
                        <MoreVertical size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
                      </Pressable>
                      <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>

              {isLoading && !notifications ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : !userId || !config ? (
                <View style={styles.loadingContainer}>
                  <Text>{t('notifications.load_error')}</Text>
                </View>
              ) : (
                <FlatList
                  testID="notifications-list"
                  data={notifications}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id}
                  onEndReached={fetchMore}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={renderFooter}
                  ListEmptyComponent={renderEmpty}
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={['#2196F3']} />}
                />
              )}
            </>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirmModal} onClose={() => setShowDeleteConfirmModal(false)}>
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Text className="text-lg font-semibold">{t('notifications.confirm_delete_title')}</Text>
          </ModalHeader>
          <ModalBody>
            <Text>{t('notifications.confirm_delete_message', { count: selectedNotificationIds.size })}</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onPress={() => setShowDeleteConfirmModal(false)} className="mr-2">
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button variant="solid" onPress={confirmBulkDelete} className="bg-red-500">
              <Text className="text-white">{t('common.delete')}</Text>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  backdropPressable: {
    width: '100%',
    height: '100%',
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT + 16 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
  },
  closeButton: {
    padding: 8,
  },
  selectionHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 4,
    height: '100%',
  },
  selectionIndicator: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationBody: {
    fontSize: 16,
    marginBottom: 4,
  },
  unreadNotificationText: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
});

// Theme-dependent colors, built at render time so manual in-app theme overrides apply
const createThemedStyles = (isDark: boolean) =>
  StyleSheet.create({
    sidebarContainer: {
      backgroundColor: isDark ? '#171717' : '#fff',
      shadowColor: isDark ? '#262626' : '#e5e5e5',
    },
    selectionCount: {
      color: isDark ? '#ffffff' : '#000000',
    },
    notificationItem: {
      borderBottomColor: isDark ? '#333333' : '#eee',
    },
    unreadNotificationItem: {
      backgroundColor: isDark ? '#262626' : '#f0f7ff',
    },
    selectedNotificationItem: {
      backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
    },
    unreadIndicator: {
      backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
    },
    notificationBody: {
      color: isDark ? '#e5e5e5' : '#333333',
    },
    unreadNotificationText: {
      color: isDark ? '#ffffff' : '#000000',
    },
    timestamp: {
      color: isDark ? '#a3a3a3' : '#666',
    },
  });
