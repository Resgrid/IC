import { Stack, useLocalSearchParams } from 'expo-router';
import { Archive, FileText, ShieldPlus } from 'lucide-react-native';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { CommandBoard } from '@/components/command/command-board';
import { formatIncidentDuration } from '@/components/command/incident-card';
import { NotesSection } from '@/components/command/notes-section';
import { TimelineSection } from '@/components/command/timeline-section';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { IncidentNeedStatus } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useCommandBoardStore } from '@/stores/command/board-store';

export default function IncidentDetail() {
  const { t } = useTranslation();
  const { id, commandId } = useLocalSearchParams<{ id: string; commandId?: string }>();
  const callId = Number(id);
  // A commandId means "open this SPECIFIC (usually ended) command instance" — read-only history view.
  const historyCommandId = typeof commandId === 'string' && commandId.length > 0 ? commandId : null;

  const board = useCommandBoardStore((state) => state.board);
  const timeline = useCommandBoardStore((state) => state.timeline);
  const attachments = useCommandBoardStore((state) => state.attachments);
  const isLoading = useCommandBoardStore((state) => state.isLoading);
  const error = useCommandBoardStore((state) => state.error);
  const currentCallId = useCommandBoardStore((state) => state.currentCallId);
  const fetchBoard = useCommandBoardStore((state) => state.fetchBoard);
  const fetchBoardById = useCommandBoardStore((state) => state.fetchBoardById);
  const establishCommand = useCommandBoardStore((state) => state.establishCommand);
  const clearBoard = useCommandBoardStore((state) => state.clearBoard);

  useEffect(() => {
    if (!Number.isNaN(callId)) {
      if (historyCommandId) {
        fetchBoardById(callId, historyCommandId);
      } else {
        fetchBoard(callId);
      }
    }
    return () => clearBoard();
  }, [callId, historyCommandId, fetchBoard, fetchBoardById, clearBoard]);

  const handleEstablish = useCallback(() => {
    if (!Number.isNaN(callId)) {
      establishCommand(callId);
    }
  }, [callId, establishCommand]);

  const handleRefresh = useCallback(() => {
    if (Number.isNaN(callId)) {
      return;
    }
    if (historyCommandId) {
      fetchBoardById(callId, historyCommandId);
    } else {
      fetchBoard(callId);
    }
  }, [callId, historyCommandId, fetchBoard, fetchBoardById]);

  const renderContent = () => {
    if (isLoading && !board) {
      return <Loading text={t('incidents.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    // No command established yet for this call → offer to establish one.
    if (!board || currentCallId !== callId) {
      return (
        <ZeroState icon={ShieldPlus} heading={t('incidents.no_command')} description={t('incidents.no_command_description')}>
          <Button onPress={handleEstablish} action="primary" testID="establish-command">
            <ButtonText>{t('incidents.establish')}</ButtonText>
          </Button>
        </ZeroState>
      );
    }

    const command = board.Command;
    const isEnded = command.Status !== 0;
    const needs = board.Needs ?? [];

    return (
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />} contentContainerStyle={{ padding: 16 }}>
        <VStack space="lg">
          {isEnded ? (
            <HStack space="sm" className="items-center rounded-lg bg-gray-200 px-3 py-2 dark:bg-gray-700" testID="incident-read-only-banner">
              <Icon as={Archive} size="sm" className="text-gray-600 dark:text-gray-300" />
              <Text className="flex-1 text-sm text-gray-700 dark:text-gray-200">{t('incidents.read_only_banner')}</Text>
            </HStack>
          ) : null}

          {/* Incident meta: name, lifecycle timing, locations */}
          <VStack space="xs" testID="incident-meta">
            <HStack space="sm" className="items-center">
              <Heading size="md" className="min-w-0 flex-1">
                {command.Name || t('incidents.unnamed')}
              </Heading>
              <Badge action={isEnded ? 'muted' : 'success'} size="sm">
                <BadgeText>{isEnded ? t('incidents.ended_badge') : t('incidents.active_badge')}</BadgeText>
              </Badge>
            </HStack>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              {`${new Date(command.EstablishedOn).toLocaleString()} — ${command.ClosedOn ? new Date(command.ClosedOn).toLocaleString() : t('incidents.ongoing')} (${formatIncidentDuration(command.EstablishedOn, command.ClosedOn)})`}
            </Text>
            {command.CommandPostLocationText ? <Text className="text-sm text-gray-600 dark:text-gray-300">{`${t('command.icp_location_label')}: ${command.CommandPostLocationText}`}</Text> : null}
            {command.StagingLocationText ? <Text className="text-sm text-gray-600 dark:text-gray-300">{`${t('command.staging_location_label')}: ${command.StagingLocationText}`}</Text> : null}
            {command.RehabLocationText ? <Text className="text-sm text-gray-600 dark:text-gray-300">{`${t('command.rehab_location_label')}: ${command.RehabLocationText}`}</Text> : null}
            {command.ImportantInformation ? <Text className="text-sm text-amber-700 dark:text-amber-300">{command.ImportantInformation}</Text> : null}
          </VStack>

          <CommandBoard board={board} />

          {/* Needs (read-only) */}
          <Divider />
          <VStack space="sm" testID="incident-needs">
            <Heading size="sm">{t('incidents.needs')}</Heading>
            {needs.length === 0 ? (
              <Text className="text-typography-500">{t('incidents.no_needs')}</Text>
            ) : (
              needs.map((need) => (
                <HStack key={need.IncidentNeedId} className="items-center justify-between">
                  <Text className="flex-1 pr-2 text-typography-900">{need.Name}</Text>
                  <Badge action={need.Status === IncidentNeedStatus.Met ? 'success' : 'muted'} size="sm">
                    <BadgeText>{need.Status === IncidentNeedStatus.Met ? t('common.done') : `${need.QuantityFulfilled}/${need.QuantityRequested}`}</BadgeText>
                  </Badge>
                </HStack>
              ))
            )}
          </VStack>

          {/* Notes (read-only in history view) */}
          <NotesSection notes={board.Notes ?? []} />

          {/* Files (metadata only) */}
          <VStack space="sm" testID="incident-files">
            <Heading size="sm">{`${t('incidents.files')} (${attachments.length})`}</Heading>
            {attachments.length === 0 ? (
              <Text className="text-typography-500">{t('incidents.no_files')}</Text>
            ) : (
              attachments.map((attachment) => (
                <HStack key={attachment.IncidentAttachmentId} space="sm" className="items-center rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                  <Icon as={FileText} size="sm" className="text-gray-500" />
                  <VStack className="min-w-0 flex-1">
                    <Text className="text-sm text-gray-900 dark:text-white" numberOfLines={1}>
                      {attachment.FileName}
                    </Text>
                    {attachment.Description ? (
                      <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                        {attachment.Description}
                      </Text>
                    ) : null}
                  </VStack>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{`${Math.max(1, Math.round(attachment.ContentLength / 1024))} KB`}</Text>
                </HStack>
              ))
            )}
          </VStack>

          {/* Incident log for this command instance */}
          {historyCommandId ? <TimelineSection entries={timeline} onRefresh={handleRefresh} /> : null}
        </VStack>
      </ScrollView>
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <Stack.Screen options={{ title: t('incidents.title'), headerShown: true }} />
      <FocusAwareStatusBar />
      <Box className="flex-1">{renderContent()}</Box>
    </View>
  );
}
