import { Stack, useLocalSearchParams } from 'expo-router';
import { ShieldPlus } from 'lucide-react-native';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { CommandBoard } from '@/components/command/command-board';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { useCommandBoardStore } from '@/stores/command/board-store';

export default function IncidentDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const callId = Number(id);

  const board = useCommandBoardStore((state) => state.board);
  const isLoading = useCommandBoardStore((state) => state.isLoading);
  const error = useCommandBoardStore((state) => state.error);
  const currentCallId = useCommandBoardStore((state) => state.currentCallId);
  const fetchBoard = useCommandBoardStore((state) => state.fetchBoard);
  const establishCommand = useCommandBoardStore((state) => state.establishCommand);
  const clearBoard = useCommandBoardStore((state) => state.clearBoard);

  useEffect(() => {
    if (!Number.isNaN(callId)) {
      fetchBoard(callId);
    }
    return () => clearBoard();
  }, [callId, fetchBoard, clearBoard]);

  const handleEstablish = useCallback(() => {
    if (!Number.isNaN(callId)) {
      establishCommand(callId);
    }
  }, [callId, establishCommand]);

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

    return (
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={() => fetchBoard(callId)} />} contentContainerStyle={{ padding: 16 }}>
        <CommandBoard board={board} />
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
