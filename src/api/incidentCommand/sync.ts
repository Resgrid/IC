import type { SyncBundleResult, SyncChangesResult, SyncReferenceResult } from '@/models/v4/incidentCommand/incidentCommandModels';

import { createApiEndpoint } from '../common/client';

/**
 * Row-based delta pull of every change-tracked incident-command row modified
 * since the cursor. Pass 0 (or omit) for a full pull. Soft-deleted / closed /
 * released rows are included so the client can remove them locally.
 */
export const getSyncChanges = async (sinceUnixEpochMs = 0) => {
  const response = await createApiEndpoint('/Sync/Changes').get<SyncChangesResult>({ since: sinceUnixEpochMs });
  return response.data;
};

/**
 * Shift-start aggregate: one render-ready IncidentCommandBoard (including
 * computed PAR/accountability) per active incident + active ad-hoc resources.
 */
export const getSyncBundle = async (includeAccountability = true) => {
  const response = await createApiEndpoint('/Sync/Bundle').get<SyncBundleResult>({ includeAccountability });
  return response.data;
};

/**
 * Slowly-changing department reference data (call types, priorities, command
 * templates, units, groups, POIs, personnel roster, ...) for offline start.
 */
export const getSyncReference = async (bypassCache = false) => {
  const response = await createApiEndpoint('/Sync/Reference').get<SyncReferenceResult>({ bypassCache });
  return response.data;
};
