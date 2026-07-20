import { AlarmClock, Check, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { parseUtcMs } from '@/lib/utils';
import type { IncidentTimer } from '@/models/v4/incidentCommand/incidentCommandModels';

/** IncidentTimerStatus.Stopped — stopped timers are hidden. */
const TIMER_STATUS_STOPPED = 3;

const INTERVAL_PRESETS_MINUTES = [10, 15, 20];

interface TimersSectionProps {
  timers: IncidentTimer[];
  onStartTimer: (name: string, intervalSeconds: number) => void;
  onAcknowledge: (incidentTimerId: string) => void;
}

const formatClock = (totalSeconds: number) => {
  const s = Math.abs(Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** PAR / benchmark reminder timers with live countdowns — mirrors Tablet Command's PAR alerting. */
// eslint-disable-next-line max-lines-per-function
export const TimersSection: React.FC<TimersSectionProps> = ({ timers, onStartTimer, onAcknowledge }) => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(15);

  const activeTimers = useMemo(() => timers.filter((timer) => timer.Status !== TIMER_STATUS_STOPPED), [timers]);

  // One ticking clock for every countdown in the section
  useEffect(() => {
    if (activeTimers.length === 0) {
      return;
    }
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimers.length]);

  const handleStart = useCallback(() => {
    const trimmed = name.trim() || t('command.timer_default_name');
    onStartTimer(trimmed, minutes * 60);
    setName('');
    setMinutes(15);
    setIsAdding(false);
  }, [name, minutes, onStartTimer, t]);

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-timers-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.timers_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({activeTimers.length})</Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={() => setIsAdding((v) => !v)} testID="command-timers-add">
          <ButtonIcon as={Plus} />
          <ButtonText>{t('command.add_timer')}</ButtonText>
        </Button>
      </HStack>

      {isAdding ? (
        <VStack space="sm" className="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900" testID="command-timer-form">
          <Input size="md" variant="outline">
            <InputField placeholder={t('command.timer_name_placeholder')} value={name} onChangeText={setName} testID="timer-name-input" />
          </Input>
          <HStack space="sm" className="items-center">
            {INTERVAL_PRESETS_MINUTES.map((preset) => (
              <Button key={preset} size="xs" variant={minutes === preset ? 'solid' : 'outline'} onPress={() => setMinutes(preset)} testID={`timer-preset-${preset}`}>
                <ButtonText>{t('command.timer_minutes', { count: preset })}</ButtonText>
              </Button>
            ))}
            <Button size="xs" onPress={handleStart} testID="timer-start">
              <ButtonText>{t('command.start_timer')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      ) : null}

      {activeTimers.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_timers')}</Text>
      ) : (
        <VStack space="sm">
          {activeTimers.map((timer) => {
            const dueMs = parseUtcMs(timer.NextDueOn);
            const remainingSeconds = dueMs !== null ? Math.round((dueMs - nowMs) / 1000) : null;
            const isOverdue = remainingSeconds !== null && remainingSeconds <= 0;
            return (
              <HStack
                key={timer.IncidentTimerId}
                className={`items-center justify-between rounded-lg px-3 py-2 ${isOverdue ? 'bg-error-50 dark:bg-error-950' : 'bg-gray-50 dark:bg-gray-900'}`}
                testID={`timer-${timer.IncidentTimerId}`}
              >
                <HStack space="sm" className="min-w-0 flex-1 items-center">
                  <AlarmClock className={isOverdue ? 'text-error-600' : 'text-gray-400'} size={18} />
                  <VStack className="min-w-0 flex-1">
                    <Text className="font-medium text-gray-900 dark:text-white">{timer.Name}</Text>
                    <Text className={`text-xs ${isOverdue ? 'font-semibold text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'}`} testID={`timer-countdown-${timer.IncidentTimerId}`}>
                      {remainingSeconds === null ? '' : isOverdue ? t('command.timer_overdue_by', { time: formatClock(remainingSeconds) }) : t('command.timer_due_in', { time: formatClock(remainingSeconds) })}
                    </Text>
                  </VStack>
                </HStack>
                <HStack space="sm" className="items-center">
                  {isOverdue ? (
                    <Badge action="error" variant="solid">
                      <BadgeText className="text-white">{t('command.timer_overdue')}</BadgeText>
                    </Badge>
                  ) : null}
                  <Button
                    size="xs"
                    variant={isOverdue ? 'solid' : 'outline'}
                    action={isOverdue ? 'positive' : 'secondary'}
                    onPress={() => onAcknowledge(timer.IncidentTimerId)}
                    testID={`timer-ack-${timer.IncidentTimerId}`}
                  >
                    <ButtonIcon as={Check} />
                    <ButtonText>{t('command.acknowledge')}</ButtonText>
                  </Button>
                </HStack>
              </HStack>
            );
          })}
        </VStack>
      )}
    </Box>
  );
};
