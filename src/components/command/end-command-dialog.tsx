import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { CALL_CLOSE_TYPES, DEFAULT_CALL_CLOSE_TYPE } from '@/lib/call-close';
import { type EndCommandCloseCall } from '@/stores/command/store';

interface EndCommandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Only members who may close calls (CanCreateCalls) are offered "also close the call". */
  canCloseCall: boolean;
  /** Confirmed: the call close to run after the command closes, or null to end only the command. */
  onConfirm: (closeCall: EndCommandCloseCall | null) => void;
}

interface CloseTypeOptionProps {
  value: number;
  label: string;
  isSelected: boolean;
  onSelect: (value: number) => void;
}

const CloseTypeOption: React.FC<CloseTypeOptionProps> = React.memo(({ value, label, isSelected, onSelect }) => {
  const handlePress = useCallback(() => onSelect(value), [onSelect, value]);

  return (
    <Button size="xs" variant={isSelected ? 'solid' : 'outline'} className="mb-1" onPress={handlePress} accessibilityState={{ selected: isSelected }} testID={`end-command-close-type-${value}`}>
      <ButtonText>{label}</ButtonText>
    </Button>
  );
});

CloseTypeOption.displayName = 'CloseTypeOption';

/**
 * End-command confirmation. Ending closes the command server-side and drops the local board; a member who
 * can close calls may also close the call in the same step (close type, note, and whether to notify
 * everyone on the call), which runs only after the command close went through.
 */
export const EndCommandDialog: React.FC<EndCommandDialogProps> = ({ isOpen, onClose, canCloseCall, onConfirm }) => {
  const { t } = useTranslation();
  const [alsoCloseCall, setAlsoCloseCall] = useState(false);
  const [closeType, setCloseType] = useState<number>(DEFAULT_CALL_CLOSE_TYPE);
  const [notes, setNotes] = useState('');
  const [sendNotification, setSendNotification] = useState(true);

  // Every opening starts from the defaults: command only, Closed, no note, notify on.
  useEffect(() => {
    if (isOpen) {
      setAlsoCloseCall(false);
      setCloseType(DEFAULT_CALL_CLOSE_TYPE);
      setNotes('');
      setSendNotification(true);
    }
  }, [isOpen]);

  const closesCall = canCloseCall && alsoCloseCall;

  const handleConfirm = useCallback(() => {
    onConfirm(closesCall ? { type: closeType, notes: notes.trim(), sendNotification } : null);
  }, [onConfirm, closesCall, closeType, notes, sendNotification]);

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} avoidKeyboard>
      <AlertDialogBackdrop />
      <AlertDialogContent testID="end-command-dialog">
        <AlertDialogHeader>
          <Heading size="md">{t('command.end_command_confirm_title')}</Heading>
        </AlertDialogHeader>
        <AlertDialogBody>
          <VStack space="md" className="pb-2">
            <Text className="text-gray-700 dark:text-gray-300">{t('command.end_command_confirm_message')}</Text>

            {canCloseCall ? (
              <HStack space="sm" className="items-center justify-between">
                <VStack className="flex-1">
                  <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('command.end_command_close_call')}</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{t('command.end_command_close_call_hint')}</Text>
                </VStack>
                <Switch value={alsoCloseCall} onValueChange={setAlsoCloseCall} accessibilityLabel={t('command.end_command_close_call')} testID="end-command-close-call-switch" />
              </HStack>
            ) : null}

            {closesCall ? (
              <VStack space="md" testID="end-command-close-call-options">
                <VStack space="xs">
                  <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('call_detail.close_call_type')}</Text>
                  <HStack space="xs" className="flex-wrap">
                    {CALL_CLOSE_TYPES.map((option) => (
                      <CloseTypeOption key={option.value} value={option.value} label={t(option.labelKey)} isSelected={closeType === option.value} onSelect={setCloseType} />
                    ))}
                  </HStack>
                </VStack>

                <VStack space="xs">
                  <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('call_detail.close_call_note')}</Text>
                  <Textarea size="md" className="h-16">
                    <TextareaInput placeholder={t('call_detail.close_call_note_placeholder')} value={notes} onChangeText={setNotes} multiline testID="end-command-close-call-note" />
                  </Textarea>
                </VStack>

                <HStack space="sm" className="items-center justify-between">
                  <VStack className="flex-1">
                    <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('call_detail.close_call_notify')}</Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{t('call_detail.close_call_notify_hint')}</Text>
                  </VStack>
                  <Switch value={sendNotification} onValueChange={setSendNotification} accessibilityLabel={t('call_detail.close_call_notify')} testID="end-command-notify-switch" />
                </HStack>
              </VStack>
            ) : null}
          </VStack>
        </AlertDialogBody>
        <AlertDialogFooter>
          <Button variant="outline" onPress={onClose} testID="end-command-cancel">
            <ButtonText>{t('common.cancel')}</ButtonText>
          </Button>
          <Button action="negative" onPress={handleConfirm} testID="end-command-confirm">
            <ButtonText>{closesCall ? t('command.end_command_and_close_call') : t('command.end_command')}</ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
