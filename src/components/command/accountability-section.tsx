import { RefreshCw, ShieldCheck, TimerReset } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getParBadgeAction } from '@/lib/incident-command-utils';
import { logger } from '@/lib/logging';
import { getTimeAgoUtc } from '@/lib/utils';
import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';
import { useLocationStore } from '@/stores/app/location-store';
import type { CheckInResult } from '@/stores/check-in-timers/store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { useToastStore } from '@/stores/toast/store';

const PERSONNEL_CHECK_IN_TYPE = 0;
const UNIT_TYPE_CHECK_IN_TYPE = 1;
const ACCOUNTABILITY_DATA_SOURCES = ['timerStatuses', 'personnelStatuses', 'resolvedTimers'] as const;

interface AccountabilitySectionProps {
  callId: number;
  initialTimersEnabled: boolean;
  units: UnitResultData[];
  onTimersActivated?: () => void;
}

interface TimerCheckInTarget {
  checkInType: number;
  unitId?: number;
}

export const AccountabilitySection: React.FC<AccountabilitySectionProps> = ({ callId, initialTimersEnabled, units, onTimersActivated }) => {
  const { t } = useTranslation();
  const timerStatuses = useCheckInTimerStore((state) => state.timerStatuses);
  const personnelStatuses = useCheckInTimerStore((state) => state.personnelStatuses);
  const isLoadingStatuses = useCheckInTimerStore((state) => state.isLoadingStatuses);
  const isCheckingIn = useCheckInTimerStore((state) => state.isCheckingIn);
  const isTogglingTimers = useCheckInTimerStore((state) => state.isTogglingTimers);
  const fetchTimerStatuses = useCheckInTimerStore((state) => state.fetchTimerStatuses);
  const fetchPersonnelStatuses = useCheckInTimerStore((state) => state.fetchPersonnelStatuses);
  const fetchResolvedTimers = useCheckInTimerStore((state) => state.fetchResolvedTimers);
  const performCheckIn = useCheckInTimerStore((state) => state.performCheckIn);
  const setCallTimersEnabled = useCheckInTimerStore((state) => state.setCallTimersEnabled);
  const startPolling = useCheckInTimerStore((state) => state.startPolling);
  const stopPolling = useCheckInTimerStore((state) => state.stopPolling);
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const showToast = useToastStore((state) => state.showToast);
  const [timersEnabled, setTimersEnabled] = useState(initialTimersEnabled);
  const [loadedCallId, setLoadedCallId] = useState<number | null>(null);

  const accountabilityTimers = useMemo(() => timerStatuses.filter((timer) => timer.TargetType !== PERSONNEL_CHECK_IN_TYPE), [timerStatuses]);
  const visiblePersonnelStatuses = loadedCallId === callId ? personnelStatuses : [];
  const visibleTimers = loadedCallId === callId ? accountabilityTimers : [];
  const accountabilityCount = visiblePersonnelStatuses.length + visibleTimers.length;

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([fetchTimerStatuses(callId), fetchPersonnelStatuses(callId), fetchResolvedTimers(callId)]);
    let successfulRequestCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulRequestCount += 1;
      } else {
        logger.warn({
          message: 'Accountability data source failed to refresh',
          context: {
            callId,
            dataSource: ACCOUNTABILITY_DATA_SOURCES[index],
            error: result.reason,
          },
        });
      }
    });

    if (successfulRequestCount > 0) {
      setLoadedCallId(callId);
    }
  }, [callId, fetchPersonnelStatuses, fetchResolvedTimers, fetchTimerStatuses]);

  useEffect(() => {
    setTimersEnabled(initialTimersEnabled);
    setLoadedCallId(null);

    if (!initialTimersEnabled) {
      stopPolling();
      return;
    }

    refresh();
    startPolling(callId);
    return stopPolling;
  }, [callId, initialTimersEnabled, refresh, startPolling, stopPolling]);

  const notifyCheckInResult = useCallback(
    (result: CheckInResult) => {
      if (result === 'success') {
        showToast('success', t('check_in.check_in_success'));
      } else if (result === 'queued') {
        showToast('info', t('check_in.queued_offline'));
      } else {
        showToast('error', t('check_in.check_in_error'));
      }
    },
    [showToast, t]
  );

  const handleActivate = useCallback(async () => {
    const activated = await setCallTimersEnabled(callId, true);
    if (!activated) {
      showToast('error', t('command.accountability_activation_error'));
      return;
    }

    setTimersEnabled(true);
    await refresh();
    startPolling(callId);
    onTimersActivated?.();
    showToast('success', t('command.accountability_activation_success'));
  }, [callId, onTimersActivated, refresh, setCallTimersEnabled, showToast, startPolling, t]);

  const handlePersonnelCheckIn = useCallback(
    async (userId: string) => {
      const result = await performCheckIn({
        CallId: callId,
        CheckInType: PERSONNEL_CHECK_IN_TYPE,
        UserId: userId,
        Latitude: latitude?.toString(),
        Longitude: longitude?.toString(),
      });
      notifyCheckInResult(result);
    },
    [callId, latitude, longitude, notifyCheckInResult, performCheckIn]
  );

  const resolveTimerTarget = useCallback(
    (timer: CheckInTimerStatusResultData): TimerCheckInTarget | null => {
      if (timer.TargetType !== UNIT_TYPE_CHECK_IN_TYPE) {
        return { checkInType: timer.TargetType };
      }

      const targetTypeId = Number(timer.TargetEntityId);
      const unitId = timer.UnitId ?? units.find((unit) => unit.TypeId === targetTypeId)?.UnitId;
      const parsedUnitId = Number(unitId);
      return Number.isFinite(parsedUnitId) && parsedUnitId > 0 ? { checkInType: timer.TargetType, unitId: parsedUnitId } : null;
    },
    [units]
  );

  const handleTimerCheckIn = useCallback(
    async (timer: CheckInTimerStatusResultData) => {
      const target = resolveTimerTarget(timer);
      if (!target) {
        showToast('error', t('command.accountability_no_matching_unit'));
        return;
      }

      const result = await performCheckIn({
        CallId: callId,
        CheckInType: target.checkInType,
        UnitId: target.unitId,
        Latitude: latitude?.toString(),
        Longitude: longitude?.toString(),
      });
      notifyCheckInResult(result);
    },
    [callId, latitude, longitude, notifyCheckInResult, performCheckIn, resolveTimerTarget, showToast, t]
  );

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-accountability-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.accountability_section')}</Heading>
          {timersEnabled ? <Text className="text-sm text-gray-500 dark:text-gray-400">({accountabilityCount})</Text> : null}
        </HStack>
        {timersEnabled ? (
          <Button size="xs" variant="outline" onPress={refresh} isDisabled={isLoadingStatuses} testID="command-accountability-refresh">
            <RefreshCw size={14} />
            <ButtonText>{t('common.refresh')}</ButtonText>
          </Button>
        ) : null}
      </HStack>

      {!timersEnabled ? (
        <VStack space="md" className="items-center py-2">
          <TimerReset size={28} className="text-gray-500 dark:text-gray-400" />
          <Text className="text-center text-sm text-gray-500 dark:text-gray-400">{t('command.accountability_inactive_description')}</Text>
          <Button onPress={handleActivate} isDisabled={isTogglingTimers} testID="command-accountability-activate">
            <ShieldCheck size={16} color="white" />
            <ButtonText>{t('command.accountability_activate')}</ButtonText>
          </Button>
        </VStack>
      ) : accountabilityCount === 0 && !isLoadingStatuses ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.accountability_no_configured_timers')}</Text>
      ) : (
        <VStack space="sm">
          {visiblePersonnelStatuses.map((entry) => (
            <HStack key={entry.UserId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`accountability-${entry.UserId}`}>
              <VStack className="mr-2 flex-1">
                <Text className="text-base text-gray-900 dark:text-white">{entry.FullName}</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">{entry.LastCheckIn ? `${t('command.last_check_in')}: ${getTimeAgoUtc(entry.LastCheckIn)}` : t('command.no_check_in_yet')}</Text>
              </VStack>
              <VStack space="xs" className="items-end">
                <Badge action={getParBadgeAction(entry.Status)} variant="solid">
                  <BadgeText className="text-white">{entry.Status === 'Green' ? t('command.par_green') : entry.Status === 'Warning' ? t('command.par_warning') : t('command.par_critical')}</BadgeText>
                </Badge>
                <Button size="xs" onPress={() => handlePersonnelCheckIn(entry.UserId)} isDisabled={isCheckingIn} testID={`accountability-check-in-${entry.UserId}`}>
                  <ButtonText>{t('check_in.perform_check_in')}</ButtonText>
                </Button>
              </VStack>
            </HStack>
          ))}

          {visibleTimers.map((timer) => {
            const target = resolveTimerTarget(timer);
            const unitTypeName = timer.TargetType === UNIT_TYPE_CHECK_IN_TYPE ? units.find((unit) => unit.TypeId === Number(timer.TargetEntityId))?.Type : null;
            return (
              <HStack
                key={`${timer.TargetType}-${timer.TargetEntityId}`}
                className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900"
                testID={`accountability-timer-${timer.TargetType}-${timer.TargetEntityId}`}
              >
                <VStack className="mr-2 flex-1">
                  <Text className="text-base text-gray-900 dark:text-white">{unitTypeName || timer.TargetName || timer.TargetTypeName}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{timer.LastCheckIn ? `${t('command.last_check_in')}: ${getTimeAgoUtc(timer.LastCheckIn)}` : t('command.no_check_in_yet')}</Text>
                </VStack>
                <VStack space="xs" className="items-end">
                  <Badge action={getParBadgeAction(timer.Status)} variant="solid">
                    <BadgeText className="text-white">
                      {timer.Status === 'Green' || timer.Status === 'Ok' ? t('command.par_green') : timer.Status === 'Warning' ? t('command.par_warning') : t('command.par_critical')}
                    </BadgeText>
                  </Badge>
                  <Button size="xs" onPress={() => handleTimerCheckIn(timer)} isDisabled={isCheckingIn || target === null} testID={`accountability-timer-check-in-${timer.TargetType}-${timer.TargetEntityId}`}>
                    <ButtonText>{t('check_in.perform_check_in')}</ButtonText>
                  </Button>
                </VStack>
              </HStack>
            );
          })}
        </VStack>
      )}
    </Box>
  );
};
