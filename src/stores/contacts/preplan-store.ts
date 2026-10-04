import { create } from 'zustand';

import { getContactFiles } from '@/api/contacts/contactFiles';
import { getContactPreplan } from '@/api/contacts/contactPreplans';
import { logger } from '@/lib/logging';
import { type ContactFileResultData } from '@/models/v4/contactFiles/contactFilesResult';
import { type ContactPreplanData } from '@/models/v4/contacts/contactPreplanResult';

interface ContactPreplanState {
  /** Pre-plan per contact; an explicit null means "fetched, the contact has none". */
  preplans: Record<string, ContactPreplanData | null>;
  files: Record<string, ContactFileResultData[]>;
  loadingPreplan: Record<string, boolean>;
  loadingFiles: Record<string, boolean>;
  error: string | null;

  fetchPreplan: (contactId: string, force?: boolean) => Promise<void>;
  fetchFiles: (contactId: string, force?: boolean) => Promise<void>;
  invalidate: (contactId: string) => void;
  reset: () => void;
}

// Only the newest request per contact may write. Panels force a re-fetch when the protected-data grant changes or expires,
// so an answer from before that (revealed or REDACTED) must never land after the newer one. invalidate() and reset() drop
// whatever is in flight.
let latestPreplanRequests: Record<string, number> = {};
let latestFilesRequests: Record<string, number> = {};
let sequence = 0;

const without = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const copy = { ...record };
  delete copy[key];
  return copy;
};

/**
 * Pre-plan and site-file cache for the contact details sheet (Contacts plan Phase A). Cached per contact
 * for the life of the sheet; `force` re-fetches after a step-up or a grant expiry so REDACTED values are
 * replaced (or put back). A forced re-fetch drops the cached answer rather than showing it while loading:
 * it may hold values revealed under a grant that no longer applies.
 */
export const useContactPreplanStore = create<ContactPreplanState>((set, get) => ({
  preplans: {},
  files: {},
  loadingPreplan: {},
  loadingFiles: {},
  error: null,

  fetchPreplan: async (contactId: string, force = false) => {
    if (!contactId) return;
    if (!force && Object.prototype.hasOwnProperty.call(get().preplans, contactId)) return;

    const request = ++sequence;
    latestPreplanRequests[contactId] = request;
    set((state) => ({ preplans: without(state.preplans, contactId), loadingPreplan: { ...state.loadingPreplan, [contactId]: true }, error: null }));
    try {
      const result = await getContactPreplan(contactId);
      if (latestPreplanRequests[contactId] !== request) return;
      set((state) => ({
        preplans: { ...state.preplans, [contactId]: result.Data ?? null },
        loadingPreplan: { ...state.loadingPreplan, [contactId]: false },
      }));
    } catch (error) {
      if (latestPreplanRequests[contactId] !== request) return;
      logger.error({ message: 'Failed to fetch contact pre-plan', context: { error, contactId } });
      set((state) => ({
        loadingPreplan: { ...state.loadingPreplan, [contactId]: false },
        error: error instanceof Error ? error.message : 'Failed to fetch contact pre-plan',
      }));
    }
  },

  fetchFiles: async (contactId: string, force = false) => {
    if (!contactId) return;
    if (!force && Object.prototype.hasOwnProperty.call(get().files, contactId)) return;

    const request = ++sequence;
    latestFilesRequests[contactId] = request;
    set((state) => ({ files: without(state.files, contactId), loadingFiles: { ...state.loadingFiles, [contactId]: true }, error: null }));
    try {
      const result = await getContactFiles(contactId, false);
      if (latestFilesRequests[contactId] !== request) return;
      set((state) => ({
        files: { ...state.files, [contactId]: result.Data ?? [] },
        loadingFiles: { ...state.loadingFiles, [contactId]: false },
      }));
    } catch (error) {
      if (latestFilesRequests[contactId] !== request) return;
      logger.error({ message: 'Failed to fetch contact files', context: { error, contactId } });
      set((state) => ({
        loadingFiles: { ...state.loadingFiles, [contactId]: false },
        error: error instanceof Error ? error.message : 'Failed to fetch contact files',
      }));
    }
  },

  invalidate: (contactId: string) => {
    latestPreplanRequests[contactId] = ++sequence;
    latestFilesRequests[contactId] = sequence;
    set((state) => ({
      preplans: without(state.preplans, contactId),
      files: without(state.files, contactId),
      loadingPreplan: { ...state.loadingPreplan, [contactId]: false },
      loadingFiles: { ...state.loadingFiles, [contactId]: false },
    }));
  },

  reset: () => {
    latestPreplanRequests = {};
    latestFilesRequests = {};
    set({ preplans: {}, files: {}, loadingPreplan: {}, loadingFiles: {}, error: null });
  },
}));
