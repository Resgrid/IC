import { create } from 'zustand';

import { getCallSiteInfo } from '@/api/calls/callSiteInfo';
import { logger } from '@/lib/logging';
import { type CallSiteInfoData } from '@/models/v4/calls/callSiteInfoResult';

interface SiteInfoState {
  callId: string | null;
  siteInfo: CallSiteInfoData | null;
  isLoading: boolean;
  error: string | null;

  fetchSiteInfo: (callId: string) => Promise<void>;
  reset: () => void;
}

// Only the newest request may write: a different call's late answer, or for the same call an answer from before a grant
// change or expiry (revealed or REDACTED), must never land after the newer one. reset() drops whatever is in flight.
let latestRequest = 0;

/**
 * Site Info tab state (Contacts plan Phase A): the pre-plans, hazards, alert notes and files of the
 * contacts linked to the call being viewed. One call at a time; the tab re-fetches after a step-up so
 * REDACTED values are replaced by the revealed ones, and after the grant expires so they go back.
 */
export const useSiteInfoStore = create<SiteInfoState>((set) => ({
  callId: null,
  siteInfo: null,
  isLoading: false,
  error: null,

  fetchSiteInfo: async (callId: string) => {
    const request = ++latestRequest;
    // The previous answer is dropped, not kept on screen while loading: it may hold values revealed under a grant that
    // no longer applies.
    set({ isLoading: true, error: null, callId, siteInfo: null });
    try {
      const result = await getCallSiteInfo(callId);
      if (request !== latestRequest) {
        return;
      }
      set({ siteInfo: result.Data ?? null, isLoading: false });
    } catch (error) {
      if (request !== latestRequest) {
        return;
      }
      logger.error({
        message: 'Failed to fetch call site info',
        context: { error, callId },
      });
      set({
        siteInfo: null,
        error: error instanceof Error ? error.message : 'Failed to fetch call site info',
        isLoading: false,
      });
    }
  },

  reset: () => {
    latestRequest++;
    set({ callId: null, siteInfo: null, isLoading: false, error: null });
  },
}));
