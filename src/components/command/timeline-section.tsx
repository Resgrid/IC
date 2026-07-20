import { RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { parseUtcMs } from '@/lib/utils';
import type { CommandLogEntry } from '@/models/v4/incidentCommand/incidentCommandModels';

const VISIBLE_BATCH = 15;

interface TimelineSectionProps {
  entries: CommandLogEntry[];
  onRefresh: () => void;
}

const formatTime = (iso: string) => {
  const ms = parseUtcMs(iso);
  return ms === null ? '' : new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/** Auto-logged, time-stamped incident log — every board action the server records. */
export const TimelineSection: React.FC<TimelineSectionProps> = ({ entries, onRefresh }) => {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH);

  const visible = entries.slice(0, visibleCount);

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-timeline-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.timeline_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({entries.length})</Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={onRefresh} testID="command-timeline-refresh">
          <ButtonIcon as={RefreshCw} />
        </Button>
      </HStack>

      {entries.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_timeline')}</Text>
      ) : (
        <VStack space="xs">
          {visible.map((entry) => (
            <HStack key={entry.CommandLogEntryId} space="sm" className="items-start rounded-lg bg-gray-50 px-3 py-1.5 dark:bg-gray-900" testID={`timeline-${entry.CommandLogEntryId}`}>
              <Text className="w-20 shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatTime(entry.OccurredOn)}</Text>
              <Text className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">{entry.Description}</Text>
            </HStack>
          ))}
          {entries.length > visibleCount ? (
            <Button size="xs" variant="outline" onPress={() => setVisibleCount((c) => c + VISIBLE_BATCH)} testID="command-timeline-more">
              <ButtonText>{t('command.show_more')}</ButtonText>
            </Button>
          ) : null}
        </VStack>
      )}
    </Box>
  );
};

interface SceneClockProps {
  /** ISO timestamp the incident clock counts from (call logged time). */
  startedOn?: string | null;
}

/** Master scene timer — elapsed incident time, ticking every second (Tablet Command style). */
export const SceneClock: React.FC<SceneClockProps> = ({ startedOn }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startedOn) {
      return;
    }
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedOn]);

  const startMs = parseUtcMs(startedOn);
  if (startMs === null) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const text = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <Text className="text-sm font-semibold tabular-nums text-primary-600 dark:text-primary-400" testID="command-scene-clock">
      {text}
    </Text>
  );
};
