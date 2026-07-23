import { CheckCircle2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { getObjectiveTypeName } from '@/lib/incident-command-utils';
import { type TacticalObjective, TacticalObjectiveOutcome, TacticalObjectiveStatus } from '@/models/v4/incidentCommand/incidentCommandModels';

/** Progress quick-set values offered while the objective is open. */
const PROGRESS_STEPS = [0, 25, 50, 75];

/** Selectable close-out outcomes (NotSet is not offered — closing out requires a verdict). */
const OUTCOME_OPTIONS = [TacticalObjectiveOutcome.Successful, TacticalObjectiveOutcome.Partial, TacticalObjectiveOutcome.Unsuccessful] as const;

export const getObjectiveOutcomeKey = (outcome: number): string => {
  switch (outcome) {
    case TacticalObjectiveOutcome.Successful:
      return 'command.objective_outcome_successful';
    case TacticalObjectiveOutcome.Partial:
      return 'command.objective_outcome_partial';
    case TacticalObjectiveOutcome.Unsuccessful:
      return 'command.objective_outcome_unsuccessful';
    default:
      return 'command.objective_completed';
  }
};

export const getObjectiveOutcomeBadgeAction = (outcome: number): 'success' | 'warning' | 'error' | 'muted' => {
  switch (outcome) {
    case TacticalObjectiveOutcome.Successful:
      return 'success';
    case TacticalObjectiveOutcome.Partial:
      return 'warning';
    case TacticalObjectiveOutcome.Unsuccessful:
      return 'error';
    default:
      return 'muted';
  }
};

interface ObjectiveDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  objective: TacticalObjective | null;
  /** Close out the objective with how it turned out and an optional note. */
  onComplete: (tacticalObjectiveId: string, outcome: number, note: string | null) => void;
  /** Set the objective's progress (0-100); omit to hide the progress quick-set row. */
  onUpdateProgress?: (tacticalObjectiveId: string, progressPercent: number) => void;
  /** Resolve a user id to a display name for the completed-by line. */
  resolveUserName?: (userId: string) => string;
}

/**
 * Interact with one tactical objective: adjust progress, then close it out with an outcome verdict
 * (Successful / Partial / Unsuccessful) and an optional note — completion is confirmed before it
 * lands, and the outcome, author, and note are written to the incident log by the server.
 */
export const ObjectiveDetailsSheet: React.FC<ObjectiveDetailsSheetProps> = ({ isOpen, onClose, objective, onComplete, onUpdateProgress, resolveUserName }) => {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<number>(TacticalObjectiveOutcome.Successful);
  const [note, setNote] = useState('');
  const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOutcome(TacticalObjectiveOutcome.Successful);
      setNote('');
      setIsCompleteConfirmOpen(false);
    }
  }, [isOpen]);

  const handleComplete = useCallback(() => {
    if (!objective) {
      return;
    }
    setIsCompleteConfirmOpen(false);
    onComplete(objective.TacticalObjectiveId, outcome, note.trim() || null);
    onClose();
  }, [objective, outcome, note, onComplete, onClose]);

  if (!objective) {
    return null;
  }

  const isComplete = objective.Status === TacticalObjectiveStatus.Complete;
  const progress = isComplete ? 100 : (objective.ProgressPercent ?? 0);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[70]} testID="objective-details-sheet">
      <VStack space="md" className="w-full">
        <HStack className="items-center justify-between">
          <Heading size="md" className="min-w-0 flex-1 pr-2">
            {objective.Name}
          </Heading>
          {isComplete ? (
            <Badge action={getObjectiveOutcomeBadgeAction(objective.Outcome ?? 0)} variant="solid" size="sm" testID="objective-details-outcome">
              <BadgeText className="text-white">{t(getObjectiveOutcomeKey(objective.Outcome ?? 0))}</BadgeText>
            </Badge>
          ) : (
            <Badge action="info" variant="outline" size="sm">
              <BadgeText>{`${progress}%`}</BadgeText>
            </Badge>
          )}
        </HStack>
        <Text className="text-xs uppercase text-gray-500 dark:text-gray-400">{getObjectiveTypeName(t, objective.ObjectiveType)}</Text>
        {objective.Description ? <Text className="text-sm text-gray-600 dark:text-gray-300">{objective.Description}</Text> : null}

        {isComplete ? (
          <VStack space="xs" testID="objective-completed-info">
            {objective.CompletedByUserId || objective.CompletedOn ? (
              <Text className="text-sm text-gray-600 dark:text-gray-300">
                {t('command.objective_completed_by', {
                  name: objective.CompletedByUserId ? (resolveUserName?.(objective.CompletedByUserId) ?? objective.CompletedByUserId) : '—',
                  when: objective.CompletedOn ? new Date(objective.CompletedOn).toLocaleString() : '—',
                })}
              </Text>
            ) : null}
            {objective.CompletionNote ? <Text className="text-sm text-gray-800 dark:text-gray-200">{objective.CompletionNote}</Text> : null}
          </VStack>
        ) : (
          <>
            {onUpdateProgress ? (
              <VStack space="xs">
                <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.objective_progress_label')}</Text>
                <HStack space="sm" className="flex-wrap">
                  {PROGRESS_STEPS.map((step) => (
                    <Button
                      key={step}
                      size="xs"
                      variant={progress === step ? 'solid' : 'outline'}
                      className="mb-1"
                      onPress={() => onUpdateProgress(objective.TacticalObjectiveId, step)}
                      testID={`objective-sheet-progress-${step}`}
                    >
                      <ButtonText>{`${step}%`}</ButtonText>
                    </Button>
                  ))}
                </HStack>
              </VStack>
            ) : null}

            <VStack space="xs">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.objective_outcome_label')}</Text>
              <HStack space="sm" className="flex-wrap">
                {OUTCOME_OPTIONS.map((option) => (
                  <Button key={option} size="xs" variant={outcome === option ? 'solid' : 'outline'} className="mb-1" onPress={() => setOutcome(option)} testID={`objective-outcome-${option}`}>
                    <ButtonText>{t(getObjectiveOutcomeKey(option))}</ButtonText>
                  </Button>
                ))}
              </HStack>
            </VStack>

            <VStack space="xs">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.objective_note_label')}</Text>
              <Textarea size="md" className="h-16">
                <TextareaInput placeholder={t('command.objective_note_placeholder')} value={note} onChangeText={setNote} testID="objective-note-input" multiline />
              </Textarea>
            </VStack>

            <Button size="lg" onPress={() => setIsCompleteConfirmOpen(true)} testID="objective-complete-button">
              <ButtonIcon as={CheckCircle2} />
              <ButtonText>{t('command.objective_complete_button')}</ButtonText>
            </Button>
          </>
        )}
      </VStack>

      {/* Closing out an objective is deliberate — confirm the verdict before it lands on the log */}
      <AlertDialog isOpen={isCompleteConfirmOpen} onClose={() => setIsCompleteConfirmOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="objective-complete-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('command.objective_complete_confirm_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">{t('command.objective_complete_confirm_message', { outcome: t(getObjectiveOutcomeKey(outcome)) })}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setIsCompleteConfirmOpen(false)} testID="objective-complete-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button onPress={handleComplete} testID="objective-complete-confirm">
              <ButtonText>{t('command.objective_complete_button')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CustomBottomSheet>
  );
};
