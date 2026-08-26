import type { ConfigContext } from '@expo/config';

import createExpoConfig from '../../app.config';

const { applyBootReceiverOverrides } = require('../withRestrictedBootReceivers');

jest.mock('zod', () => jest.requireActual('zod'));

type Manifest = {
  manifest: {
    $: Record<string, string>;
    application: {
      $: Record<string, string>;
      receiver?: { $: Record<string, string>; 'intent-filter'?: { $?: Record<string, string>; action?: { $: Record<string, string> }[] }[] }[];
    }[];
  };
};

// Mirrors what expo-notifications contributes during manifest merging.
const createManifest = (): Manifest => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [
      {
        $: { 'android:name': '.MainApplication' },
        receiver: [
          {
            $: { 'android:name': 'expo.modules.notifications.service.NotificationsService', 'android:enabled': 'true', 'android:exported': 'false' },
            'intent-filter': [
              {
                action: [
                  { $: { 'android:name': 'expo.modules.notifications.NOTIFICATION_EVENT' } },
                  { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
                  { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});

const findReceiver = (manifest: Manifest, name: string) => manifest.manifest.application[0].receiver?.find((receiver) => receiver.$['android:name'] === name);

const actionsOf = (manifest: Manifest, name: string) => (findReceiver(manifest, name)?.['intent-filter'] ?? []).flatMap((filter) => (filter.action ?? []).map((action) => action.$['android:name']));

describe('Android 15 boot receivers', () => {
  it('keeps MY_PACKAGE_REPLACED on the notifications receiver', () => {
    const manifest = applyBootReceiverOverrides(createManifest()) as Manifest;
    const actions = actionsOf(manifest, 'expo.modules.notifications.service.NotificationsService');

    expect(findReceiver(manifest, 'expo.modules.notifications.service.NotificationsService')).toBeDefined();
    expect(actions).toContain('android.intent.action.MY_PACKAGE_REPLACED');
  });

  it('does not declare the expo-task-manager boot receiver (background location removed)', () => {
    const manifest = applyBootReceiverOverrides(createManifest()) as Manifest;

    expect(findReceiver(manifest, 'expo.modules.taskManager.TaskBroadcastReceiver')).toBeUndefined();
  });

  it('keeps the notifications receiver resolvable by action so push delivery still works', () => {
    const manifest = applyBootReceiverOverrides(createManifest()) as Manifest;
    const actions = actionsOf(manifest, 'expo.modules.notifications.service.NotificationsService');

    expect(actions).toContain('expo.modules.notifications.NOTIFICATION_EVENT');
    expect(actions).not.toContain('android.intent.action.BOOT_COMPLETED');
    expect(actions).not.toContain('android.intent.action.REBOOT');
    expect(actions).not.toContain('android.intent.action.QUICKBOOT_POWERON');
    expect(actions).not.toContain('com.htc.intent.action.QUICKBOOT_POWERON');
  });

  it('marks the receiver as a merger replacement and declares the tools namespace', () => {
    const manifest = applyBootReceiverOverrides(createManifest()) as Manifest;

    expect(manifest.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    expect(findReceiver(manifest, 'expo.modules.notifications.service.NotificationsService')?.$['tools:node']).toBe('replace');
  });

  it('is idempotent across repeated prebuilds', () => {
    const once = applyBootReceiverOverrides(createManifest()) as Manifest;
    const twice = applyBootReceiverOverrides(once) as Manifest;

    expect(twice.manifest.application[0].receiver).toHaveLength(1);
    expect(actionsOf(twice, 'expo.modules.notifications.service.NotificationsService')).not.toContain('android.intent.action.BOOT_COMPLETED');
  });

  it('blocks RECEIVE_BOOT_COMPLETED and registers the plugin', () => {
    const config = createExpoConfig({
      config: {
        name: 'Resgrid IC',
        slug: 'resgrid-ic',
      },
    } as ConfigContext);

    expect(config.android?.blockedPermissions).toContain('android.permission.RECEIVE_BOOT_COMPLETED');
    expect(config.android?.permissions).not.toContain('android.permission.RECEIVE_BOOT_COMPLETED');
    expect(config.plugins).toContain('./plugins/withRestrictedBootReceivers.js');
    expect(config.android?.blockedPermissions).toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
    expect(config.android?.blockedPermissions).toContain('android.permission.FOREGROUND_SERVICE_LOCATION');
  });
});
