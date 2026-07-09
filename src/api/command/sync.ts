// API wrappers for the v4 Sync controller (offline / shift-start aggregates).
// Mirrors Web/Resgrid.Web.Services/Controllers/v4/SyncController.cs.
// NOTE: unlike the IncidentCommand controller, Sync endpoints take QUERY params.

import { type SyncBundleResult } from '@/models/v4/incidentCommand/incidentCommandResults';

import { createApiEndpoint } from '../common/client';

/**
 * Shift-start aggregate: one render-ready board (incl. computed accountability / PAR) per ACTIVE incident
 * in the caller's department, plus active ad-hoc resources and the next-sync cursor, in a single call.
 */
export const getBundle = async (includeAccountability = true) => {
  const response = await createApiEndpoint('/Sync/Bundle').get<SyncBundleResult>({ includeAccountability });
  return response.data;
};
