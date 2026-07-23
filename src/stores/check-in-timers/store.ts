import { isAxiosError } from 'axios';
import { create } from 'zustand';

import type { PerformCheckInInput } from '@/api/check-in-timers/check-in-timers';
import { getCallPersonnelCheckInStatuses, getCheckInHistory, getTimersForCall, getTimerStatuses, performCheckIn, toggleCallTimers } from '@/api/check-in-timers/check-in-timers';
import { logger } from '@/lib/logging';
import type { CallPersonnelCheckInStatusResultData } from '@/models/v4/checkIn/callPersonnelCheckInStatusResultData';
import type { CheckInRecordResultData } from '@/models/v4/checkIn/checkInRecordResultData';
import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';
import type { ResolvedCheckInTimerResultData } from '@/models/v4/checkIn/resolvedCheckInTimerResultData';
import { offlineEventManager } from '@/services/offline-event-manager.service';

export type CheckInResult = 'success' | 'queued' | 'failed';

const STATUS_SEVERITY: Record<string, number> = {
  Critical: 0,
  Overdue: 0,
  Warning: 1,
  Green: 2,
  Ok: 2,
};

interface CheckInTimerState {
  timerStatuses: CheckInTimerStatusResultData[];
  personnelStatuses: CallPersonnelCheckInStatusResultData[];
  resolvedTimers: ResolvedCheckInTimerResultData[];
  checkInHistory: CheckInRecordResultData[];
  isLoadingStatuses: boolean;
  isLoadingHistory: boolean;
  isCheckingIn: boolean;
  isTogglingTimers: boolean;
  hasActivePersonnelTimer: boolean;
  statusError: string | null;
  checkInError: string | null;
  _pollingInterval: ReturnType<typeof setInterval> | null;

  fetchTimerStatuses: (callId: number) => Promise<void>;
  fetchPersonnelStatuses: (callId: number) => Promise<void>;
  fetchResolvedTimers: (callId: number) => Promise<void>;
  fetchCheckInHistory: (callId: number) => Promise<void>;
  performCheckIn: (input: PerformCheckInInput) => Promise<CheckInResult>;
  setCallTimersEnabled: (callId: number, enabled: boolean) => Promise<boolean>;
  startPolling: (callId: number, intervalMs?: number) => void;
  stopPolling: () => void;
  reset: () => void;
}

const initialState = {
  timerStatuses: [],
  personnelStatuses: [],
  resolvedTimers: [],
  checkInHistory: [],
  isLoadingStatuses: false,
  isLoadingHistory: false,
  isCheckingIn: false,
  isTogglingTimers: false,
  hasActivePersonnelTimer: false,
  statusError: null,
  checkInError: null,
  _pollingInterval: null,
};

export const useCheckInTimerStore = create<CheckInTimerState>((set, get) => ({
  ...initialState,

  fetchTimerStatuses: async (callId: number) => {
    set({ isLoadingStatuses: true, statusError: null });
    try {
      const result = await getTimerStatuses(callId);
      const data = Array.isArray(result.Data) ? result.Data : [];
      const sorted = [...data].sort((a, b) => (STATUS_SEVERITY[a.Status] ?? 3) - (STATUS_SEVERITY[b.Status] ?? 3));
      set({ timerStatuses: sorted, isLoadingStatuses: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch timer statuses';
      logger.error({ message: 'Failed to fetch timer statuses', context: { error, callId } });
      set({ statusError: message, isLoadingStatuses: false });
    }
  },

  fetchPersonnelStatuses: async (callId: number) => {
    try {
      const result = await getCallPersonnelCheckInStatuses(callId);
      const data = Array.isArray(result.Data) ? result.Data : [];
      const sorted = [...data].sort((a, b) => (STATUS_SEVERITY[a.Status] ?? 3) - (STATUS_SEVERITY[b.Status] ?? 3));
      set({ personnelStatuses: sorted, hasActivePersonnelTimer: result.HasActivePersonnelTimer === true });
    } catch (error) {
      logger.error({ message: 'Failed to fetch personnel check-in statuses', context: { error, callId } });
    }
  },

  fetchResolvedTimers: async (callId: number) => {
    try {
      const result = await getTimersForCall(callId);
      set({ resolvedTimers: Array.isArray(result.Data) ? result.Data : [] });
    } catch (error) {
      logger.error({ message: 'Failed to fetch resolved timers', context: { error, callId } });
    }
  },

  fetchCheckInHistory: async (callId: number) => {
    set({ isLoadingHistory: true });
    try {
      const result = await getCheckInHistory(callId);
      set({ checkInHistory: Array.isArray(result.Data) ? result.Data : [], isLoadingHistory: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch check-in history', context: { error, callId } });
      set({ isLoadingHistory: false });
    }
  },

  performCheckIn: async (input: PerformCheckInInput) => {
    set({ isCheckingIn: true, checkInError: null });
    try {
      await performCheckIn(input);
      set({ isCheckingIn: false });
      // Re-fetch statuses after successful check-in
      get().fetchTimerStatuses(input.CallId);
      if (input.CheckInType === 0) {
        get().fetchPersonnelStatuses(input.CallId);
      }
      return 'success' as CheckInResult;
    } catch (error) {
      const isOffline = isAxiosError(error) && (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED');
      if (isOffline) {
        if (input.UserId) {
          logger.warn({ message: 'Managed personnel check-in cannot be queued offline', context: { callId: input.CallId, userId: input.UserId } });
          set({ checkInError: 'Managed check-ins require a connection', isCheckingIn: false });
          return 'failed' as CheckInResult;
        }
        offlineEventManager.queueCheckInEvent(input.CallId, input.CheckInType, input.UnitId, input.Latitude, input.Longitude, input.Note);
        logger.info({ message: 'Check-in queued for offline sync', context: { input } });
        set({ isCheckingIn: false });
        return 'queued' as CheckInResult;
      }
      const message = error instanceof Error ? error.message : 'Failed to perform check-in';
      logger.error({ message: 'Failed to perform check-in', context: { error, input } });
      set({ checkInError: message, isCheckingIn: false });
      return 'failed' as CheckInResult;
    }
  },

  setCallTimersEnabled: async (callId: number, enabled: boolean) => {
    set({ isTogglingTimers: true });
    try {
      await toggleCallTimers(callId, enabled);
      set({
        isTogglingTimers: false,
        ...(enabled ? {} : { timerStatuses: [], personnelStatuses: [], resolvedTimers: [], hasActivePersonnelTimer: false }),
      });
      return true;
    } catch (error) {
      logger.error({ message: 'Failed to change call check-in timer state', context: { error, callId, enabled } });
      set({ isTogglingTimers: false });
      return false;
    }
  },

  startPolling: (callId: number, intervalMs: number = 30000) => {
    const { _pollingInterval } = get();
    if (_pollingInterval) {
      clearInterval(_pollingInterval);
    }

    // Fetch immediately
    get().fetchTimerStatuses(callId);
    get().fetchPersonnelStatuses(callId);

    const interval = setInterval(() => {
      get().fetchTimerStatuses(callId);
      get().fetchPersonnelStatuses(callId);
    }, intervalMs);

    set({ _pollingInterval: interval });
  },

  stopPolling: () => {
    const { _pollingInterval } = get();
    if (_pollingInterval) {
      clearInterval(_pollingInterval);
      set({ _pollingInterval: null });
    }
  },

  reset: () => {
    const { _pollingInterval } = get();
    if (_pollingInterval) {
      clearInterval(_pollingInterval);
    }
    set({ ...initialState });
  },
}));
