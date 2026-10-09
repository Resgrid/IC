import React from 'react';
import { useTranslation } from 'react-i18next';
import { type GestureResponderEvent, Pressable } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { X } from '@/components/ui/lucide-icons';
import { VStack } from '@/components/ui/vstack';

import { type ToastItem, useToastStore } from '../../stores/toast/store';
import { Toast, ToastDescription, ToastTitle } from '../ui/toast';

export const ToastMessage: React.FC<ToastItem> = ({ id, type, title, message, onPress }) => {
  const { t } = useTranslation();
  const removeToast = useToastStore((state) => state.removeToast);

  const handlePress = () => {
    onPress?.();
    removeToast(id);
  };

  const handleDismiss = (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    removeToast(id);
  };

  return (
    // typography-0 flips against the toast backgrounds (dark in light mode, pastel in dark mode); a fixed white vanishes in dark mode.
    <Pressable accessibilityRole={onPress ? 'button' : undefined} className="w-full" onPress={onPress ? handlePress : undefined} testID={`toast-message-${id}`}>
      <Toast className="w-full rounded-lg border" action={type}>
        <HStack className="items-start justify-between gap-3">
          <VStack className="min-w-0 flex-1" space="xs">
            {title ? <ToastTitle className="font-medium">{t(title)}</ToastTitle> : null}
            <ToastDescription className="text-typography-0">{t(message)}</ToastDescription>
          </VStack>
          <Pressable accessibilityLabel={t('common.dismiss')} accessibilityRole="button" className="p-1" hitSlop={8} onPress={handleDismiss} testID={`toast-dismiss-${id}`}>
            <X className="text-typography-0" size={18} />
          </Pressable>
        </HStack>
      </Toast>
    </Pressable>
  );
};
