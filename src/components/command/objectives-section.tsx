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

import { getObjectiveOutcomeBadgeAction, getObjectiveOutcomeKey, ObjectiveDetailsSheet } from './objective-details-sheet';

/** Quick-set progress values offered per incomplete objective. */
const PROGRESS_STEPS = [25, 50, 75];

interface ObjectivesSectionProps {
  objectives: TacticalObjective[];
  onAdd: (name: string, objectiveType: TacticalObjectiveType) => void;
  /** Close out an objective with how it turned out (TacticalObjectiveOutcome) and an optional note. */
  onComplete: (tacticalObjectiveId: string, outcome?: number, note?: string | null) => void;
  /** Set an objective's progress (0-100); omit to hide the progress quick-set row. */
  onUpdateProgress?: (tacticalObjectiveId: string, progressPercent: number) => void;
  /** Resolve a user id to a display name for the completed-by line in the details sheet. */
  resolveUserName?: (userId: string) => string;
}

/** Tactical objectives / benchmarks with completion + progress tracking. Tap an objective to open its details sheet. */
export const ObjectivesSection: React.FC<ObjectivesSectionProps> = ({ objectives, onAdd, onComplete, onUpdateProgress, resolveUserName }) => {
  const { t } = useTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [objectiveType, setObjectiveType] = useState<TacticalObjectiveType>(TacticalObjectiveType.General);
  const [detailsObjectiveId, setDetailsObjectiveId] = useState<string | null>(null);

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
            const progress = isComplete ? 100 : (objective.ProgressPercent ?? 0);
            return (
              <VStack key={objective.TacticalObjectiveId} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`objective-${objective.TacticalObjectiveId}`}>
                <HStack className="items-center justify-between">
                  {/* Tapping the row opens the details sheet — completion (with outcome + note) happens there */}
                  <Pressable onPress={() => setDetailsObjectiveId(objective.TacticalObjectiveId)} className="flex-1" testID={`objective-complete-${objective.TacticalObjectiveId}`}>
                    <HStack space="sm" className="items-center">
                      <Icon as={isComplete ? CheckCircle2 : Circle} size="sm" className={isComplete ? 'text-green-500' : 'text-gray-400'} />
                      <VStack className="flex-1">
                        <Text className={`text-base ${isComplete ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{objective.Name}</Text>
                        <Text className="text-xs uppercase text-gray-500 dark:text-gray-400">
                          {getObjectiveTypeName(t, objective.ObjectiveType)}
                          {!isComplete && progress > 0 ? ` • ${progress}%` : ''}
                        </Text>
                      </VStack>
                      {objective.TacticalObjectiveId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                    </HStack>
                  </Pressable>
                  {isComplete ? (
                    <Badge action={getObjectiveOutcomeBadgeAction(objective.Outcome ?? 0)} variant="solid" size="sm" testID={`objective-outcome-badge-${objective.TacticalObjectiveId}`}>
                      <BadgeText className="text-white">{(objective.Outcome ?? 0) !== 0 ? t(getObjectiveOutcomeKey(objective.Outcome ?? 0)) : t('command.objective_completed')}</BadgeText>
                    </Badge>
                  ) : null}
                </HStack>
                {!isComplete && onUpdateProgress ? (
                  <HStack space="sm" className="mt-1 pl-7">
                    {PROGRESS_STEPS.map((step) => (
                      <Button
                        key={step}
                        size="xs"
                        variant={progress === step ? 'solid' : 'outline'}
                        onPress={() => onUpdateProgress(objective.TacticalObjectiveId, step)}
                        testID={`objective-progress-${objective.TacticalObjectiveId}-${step}`}
                      >
                        <ButtonText>{`${step}%`}</ButtonText>
                      </Button>
                    ))}
                  </HStack>
                ) : null}
              </VStack>
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

      <ObjectiveDetailsSheet
        isOpen={detailsObjectiveId !== null}
        onClose={() => setDetailsObjectiveId(null)}
        objective={objectives.find((o) => o.TacticalObjectiveId === detailsObjectiveId) ?? null}
        onComplete={(tacticalObjectiveId, outcome, note) => onComplete(tacticalObjectiveId, outcome, note)}
        onUpdateProgress={onUpdateProgress}
        resolveUserName={resolveUserName}
      />
    </Box>
  );
};
