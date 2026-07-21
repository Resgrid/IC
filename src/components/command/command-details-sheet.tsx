import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { type IncidentCommand } from '@/models/v4/incidentCommand/incidentCommandModels';

/** Quick-select offsets (hours from now) for the estimated incident end. */
const ESTIMATED_END_OFFSETS = [1, 2, 4, 8, 12];

interface CommandDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  command: IncidentCommand | null;
  onSave: (estimatedEndOn: string | null, importantInformation: string | null) => void;
}

/** Edit command-level details every resource sees: estimated end time + important information. */
export const CommandDetailsSheet: React.FC<CommandDetailsSheetProps> = ({ isOpen, onClose, command, onSave }) => {
  const { t } = useTranslation();
  const [estimatedEndOn, setEstimatedEndOn] = useState<string | null>(null);
  const [importantInformation, setImportantInformation] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEstimatedEndOn(command?.EstimatedEndOn ?? null);
      setImportantInformation(command?.ImportantInformation ?? '');
    }
  }, [command, isOpen]);

  const handleSave = useCallback(() => {
    onSave(estimatedEndOn, importantInformation.trim() || null);
    onClose();
  }, [estimatedEndOn, importantInformation, onSave, onClose]);

  const setOffset = useCallback((hours: number) => {
    setEstimatedEndOn(new Date(Date.now() + hours * 60 * 60 * 1000).toISOString());
  }, []);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[60]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.command_details')}</Heading>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.estimated_end_label')}</Text>
          <HStack className="flex-wrap" space="sm">
            {ESTIMATED_END_OFFSETS.map((hours) => (
              <Button key={hours} size="xs" variant="outline" className="mb-1" onPress={() => setOffset(hours)} testID={`command-est-end-${hours}`}>
                <ButtonText>{`+${hours}h`}</ButtonText>
              </Button>
            ))}
            <Button size="xs" variant={estimatedEndOn ? 'outline' : 'solid'} className="mb-1" onPress={() => setEstimatedEndOn(null)} testID="command-est-end-clear">
              <ButtonText>{t('command.est_end_none')}</ButtonText>
            </Button>
          </HStack>
          {estimatedEndOn ? <Text className="text-sm text-gray-600 dark:text-gray-300">{new Date(estimatedEndOn).toLocaleString()}</Text> : null}
        </VStack>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.important_information_label')}</Text>
          <Textarea size="md" className="h-24">
            <TextareaInput placeholder={t('command.important_information_placeholder')} value={importantInformation} onChangeText={setImportantInformation} testID="command-important-info-input" multiline />
          </Textarea>
        </VStack>

        <Button size="lg" onPress={handleSave} testID="command-details-save">
          <ButtonText>{t('command.save')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};
