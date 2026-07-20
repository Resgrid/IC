import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { PerformCheckInInput } from '@/api/check-in-timers/check-in-timers';
import { useLocationStore } from '@/stores/app/location-store';
import type { CheckInResult } from '@/stores/check-in-timers/store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { useToastStore } from '@/stores/toast/store';

// IC users always check in as personnel — there is no unit context in this app.
const CHECK_IN_TYPE_PERSONNEL = 0;

export function useQuickCheckIn(callId: number) {
  const { t } = useTranslation();
  const isCheckingIn = useCheckInTimerStore((state) => state.isCheckingIn);
  const performCheckInAction = useCheckInTimerStore((state) => state.performCheckIn);
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const showToast = useToastStore((state) => state.showToast);

  const quickCheckIn = useCallback(async () => {
    const input: PerformCheckInInput = {
      CallId: callId,
      CheckInType: CHECK_IN_TYPE_PERSONNEL,
      Latitude: latitude?.toString(),
      Longitude: longitude?.toString(),
    };

    const result: CheckInResult = await performCheckInAction(input);

    if (result === 'success') {
      showToast('success', t('check_in.check_in_success'));
    } else if (result === 'queued') {
      showToast('info', t('check_in.queued_offline'));
    } else {
      showToast('error', t('check_in.check_in_error'));
    }

    return result;
  }, [callId, latitude, longitude, performCheckInAction, showToast, t]);

  return { quickCheckIn, isCheckingIn };
}
