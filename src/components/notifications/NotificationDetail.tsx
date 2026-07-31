import { useNotifications } from '@novu/react-native';
import { ArrowLeft, Calendar, ExternalLink, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { type NotificationPayload } from '@/types/notification';

interface NotificationDetailProps {
  notification: NotificationPayload;
  onClose: () => void;
  onDelete: (id: string) => void;
  onNavigateToReference: (referenceType: string, referenceId: string) => void;
}

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.85, 400);
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

export const NotificationDetail = ({ notification, onClose, onDelete, onNavigateToReference }: NotificationDetailProps) => {
  const { t } = useTranslation();
  const { refetch } = useNotifications();
  const { colorScheme } = useColorScheme();
  const themed = useMemo(() => createThemedStyles(colorScheme === 'dark'), [colorScheme]);
  const referenceIconColor = colorScheme === 'dark' ? '#3b82f6' : '#2563eb';
  const slideAnim = React.useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const markedAsReadRef = React.useRef<string | null>(null);

  useEffect(() => {
    // Mark as read when opened - refetch once per notification to sync with server.
    // Guarded by a ref so an unstable `refetch` reference cannot cause a refetch loop.
    if (!notification.read && notification.id && markedAsReadRef.current !== notification.id) {
      markedAsReadRef.current = notification.id;
      refetch();
    }
  }, [notification.id, notification.read, refetch]);

  useEffect(() => {
    // Animate in (slideAnim/fadeAnim are stable refs)
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
  }, [slideAnim, fadeAnim]);

  const handleClose = () => {
    // Animate out
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
    ]).start(() => {
      onClose();
    });
  };

  const handleDelete = () => {
    onDelete(notification.id);
    handleClose();
  };

  const handleNavigateToReference = () => {
    if (notification.referenceType && notification.referenceId) {
      onNavigateToReference(notification.referenceType, notification.referenceId);
      handleClose();
    }
  };

  // Format the date for display
  const formattedDate = new Date(notification.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(notification.createdAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[styles.sidebarContainer, themed.sidebarContainer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.header, themed.header]}>
            <Pressable onPress={handleClose} style={styles.backButton}>
              <ArrowLeft size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
            </Pressable>
            <Text style={[styles.headerTitle, themed.headerTitle]}>{t('notifications.notification')}</Text>
            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <Trash2 size={24} className="text-red-500 dark:text-red-400" strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={styles.metadataContainer}>
              <View style={styles.dateContainer}>
                <Calendar size={16} className="text-gray-500 dark:text-gray-400" strokeWidth={2} />
                <Text style={[styles.dateText, themed.dateText]}>{formattedDate}</Text>
              </View>
              <Text style={[styles.timeText, themed.timeText]}>{formattedTime}</Text>
            </View>

            {notification.type ? (
              <View style={[styles.typeTag, themed[getTypeTagStyleKey(notification.type)]]}>
                <Text style={styles.typeTagText}>{notification.type}</Text>
              </View>
            ) : null}

            {notification.title ? <Text style={[styles.title, themed.title]}>{notification.title}</Text> : null}

            <View style={[styles.bodyContainer, themed.bodyContainer]}>
              <Text style={[styles.body, themed.body]}>{notification.body}</Text>
            </View>

            {notification.metadata && Object.keys(notification.metadata).length > 0 ? (
              <View style={[styles.metadataDetailsContainer, themed.metadataDetailsContainer]}>
                <Text style={[styles.metadataTitle, themed.metadataTitle]}>{t('notifications.additional_info')}</Text>
                {Object.entries(notification.metadata).map(([key, value]) => (
                  <View key={key} style={styles.metadataItem}>
                    <Text style={[styles.metadataKey, themed.metadataKey]}>{formatKey(key)}:</Text>
                    <Text style={[styles.metadataValue, themed.metadataValue]}>{formatValue(value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {notification.referenceType && notification.referenceId ? (
              <Pressable onPress={handleNavigateToReference} style={[styles.referenceButton, themed.referenceButton]}>
                <ExternalLink size={18} color={referenceIconColor} style={styles.referenceButtonIcon} />
                <Text style={[styles.buttonText, themed.buttonText]}>{t('notifications.view_reference', { type: notification.referenceType })}</Text>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

// Helper function to format metadata keys for display
const formatKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1') // Insert a space before all capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize the first letter
    .trim();
};

// Helper function to format metadata values for display
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Helper function to get the themed tag style key based on notification type
type TypeTagStyleKey = 'typeTagDefault' | 'typeTagInfo' | 'typeTagSuccess' | 'typeTagWarning' | 'typeTagAlert';

const getTypeTagStyleKey = (type: string): TypeTagStyleKey => {
  const lowerType = type.toLowerCase();

  if (lowerType.includes('alert') || lowerType.includes('emergency')) {
    return 'typeTagAlert';
  } else if (lowerType.includes('warning')) {
    return 'typeTagWarning';
  } else if (lowerType.includes('info')) {
    return 'typeTagInfo';
  } else if (lowerType.includes('success')) {
    return 'typeTagSuccess';
  } else {
    return 'typeTagDefault';
  }
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
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
    zIndex: 10000,
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    marginLeft: 6,
  },
  timeText: {
    fontSize: 14,
  },
  typeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 16,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bodyContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  metadataDetailsContainer: {
    marginTop: 10,
    padding: 16,
    borderRadius: 8,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  metadataItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metadataKey: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  metadataValue: {
    fontSize: 14,
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  referenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  referenceButtonIcon: {
    marginRight: 8,
  },
});

// Theme-dependent colors, built at render time so manual in-app theme overrides apply
const createThemedStyles = (isDark: boolean) =>
  StyleSheet.create({
    sidebarContainer: {
      backgroundColor: isDark ? '#171717' : '#fff',
      shadowColor: isDark ? '#262626' : '#e5e5e5',
    },
    header: {
      borderBottomColor: isDark ? '#333333' : '#e5e5e5',
    },
    headerTitle: {
      color: isDark ? '#f3f4f6' : '#111827',
    },
    dateText: {
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    timeText: {
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    typeTagDefault: {
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
    },
    typeTagInfo: {
      backgroundColor: isDark ? '#1e40af' : '#dbeafe',
    },
    typeTagSuccess: {
      backgroundColor: isDark ? '#065f46' : '#d1fae5',
    },
    typeTagWarning: {
      backgroundColor: isDark ? '#92400e' : '#fef3c7',
    },
    typeTagAlert: {
      backgroundColor: isDark ? '#991b1b' : '#fee2e2',
    },
    title: {
      color: isDark ? '#f3f4f6' : '#111827',
    },
    bodyContainer: {
      backgroundColor: isDark ? '#262626' : '#f9fafb',
    },
    body: {
      color: isDark ? '#e5e5e5' : '#374151',
    },
    metadataDetailsContainer: {
      backgroundColor: isDark ? '#262626' : '#f9fafb',
    },
    metadataTitle: {
      color: isDark ? '#f3f4f6' : '#111827',
    },
    metadataKey: {
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    metadataValue: {
      color: isDark ? '#e5e5e5' : '#111827',
    },
    buttonText: {
      color: isDark ? '#3b82f6' : '#2563eb',
    },
    referenceButton: {
      backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
      borderColor: isDark ? '#3b82f6' : '#60a5fa',
    },
  });
