import { Stack, useLocalSearchParams } from 'expo-router';
import { RefreshCw, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon } from '@/components/ui/button';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { parseUtcMs } from '@/lib/utils';
import { type CommandLogEntry } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useCommandStore } from '@/stores/command/store';

const EMPTY_TIMELINE: CommandLogEntry[] = [];

const formatTimestamp = (iso: string) => {
  const ms = parseUtcMs(iso);
  return ms === null ? '' : new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/** Fullscreen incident log — every server-logged entry with text search. */
export default function CommandLogScreen() {
  const { t } = useTranslation();
  const { callId: rawCallId } = useLocalSearchParams<{ callId: string }>();
  const callId = String(rawCallId ?? '');

  const entries = useCommandStore((state) => state.boards[callId]?.timeline ?? EMPTY_TIMELINE);
  const fetchTimeline = useCommandStore((state) => state.fetchTimeline);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (callId) {
      fetchTimeline(callId);
    }
  }, [callId, fetchTimeline]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return entries;
    }
    return entries.filter((entry) => entry.Description?.toLowerCase().includes(query) ?? false);
  }, [entries, search]);

  return (
    <Box className="flex-1 bg-gray-100 dark:bg-gray-950">
      <Stack.Screen options={{ title: t('command.timeline_section'), headerShown: true }} />
      <FocusAwareStatusBar />

      <HStack className="items-center justify-between bg-white px-4 py-2 dark:bg-gray-800" space="sm">
        <Text className="text-sm text-gray-500 dark:text-gray-400" testID="command-log-count">
          {search.trim() ? t('command.log_results_count', { shown: filtered.length, total: entries.length }) : t('command.log_entries_count', { count: entries.length })}
        </Text>
        <HStack space="sm" className="items-center">
          <Button
            size="xs"
            variant={isSearchOpen ? 'solid' : 'outline'}
            onPress={() => {
              setIsSearchOpen((open) => !open);
              setSearch('');
            }}
            testID="command-log-search-toggle"
          >
            <ButtonIcon as={isSearchOpen ? X : Search} />
          </Button>
          <Button size="xs" variant="outline" onPress={() => fetchTimeline(callId)} testID="command-log-refresh">
            <ButtonIcon as={RefreshCw} />
          </Button>
        </HStack>
      </HStack>

      {isSearchOpen ? (
        <Box className="bg-white px-4 pb-2 dark:bg-gray-800">
          <Input size="md" variant="outline">
            <InputField autoFocus placeholder={t('command.log_search_placeholder')} value={search} onChangeText={setSearch} testID="command-log-search-input" />
          </Input>
        </Box>
      ) : null}

      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={filtered}
        initialNumToRender={30}
        keyExtractor={(entry) => entry.CommandLogEntryId}
        ListEmptyComponent={
          <Text className="py-8 text-center text-sm text-gray-500 dark:text-gray-400" testID="command-log-empty">
            {search.trim() ? t('command.log_no_results') : t('command.empty_timeline')}
          </Text>
        }
        renderItem={({ item: entry }) => (
          <HStack className="mb-1.5 items-start rounded-lg bg-white px-3 py-2 dark:bg-gray-900" space="sm" testID={`command-log-entry-${entry.CommandLogEntryId}`}>
            <Text className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatTimestamp(entry.OccurredOn)}</Text>
            <Text className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">{entry.Description}</Text>
          </HStack>
        )}
      />
    </Box>
  );
}
