import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';

interface MessageCommanderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolved display name of the current incident commander. */
  commanderName?: string | null;
  /** Whether any Deputy Incident Commanders are assigned — gates the include-deputies toggle. */
  hasDeputies: boolean;
  /** Returns whether the send succeeded; the sheet closes on success. */
  onSend: (title: string | null, body: string, includeDeputies: boolean) => Promise<boolean>;
}

/** Send a free-form message directly to the incident commander (and optionally deputies). */
export const MessageCommanderSheet: React.FC<MessageCommanderSheetProps> = ({ isOpen, onClose, commanderName, hasDeputies, onSend }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [includeDeputies, setIncludeDeputies] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const reset = useCallback(() => {
    setTitle('');
    setBody('');
    setIncludeDeputies(false);
    setIsSending(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSend = useCallback(async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody || isSending) {
      return;
    }
    setIsSending(true);
    const ok = await onSend(title.trim() || null, trimmedBody, includeDeputies);
    setIsSending(false);
    if (ok) {
      handleClose();
    }
  }, [body, title, includeDeputies, isSending, onSend, handleClose]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={handleClose} snapPoints={[75]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.message_commander')}</Heading>
        <Text className="text-sm text-gray-500 dark:text-gray-400">{commanderName ? t('command.message_commander_hint_named', { name: commanderName }) : t('command.message_commander_hint')}</Text>

        <Input size="md" variant="outline">
          <InputField placeholder={t('command.message_subject_placeholder')} value={title} onChangeText={setTitle} testID="message-commander-subject" />
        </Input>

        <Textarea size="md">
          <TextareaInput placeholder={t('command.message_body_placeholder')} value={body} onChangeText={setBody} multiline numberOfLines={5} testID="message-commander-body" />
        </Textarea>

        {hasDeputies ? (
          <HStack space="sm" className="items-center justify-between">
            <Text className="flex-1 text-sm text-gray-700 dark:text-gray-300">{t('command.include_deputies')}</Text>
            <Switch value={includeDeputies} onValueChange={setIncludeDeputies} testID="message-commander-deputies" />
          </HStack>
        ) : null}

        <Button size="lg" onPress={handleSend} isDisabled={!body.trim() || isSending} testID="message-commander-send">
          <ButtonText>{isSending ? t('common.submitting') : t('command.send_message')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};
