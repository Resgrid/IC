import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { type IncidentCommand } from '@/models/v4/incidentCommand/incidentCommandModels';

interface ReopenCommandSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The prior (closed) command found for the call. */
  priorCommand: IncidentCommand | null;
  /** Reopen the prior command with the supplied reason. */
  onReopen: (reason: string) => void;
  /** Skip reopening and establish a brand-new command instead. */
  onStartNew: () => void;
}

/** Asks whether to reopen a call's previous (ended) command, capturing the reason for the incident log. */
export const ReopenCommandSheet: React.FC<ReopenCommandSheetProps> = ({ isOpen, onClose, priorCommand, onReopen, onStartNew }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const handleReopen = useCallback(() => {
    onReopen(reason.trim());
    onClose();
  }, [reason, onReopen, onClose]);

  const handleStartNew = useCallback(() => {
    onStartNew();
    onClose();
  }, [onStartNew, onClose]);

  const closedOn = priorCommand?.ClosedOn ? new Date(priorCommand.ClosedOn).toLocaleString() : null;

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[55]} testID="reopen-command-sheet">
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.reopen_title')}</Heading>
        <Text className="text-sm text-gray-600 dark:text-gray-300">{closedOn ? t('command.reopen_message_with_time', { closedOn }) : t('command.reopen_message')}</Text>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.reopen_reason_label')}</Text>
          <Textarea size="md" className="h-20">
            <TextareaInput placeholder={t('command.reopen_reason_placeholder')} value={reason} onChangeText={setReason} testID="reopen-reason-input" multiline />
          </Textarea>
        </VStack>

        <Button size="lg" onPress={handleReopen} testID="reopen-confirm">
          <ButtonText>{t('command.reopen_button')}</ButtonText>
        </Button>
        <Button size="lg" variant="outline" onPress={handleStartNew} testID="reopen-start-new">
          <ButtonText>{t('command.reopen_start_new')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};
