import { Env } from '@env';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getConfig } from '@/api/config';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';
import { getActiveCallId, setActiveCallId } from '@/lib/storage/app';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';

import { useCallsStore } from '../calls/store';

interface CoreState {
  activeCallId: string | null;
  activeCall: CallResultData | null;
  activePriority: CallPriorityResultData | null;

  config: GetConfigResultData | null;

  isLoading: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  init: () => Promise<void>;
  setActiveCall: (callId: string | null) => Promise<void>;
  fetchConfig: () => Promise<void>;
}

export const useCoreStore = create<CoreState>()(
  persist(
    (set, get) => ({
      activeCallId: null,
      activeCall: null,
      activePriority: null,
      config: null,
      isLoading: false,
      isInitialized: false,
      isInitializing: false,
      error: null,
      init: async () => {
        const state = get();

        // Prevent multiple simultaneous initializations
        if (state.isInitializing) {
          logger.info({
            message: 'Core store initialization already in progress, skipping',
          });
          return;
        }

        // Don't re-initialize if already initialized
        if (state.isInitialized) {
          logger.info({
            message: 'Core store already initialized, skipping',
          });
          return;
        }

        set({ isLoading: true, isInitializing: true, error: null });

        try {
          // Fetch config first before anything else - this is critical for SignalR connections
          await get().fetchConfig();

          // If config fetch failed, don't continue initialization
          if (get().error) {
            throw new Error('Config fetch failed, cannot continue initialization');
          }

          const activeCallId = getActiveCallId();

          if (activeCallId) {
            await get().setActiveCall(activeCallId);
          }

          set({
            isInitialized: true,
            isLoading: false,
            isInitializing: false,
          });

          logger.info({
            message: 'Core store initialization completed successfully',
          });
        } catch (error) {
          set({
            error: 'Failed to init core app data',
            isLoading: false,
            isInitializing: false,
          });
          logger.error({
            message: `Failed to init core app data: ${JSON.stringify(error)}`,
            context: { error },
          });
          throw error;
        }
      },
      setActiveCall: async (callId: string | null) => {
        if (!callId) {
          // Deselect the call
          set({
            activeCall: null,
            activePriority: null,
            activeCallId: null,
          });
          return;
        }

        set({ isLoading: true, error: null, activeCallId: callId });
        try {
          await setActiveCallId(callId);
          const callStore = useCallsStore.getState();
          await callStore.fetchCalls();
          await callStore.fetchCallPriorities();
          const activeCall = callStore.calls.find((call) => call.CallId === callId);
          const activePriority = callStore.callPriorities.find((priority) => priority.Id === activeCall?.Priority);
          set({
            activeCall: activeCall,
            activePriority: activePriority,
            isLoading: false,
          });
        } catch (error) {
          set({ error: 'Failed to set active call', isLoading: false });
          logger.error({
            message: `Failed to set active call: ${JSON.stringify(error)}`,
            context: { error },
          });
        }
      },
      fetchConfig: async () => {
        try {
          const config = await getConfig(Env.APP_KEY);
          // Only update if config actually changed to prevent unnecessary re-renders
          const current = get().config;
          if (!current || JSON.stringify(current) !== JSON.stringify(config.Data)) {
            set({ config: config.Data, error: null });
          } else if (get().error) {
            // Clear error even if config hasn't changed
            set({ error: null });
          }
        } catch (error) {
          set({ error: 'Failed to fetch config', isLoading: false });
          logger.error({
            message: `Failed to fetch config: ${JSON.stringify(error)}`,
            context: { error },
          });
          throw error; // Re-throw to allow calling code to handle
        }
      },
    }),
    {
      name: 'core-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        activeCallId: state.activeCallId,
        activeCall: state.activeCall,
        activePriority: state.activePriority,
        config: state.config,
        // Exclude: isLoading, isInitialized, isInitializing, error
        // These are transient flags that must NOT persist across reloads
      }),
    }
  )
);
