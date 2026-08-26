const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const TOOLS_NAMESPACE = 'http://schemas.android.com/tools';

/**
 * The IC app tracks location only while it is in the foreground (map centering and
 * distance calculations — see src/services/location.ts). It has no background-location
 * feature, which is why app.config.ts leaves every expo-location background flag off and
 * blocks ACCESS_BACKGROUND_LOCATION / FOREGROUND_SERVICE_LOCATION outright.
 *
 * expo-location's own library manifest still contributes this during merging:
 *
 *   <service android:name=".services.LocationTaskService"
 *            android:foregroundServiceType="location" />
 *
 * Nothing starts it (the app never calls Location.startLocationUpdatesAsync and
 * expo-task-manager is not installed), but it leaves a location-typed foreground service
 * in the shipped manifest — exactly the signal a Play policy review reads as background
 * location. Library manifests cannot be edited directly, so declare the same service in
 * the app manifest with tools:node="remove": the merger drops the element and emits
 * nothing for it.
 */
const LOCATION_TASK_SERVICE = 'expo.modules.location.services.LocationTaskService';

/**
 * Pure manifest transform, exported for tests.
 *
 * @param {object} androidManifest parsed AndroidManifest.xml (xml2js shape)
 * @returns {object} the same manifest, mutated
 */
const removeLocationTaskService = (androidManifest) => {
  if (!androidManifest.manifest.$['xmlns:tools']) {
    androidManifest.manifest.$['xmlns:tools'] = TOOLS_NAMESPACE;
  }

  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  const services = mainApplication.service ?? [];
  const removal = { $: { 'android:name': LOCATION_TASK_SERVICE, 'tools:node': 'remove' } };
  const existingIndex = services.findIndex((service) => service.$?.['android:name'] === LOCATION_TASK_SERVICE);

  if (existingIndex >= 0) {
    services[existingIndex] = removal;
  } else {
    services.push(removal);
  }

  mainApplication.service = services;
  return androidManifest;
};

const withoutBackgroundLocation = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults = removeLocationTaskService(config.modResults);
    return config;
  });

module.exports = withoutBackgroundLocation;
module.exports.removeLocationTaskService = removeLocationTaskService;
module.exports.LOCATION_TASK_SERVICE = LOCATION_TASK_SERVICE;
