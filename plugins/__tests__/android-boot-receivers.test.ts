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

// Mirrors what expo-task-manager and expo-notifications contribute during manifest merging.
const createManifest = (): Manifest => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [
      {
        $: { 'android:name': '.MainApplication' },
        receiver: [
          {
            $: { 'android:name': 'expo.modules.taskManager.TaskBroadcastReceiver', 'android:exported': 'false' },
            'intent-filter': [
              {
                action: [
                  { $: { 'android:name': 'expo.modules.taskManager.TaskBroadcastReceiver.INTENT_ACTION' } },
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
  it('drops BOOT_COMPLETED from the task manager receiver while keeping its explicit-intent registration', () => {
    const manifest = applyBootReceiverOverrides(createManifest()) as Manifest;
    const actions = actionsOf(manifest, 'expo.modules.taskManager.TaskBroadcastReceiver');

    expect(findReceiver(manifest, 'expo.modules.taskManager.TaskBroadcastReceiver')).toBeDefined();
    expect(actions).not.toContain('android.intent.action.BOOT_COMPLETED');
    expect(actions).toContain('expo.modules.taskManager.TaskBroadcastReceiver.INTENT_ACTION');
    expect(actions).toContain('android.intent.action.MY_PACKAGE_REPLACED');
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

  it('marks both receivers as merger replacements and declares the tools namespace', () => {
    const manifest = applyBootReceiverOverrides(createManifest()) as Manifest;

    expect(manifest.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    ['expo.modules.taskManager.TaskBroadcastReceiver', 'expo.modules.notifications.service.NotificationsService'].forEach((name) => {
      expect(findReceiver(manifest, name)?.$['tools:node']).toBe('replace');
    });
  });

  it('is idempotent across repeated prebuilds', () => {
    const once = applyBootReceiverOverrides(createManifest()) as Manifest;
    const twice = applyBootReceiverOverrides(once) as Manifest;

    expect(twice.manifest.application[0].receiver).toHaveLength(2);
    expect(actionsOf(twice, 'expo.modules.taskManager.TaskBroadcastReceiver')).not.toContain('android.intent.action.BOOT_COMPLETED');
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
  });
});
