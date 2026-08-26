import { logger } from '../logging';
import { storage } from './index';

/**
 * Keys written by features that no longer exist.
 *
 * MMKV never expires anything, so a removed feature leaves its value behind on every
 * device that ever ran a build that had it. Sweep them once on startup so an upgraded
 * install ends up with the same on-disk state as a fresh one.
 *
 * `BACKGROUND_GEOLOCATION_ENABLED` — background location was removed from the app (Play
 * policy: the IC app has no declarable background-location feature). Nothing reads this
 * key any more.
 *
 * Persisted zustand blobs are NOT swept here: a store rehydrates when its module is
 * imported, which happens before this runs. Stale fields inside a blob belong in that
 * store's own persist `migrate` (see src/stores/app/location-store.ts).
 */
const LEGACY_KEYS = ['BACKGROUND_GEOLOCATION_ENABLED'] as const;

/**
 * Delete storage written by features that have since been removed. Safe to call on every
 * startup: it is a no-op once the keys are gone.
 */
export const removeLegacyStorageKeys = (): void => {
  try {
    const removed = LEGACY_KEYS.filter((key) => storage.contains(key));

    if (removed.length === 0) {
      return;
    }

    removed.forEach((key) => storage.delete(key));

    logger.info({
      message: 'Removed legacy storage written by features that no longer exist',
      context: { removed },
    });
  } catch (error) {
    logger.error({
      message: 'Failed to remove legacy storage keys',
      context: { error },
    });
  }
};
