import type { ConfigContext } from '@expo/config';

import createExpoConfig from '../../app.config';

const { removeLocationTaskService, LOCATION_TASK_SERVICE } = require('../withoutBackgroundLocation');

jest.mock('zod', () => jest.requireActual('zod'));

type Manifest = {
  manifest: {
    $: Record<string, string>;
    application: {
      $: Record<string, string>;
      service?: { $: Record<string, string> }[];
    }[];
  };
};

// Mirrors what expo-location contributes during manifest merging.
const createManifest = (): Manifest => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [
      {
        $: { 'android:name': '.MainApplication' },
        service: [{ $: { 'android:name': LOCATION_TASK_SERVICE, 'android:exported': 'false', 'android:foregroundServiceType': 'location' } }],
      },
    ],
  },
});

const findService = (manifest: Manifest, name: string) => manifest.manifest.application[0].service?.find((service) => service.$['android:name'] === name);

describe('background location removal', () => {
  it('replaces the location task service with a merger removal directive', () => {
    const manifest = removeLocationTaskService(createManifest()) as Manifest;
    const service = findService(manifest, LOCATION_TASK_SERVICE);

    expect(service?.$['tools:node']).toBe('remove');
    expect(service?.$['android:foregroundServiceType']).toBeUndefined();
    expect(manifest.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
  });

  it('declares the removal even when the library manifest has not been merged in yet', () => {
    const manifest = removeLocationTaskService({
      manifest: {
        $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
        application: [{ $: { 'android:name': '.MainApplication' } }],
      },
    } as Manifest) as Manifest;

    expect(findService(manifest, LOCATION_TASK_SERVICE)?.$['tools:node']).toBe('remove');
  });

  it('is idempotent across repeated prebuilds', () => {
    const once = removeLocationTaskService(createManifest()) as Manifest;
    const twice = removeLocationTaskService(once) as Manifest;

    expect(twice.manifest.application[0].service).toHaveLength(1);
    expect(findService(twice, LOCATION_TASK_SERVICE)?.$['tools:node']).toBe('remove');
  });

  it('keeps background location out of the app config', () => {
    const config = createExpoConfig({
      config: {
        name: 'Resgrid IC',
        slug: 'resgrid-ic',
      },
    } as ConfigContext);

    expect(config.plugins).toContain('./plugins/withoutBackgroundLocation.js');
    expect(config.android?.blockedPermissions).toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
    expect(config.android?.permissions).not.toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
    expect(config.ios?.infoPlist?.UIBackgroundModes).not.toContain('location');
    expect(config.ios?.infoPlist?.NSLocationAlwaysUsageDescription).toBeUndefined();
    expect(config.ios?.infoPlist?.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
  });
});
