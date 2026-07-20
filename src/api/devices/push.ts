import { type PushRegistrationInput } from '@/models/v4/device/pushRegistrationInput';
import { type PushRegistrationResult } from '@/models/v4/device/pushRegistrationResult';

import { createApiEndpoint } from '../common/client';

const registerDeviceApi = createApiEndpoint('/Devices/RegisterDevice');

export const registerDevice = async (data: PushRegistrationInput) => {
  const response = await registerDeviceApi.post<PushRegistrationResult>({
    ...data,
  });
  return response.data;
};
