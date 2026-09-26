import { Env } from '@env';

import { getItem, removeItem, setItem } from '@/lib/storage';

const BASE_URL = 'baseUrl';
const ACTIVE_CALL_ID = 'activeCallId';
const DEVICE_UUID = 'unitDeviceUuid';

/**
 * Storage key for the user-selected server URL. Exported so logout can preserve it: the
 * server a user signs in to is a device/install preference, not session data, and must
 * survive logout, app restarts (native / Electron) and page reloads (web).
 */
export const BASE_API_URL_STORAGE_KEY = BASE_URL;

const normalizeStoredApiUrl = (value: string) => value.trim().replace(/\/+$/, '');

export const removeBaseApiUrl = () => removeItem(BASE_URL);
export const setBaseApiUrl = (value: string) => setItem<string>(BASE_URL, normalizeStoredApiUrl(value));

export const getBaseApiUrl = () => {
  const baseUrl = getItem<string>(BASE_URL);
  if (!baseUrl) {
    return normalizeStoredApiUrl(`${Env.BASE_API_URL}/api/${Env.API_VERSION}`);
  }
  return normalizeStoredApiUrl(baseUrl);
};

export const removeActiveCallId = () => removeItem(ACTIVE_CALL_ID);
export const setActiveCallId = (value: string) => setItem<string>(ACTIVE_CALL_ID, value);

export const getActiveCallId = () => {
  const activeCallId = getItem<string>(ACTIVE_CALL_ID);
  return activeCallId ?? null;
};

export const removeDeviceUuid = () => removeItem(DEVICE_UUID);
export const setDeviceUuid = (value: string) => setItem<string>(DEVICE_UUID, value);

export const getDeviceUuid = () => {
  const uuid = getItem<string>(DEVICE_UUID);
  return uuid;
};
