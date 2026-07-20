import { ClipboardList, LayoutTemplate } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { type CommandResultData, getAllCommands } from '@/api/incidentCommand/commands';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';

interface StartCommandSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Start the board — optionally from a department command template (null = blank board). */
  onStart: (commandDefinitionId: number | null) => void;
}

/**
 * Template picker shown when starting a command. Departments define templates per
 * operation type — an ICS structure for a fire, or an event template with lanes
 * like Medical Booth / Patrols / Customer Service for a concert or fair.
 */
export const StartCommandSheet: React.FC<StartCommandSheetProps> = ({ isOpen, onClose, onStart }) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<CommandResultData[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || isLoaded) {
      return;
    }
    getAllCommands()
      .then((result) => {
        setTemplates(Array.isArray(result.Data) ? result.Data : []);
        setIsLoaded(true);
      })
      .catch((error) => {
        // Offline or endpoint unavailable — blank board stays available
        logger.warn({ message: 'Failed to load command templates', context: { error } });
        setIsLoaded(true);
      });
  }, [isOpen, isLoaded]);

  const handleStart = (commandDefinitionId: number | null) => {
    onClose();
    onStart(commandDefinitionId);
  };

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[70]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.start_command_title')}</Heading>
        <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.start_command_description')}</Text>

        <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
          <VStack space="sm">
            <Pressable className="rounded-lg bg-gray-100 px-3 py-3 dark:bg-gray-800" onPress={() => handleStart(null)} testID="template-blank">
              <HStack space="sm" className="items-center">
                <Icon as={ClipboardList} size="md" className="text-primary-500" />
                <VStack className="flex-1">
                  <Text className="text-base font-medium text-gray-900 dark:text-white">{t('command.template_blank')}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.template_blank_description')}</Text>
                </VStack>
              </HStack>
            </Pressable>

            {templates.map((template) => (
              <Pressable
                key={template.CommandDefinitionId}
                className="rounded-lg bg-gray-100 px-3 py-3 dark:bg-gray-800"
                onPress={() => handleStart(template.CommandDefinitionId)}
                testID={`template-${template.CommandDefinitionId}`}
              >
                <HStack space="sm" className="items-center">
                  <Icon as={LayoutTemplate} size="md" className="text-primary-500" />
                  <VStack className="flex-1">
                    <Text className="text-base font-medium text-gray-900 dark:text-white">{template.Name}</Text>
                    {template.Description ? <Text className="text-sm text-gray-500 dark:text-gray-400">{template.Description}</Text> : null}
                    <Text className="text-xs text-gray-400 dark:text-gray-500">{t('command.template_lane_count', { count: template.Lanes?.length ?? 0 })}</Text>
                    {(template.Lanes ?? []).some((lane) => lane.Color) ? (
                      <HStack space="xs" className="mt-1 items-center">
                        {(template.Lanes ?? [])
                          .filter((lane) => lane.Color)
                          .slice(0, 8)
                          .map((lane) => (
                            <View
                              key={lane.CommandDefinitionRoleId}
                              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: lane.Color ?? undefined }}
                              testID={`template-lane-color-${lane.CommandDefinitionRoleId}`}
                            />
                          ))}
                      </HStack>
                    ) : null}
                  </VStack>
                </HStack>
              </Pressable>
            ))}
          </VStack>
        </ScrollView>
      </VStack>
    </CustomBottomSheet>
  );
};
