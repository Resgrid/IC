import { CheckCircle2, Minus, Plus, RotateCcw, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { getNeedCategoryName, getNeedStatusBadgeAction, getNeedStatusName } from '@/lib/incident-command-utils';
import { logger } from '@/lib/logging';
import { type IncidentNeed, IncidentNeedStatus, type IncidentNeedUpdate } from '@/models/v4/incidentCommand/incidentCommandModels';

/** i18n keys for the quick-pick reason chips shown above the note box. */
const REASON_KEYS = ['need_reason_mutual_aid', 'need_reason_internal', 'need_reason_called_off', 'need_reason_not_needed', 'need_reason_duplicate'] as const;

interface NeedDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  need: IncidentNeed | null;
  /** Apply a fill/status change with an optional audit note. */
  onUpdate: (incidentNeedId: string, status: IncidentNeedStatus, quantityFulfilled: number | undefined, note: string | null) => void;
  /** Load the need's audit trail (newest first). */
  fetchUpdates: (incidentNeedId: string) => Promise<IncidentNeedUpdate[]>;
}

/** Derives the status a quantified need lands in for a given fill amount. */
const statusForFill = (quantityFulfilled: number, quantityRequested: number): IncidentNeedStatus => {
  if (quantityRequested > 0 && quantityFulfilled >= quantityRequested) return IncidentNeedStatus.Met;
  if (quantityFulfilled > 0) return IncidentNeedStatus.PartiallyMet;
  return IncidentNeedStatus.Open;
};

/**
 * Interact with one command-level need: adjust the fill up OR down (partial fills get their own
 * "Partial Fill" state), attach a note ("Engine 1 from mutual aid"), close the need with confirmation
 * when it is no longer needed, and review the full audit trail (who changed what, when, and why).
 */
