import type { ConfigContext } from '@expo/config';

import createExpoConfig from '../../app.config';

jest.mock('zod', () => jest.requireActual('zod'));

const blockedMediaPermissions = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

describe('Android media permissions', () => {
  it('blocks broad media access so system pickers remain the only gallery access path', () => {
    const config = createExpoConfig({
      config: {
        name: 'Resgrid IC',
        slug: 'resgrid-ic',
      },
    } as ConfigContext);

    expect(config.android?.blockedPermissions).toEqual(expect.arrayContaining(blockedMediaPermissions));
    blockedMediaPermissions.forEach((permission) => {
      expect(config.android?.permissions).not.toContain(permission);
    });
  });
});
