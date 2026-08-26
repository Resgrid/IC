const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const TOOLS_NAMESPACE = 'http://schemas.android.com/tools';

/**
 * Android 15 (targetSdk 35+) forbids launching restricted foreground service types
 * (dataSync, camera, mediaPlayback, phoneCall, mediaProjection, microphone,
 * specialUse, systemExempted) from a BOOT_COMPLETED broadcast receiver. Doing so
 * throws ForegroundServiceStartNotAllowedException and crashes the app.
 *
 * This app declares several of those types (notifee's ForegroundService is
 * microphone|connectedDevice, CallKeep's VoiceConnectionService is phoneCall,
 * react-native-webrtc contributes mediaProjection), and expo-notifications registers a receiver for
 * BOOT_COMPLETED that can reach `startForegroundService`:
 *
 *   - expo.modules.notifications.service.NotificationsService — on boot it re-arms
 *     scheduled local notifications.
 *
 * That boot path is not needed here: the app never schedules local notifications — all
 * notifications are push-delivered.
 *
 * Library manifests are merged in by Gradle, so the boot actions cannot be edited
 * directly. Instead we re-declare the receiver in the app manifest with
 * tools:node="replace", which makes the manifest merger take OUR element — attributes
 * and intent-filters — verbatim in place of the library's.
 *
 * NotificationsService MUST stay declared: it is resolved with queryBroadcastReceivers()
 * on the expo.modules.notifications.NOTIFICATION_EVENT action — dropping that filter
 * would kill ALL notification delivery, so it is preserved here.
 *
 * MY_PACKAGE_REPLACED is kept: the Android 15 restriction is specific to BOOT_COMPLETED.
 */
const RECEIVER_OVERRIDES = [
  {
    name: 'expo.modules.notifications.service.NotificationsService',
    attributes: {
      'android:enabled': 'true',
      'android:exported': 'false',
    },
    intentFilters: [
      {
        attributes: { 'android:priority': '-1' },
        actions: ['expo.modules.notifications.NOTIFICATION_EVENT', 'android.intent.action.MY_PACKAGE_REPLACED'],
      },
    ],
  },
];

const buildReceiver = (override) => ({
  $: {
    'android:name': override.name,
    ...override.attributes,
    'tools:node': 'replace',
  },
  'intent-filter': override.intentFilters.map((filter) => ({
    $: { ...filter.attributes },
    action: filter.actions.map((action) => ({ $: { 'android:name': action } })),
  })),
});

/**
 * Pure manifest transform, exported for tests.
 *
 * @param {object} androidManifest parsed AndroidManifest.xml (xml2js shape)
 * @returns {object} the same manifest, mutated
 */
const applyBootReceiverOverrides = (androidManifest) => {
  if (!androidManifest.manifest.$['xmlns:tools']) {
    androidManifest.manifest.$['xmlns:tools'] = TOOLS_NAMESPACE;
  }

  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  const receivers = mainApplication.receiver ?? [];

  RECEIVER_OVERRIDES.forEach((override) => {
    const replacement = buildReceiver(override);
    const existingIndex = receivers.findIndex((receiver) => receiver.$?.['android:name'] === override.name);

    if (existingIndex >= 0) {
      receivers[existingIndex] = replacement;
    } else {
      receivers.push(replacement);
    }
  });

  mainApplication.receiver = receivers;
  return androidManifest;
};

const withRestrictedBootReceivers = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults = applyBootReceiverOverrides(config.modResults);
    return config;
  });

module.exports = withRestrictedBootReceivers;
module.exports.applyBootReceiverOverrides = applyBootReceiverOverrides;
module.exports.RECEIVER_OVERRIDES = RECEIVER_OVERRIDES;
