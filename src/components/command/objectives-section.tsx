import { CheckCircle2, Circle, CloudOff, Plus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getObjectiveTypeName, OBJECTIVE_TYPES } from '@/lib/incident-command-utils';
import { type TacticalObjective, TacticalObjectiveStatus, TacticalObjectiveType } from '@/models/v4/incidentCommand/incidentCommandModels';

interface ObjectivesSectionProps {
  objectives: TacticalObjective[];
  onAdd: (name: string, objectiveType: TacticalObjectiveType) => void;
  onComplete: (tacticalObjectiveId: string) => void;
}

/** Tactical objectives / benchmarks with completion tracking. */
export const ObjectivesSection: React.FC<ObjectivesSectionProps> = ({ objectives, onAdd, onComplete }) => {
  const { t } = useTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [objectiveType, setObjectiveType] = useState<TacticalObjectiveType>(TacticalObjectiveType.General);

  const sorted = [...objectives].sort((a, b) => a.SortOrder - b.SortOrder);
  const completedCount = sorted.filter((o) => o.Status === TacticalObjectiveStatus.Complete).length;

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    onAdd(name.trim(), objectiveType);
    setName('');
    setObjectiveType(TacticalObjectiveType.General);
    setIsSheetOpen(false);
  }, [name, objectiveType, onAdd]);

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-objectives-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.objectives_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            ({completedCount}/{sorted.length})
          </Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={() => setIsSheetOpen(true)} testID="command-objectives-add">
          <ButtonIcon as={Plus} />
          <ButtonText>{t('command.add')}</ButtonText>
        </Button>
      </HStack>

      {sorted.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_objectives')}</Text>
      ) : (
        <VStack space="sm">
          {sorted.map((objective) => {
            const isComplete = objective.Status === TacticalObjectiveStatus.Complete;
            return (
              <HStack key={objective.TacticalObjectiveId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`objective-${objective.TacticalObjectiveId}`}>
                <Pressable onPress={() => (isComplete ? undefined : onComplete(objective.TacticalObjectiveId))} className="flex-1" testID={`objective-complete-${objective.TacticalObjectiveId}`} disabled={isComplete}>
                  <HStack space="sm" className="items-center">
                    <Icon as={isComplete ? CheckCircle2 : Circle} size="sm" className={isComplete ? 'text-green-500' : 'text-gray-400'} />
                    <VStack className="flex-1">
                      <Text className={`text-base ${isComplete ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{objective.Name}</Text>
                      <Text className="text-xs uppercase text-gray-500 dark:text-gray-400">{getObjectiveTypeName(t, objective.ObjectiveType)}</Text>
                    </VStack>
                    {objective.TacticalObjectiveId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                  </HStack>
                </Pressable>
                {isComplete ? (
                  <Badge action="success" variant="solid" size="sm">
                    <BadgeText className="text-white">{t('command.objective_completed')}</BadgeText>
                  </Badge>
                ) : null}
              </HStack>
            );
          })}
        </VStack>
      )}

      <CustomBottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} snapPoints={[55]}>
        <VStack space="md" className="w-full">
          <Heading size="md">{t('command.add_objective')}</Heading>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.objective_type_label')}</Text>
            <HStack className="flex-wrap" space="sm">
              {OBJECTIVE_TYPES.map((type) => (
                <Button key={type} size="xs" variant={objectiveType === type ? 'solid' : 'outline'} className="mb-1" onPress={() => setObjectiveType(type)} testID={`objective-type-${type}`}>
                  <ButtonText>{getObjectiveTypeName(t, type)}</ButtonText>
                </Button>
              ))}
            </HStack>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.objective_name_label')}</Text>
            <Input size="md" variant="outline">
              <InputField placeholder={t('command.objective_name_placeholder')} value={name} onChangeText={setName} testID="objective-name-input" />
            </Input>
          </VStack>

          <Button size="lg" onPress={handleSave} isDisabled={!name.trim()} testID="objective-save">
            <ButtonText>{t('command.add')}</ButtonText>
          </Button>
        </VStack>
      </CustomBottomSheet>
    </Box>
  );
};