export const NeedDetailsSheet: React.FC<NeedDetailsSheetProps> = ({ isOpen, onClose, need, onUpdate, fetchUpdates }) => {
  const { t } = useTranslation();
  const [fill, setFill] = useState(0);
  const [note, setNote] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [updates, setUpdates] = useState<IncidentNeedUpdate[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);

  const needId = need?.IncidentNeedId ?? null;

  useEffect(() => {
    if (isOpen && need) {
      setFill(need.QuantityFulfilled);
      setNote('');
      setIsCloseConfirmOpen(false);
    }
  }, [isOpen, need]);

  useEffect(() => {
    let cancelled = false;
    if (isOpen && needId) {
      setIsLoadingUpdates(true);
      fetchUpdates(needId)
        .then((rows) => {
          if (!cancelled) {
            setUpdates(rows);
          }
        })
        .catch((error) => {
          // The store implementation resolves [] on failure, but the prop contract doesn't
          // guarantee that — never leave a rejection unhandled.
          logger.warn({ message: 'Failed to load need audit trail', context: { incidentNeedId: needId, error } });
          if (!cancelled) {
            setUpdates([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingUpdates(false);
          }
        });
    } else {
      setUpdates([]);
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, needId, fetchUpdates]);

  const quantified = (need?.QuantityRequested ?? 0) > 0;
  const isFilled = need?.Status === IncidentNeedStatus.Met;
  const fillChanged = need !== null && fill !== need.QuantityFulfilled;

  const handleSaveFill = useCallback(() => {
    if (!need) {
      return;
    }
    onUpdate(need.IncidentNeedId, statusForFill(fill, need.QuantityRequested), fill, note.trim() || null);
    onClose();
  }, [need, fill, note, onUpdate, onClose]);

  const handleMarkFilled = useCallback(() => {
    if (!need) {
      return;
    }
    onUpdate(need.IncidentNeedId, IncidentNeedStatus.Met, undefined, note.trim() || null);
    onClose();
  }, [need, note, onUpdate, onClose]);

  const handleReopen = useCallback(() => {
    if (!need) {
      return;
    }
    onUpdate(need.IncidentNeedId, IncidentNeedStatus.Open, undefined, note.trim() || null);
    onClose();
  }, [need, note, onUpdate, onClose]);

  const handleCloseNeed = useCallback(() => {
    if (!need) {
      return;
    }
    setIsCloseConfirmOpen(false);
    onUpdate(need.IncidentNeedId, IncidentNeedStatus.Cancelled, undefined, note.trim() || null);
    onClose();
  }, [need, note, onUpdate, onClose]);

  const changeSummary = useCallback(
    (row: IncidentNeedUpdate) => {
      if (row.PreviousQuantityFulfilled !== row.NewQuantityFulfilled) {
        const requested = need?.QuantityRequested ?? 0;
        return t('command.need_audit_fill_change', { from: row.PreviousQuantityFulfilled, to: row.NewQuantityFulfilled, of: requested > 0 ? ` / ${requested}` : '' });
      }
      return t('command.need_audit_status_change', { status: getNeedStatusName(t, row.NewStatus) });
    },
    [need, t]
  );

  if (!need) {
    return null;
  }

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[80]} testID="need-details-sheet">
      <VStack space="md" className="w-full">
        <HStack className="items-center justify-between">
          <Heading size="md" className="min-w-0 flex-1 pr-2">
            {need.Name}
          </Heading>
          <Badge action={getNeedStatusBadgeAction(need.Status)} variant="solid" size="sm" testID="need-details-status">
            <BadgeText className="text-white">{getNeedStatusName(t, need.Status)}</BadgeText>
          </Badge>
        </HStack>
        <Text className="text-xs uppercase text-gray-500 dark:text-gray-400">
          {getNeedCategoryName(t, need.Category)}
          {quantified ? ` • ${need.QuantityFulfilled}/${need.QuantityRequested}` : ''}
        </Text>
        {need.Description ? <Text className="text-sm text-gray-600 dark:text-gray-300">{need.Description}</Text> : null}

        {quantified ? (
          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_fill_label')}</Text>
            <HStack space="sm" className="items-center">
              {/* Fill can go DOWN too — a filling resource may get called off to another incident. */}
              <Button size="sm" variant="outline" onPress={() => setFill((value) => Math.max(0, value - 1))} isDisabled={fill <= 0} testID="need-fill-decrease">
                <ButtonIcon as={Minus} />
              </Button>
              <Input size="md" className="w-16">
                <InputField
                  keyboardType="number-pad"
                  value={String(fill)}
                  onChangeText={(value) => {
                    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
                    setFill(Number.isNaN(parsed) ? 0 : Math.min(parsed, need.QuantityRequested));
                  }}
                  testID="need-fill-input"
                />
              </Input>
              <Button size="sm" variant="outline" onPress={() => setFill((value) => Math.min(need.QuantityRequested, value + 1))} isDisabled={fill >= need.QuantityRequested} testID="need-fill-increase">
                <ButtonIcon as={Plus} />
              </Button>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.need_fill_of', { requested: need.QuantityRequested })}</Text>
            </HStack>
          </VStack>
        ) : null}

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_note_label')}</Text>
          <HStack className="flex-wrap" space="sm">
            {REASON_KEYS.map((key) => (
              <Button key={key} size="xs" variant="outline" className="mb-1" onPress={() => setNote(t(`command.${key}`))} testID={`need-reason-${key}`}>
                <ButtonText>{t(`command.${key}`)}</ButtonText>
              </Button>
            ))}
          </HStack>
          <Textarea size="md" className="h-16">
            <TextareaInput placeholder={t('command.need_note_placeholder')} value={note} onChangeText={setNote} testID="need-note-input" multiline />
          </Textarea>
        </VStack>

        <VStack space="sm">
          {quantified ? (
            <Button size="lg" onPress={handleSaveFill} isDisabled={!fillChanged && !note.trim()} testID="need-save-fill">
              <ButtonText>{t('command.need_save_fill')}</ButtonText>
            </Button>
          ) : isFilled ? (
            <Button size="lg" variant="outline" onPress={handleReopen} testID="need-reopen">
              <ButtonIcon as={RotateCcw} />
              <ButtonText>{t('command.need_reopen')}</ButtonText>
            </Button>
          ) : (
            <Button size="lg" onPress={handleMarkFilled} testID="need-mark-filled">
              <ButtonIcon as={CheckCircle2} />
              <ButtonText>{t('command.need_mark_filled')}</ButtonText>
            </Button>
          )}
          <Button size="lg" variant="outline" action="negative" onPress={() => setIsCloseConfirmOpen(true)} testID="need-close">
            <ButtonIcon as={XCircle} />
            <ButtonText>{t('command.need_close')}</ButtonText>
          </Button>
        </VStack>

        {/* Audit trail: every fill/status change with author, timestamp, and note */}
        <VStack space="xs" testID="need-audit-trail">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_history_label')}</Text>
          {isLoadingUpdates ? (
            <Spinner size="small" />
          ) : updates.length === 0 ? (
            <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.need_history_empty')}</Text>
          ) : (
            updates.map((row) => (
              <VStack key={row.IncidentNeedUpdateId} space="xs" className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`need-update-${row.IncidentNeedUpdateId}`}>
                <HStack className="items-center justify-between">
                  <Text className="min-w-0 flex-1 pr-2 text-xs font-semibold text-gray-700 dark:text-gray-200" numberOfLines={1}>
                    {row.CreatedByUserName || t('command.need_history_unknown_user')}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.CreatedOn).toLocaleString()}</Text>
                </HStack>
                <Text className="text-xs text-gray-600 dark:text-gray-300">{changeSummary(row)}</Text>
                {row.Note ? <Text className="text-sm text-gray-800 dark:text-gray-200">{row.Note}</Text> : null}
              </VStack>
            ))
          )}
        </VStack>
      </VStack>

      {/* Closing an unfilled need is deliberate — confirm before it leaves the board */}
      <AlertDialog isOpen={isCloseConfirmOpen} onClose={() => setIsCloseConfirmOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="need-close-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('command.need_close_confirm_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">
              {quantified && need.QuantityFulfilled < need.QuantityRequested
                ? t('command.need_close_confirm_unfilled', { fulfilled: need.QuantityFulfilled, requested: need.QuantityRequested })
                : t('command.need_close_confirm_message')}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setIsCloseConfirmOpen(false)} testID="need-close-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button action="negative" onPress={handleCloseNeed} testID="need-close-confirm">
              <ButtonText>{t('command.need_close')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CustomBottomSheet>
  );
};
