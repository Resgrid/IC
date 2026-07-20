const { withDangerousMod, withAndroidManifest, withAndroidColors, AndroidConfig } = require('expo/config-plugins');
const { copyFileSync, existsSync, mkdirSync } = require('fs');
const { resolve } = require('path');

const ANDROID_RES_PATH = 'android/app/src/main/res/';

/**
 * Pre-rendered pure-white silhouette densities (assets/notification-icons/) — the status-bar
 * small icon Android tints. Generated from assets/notification-icon.png.
 */
const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

/** Brand tint applied by Android behind/around the white silhouette. */
const NOTIFICATION_COLOR = '#2484c4';

/** Copies the ic_notification drawable into every density bucket at prebuild. */
function withNotificationIconDrawables(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      for (const density of DENSITIES) {
        const source = resolve(config.modRequest.projectRoot, `assets/notification-icons/ic_notification-${density}.png`);
        if (!existsSync(source)) {
          throw new Error(`Notification icon asset missing: ${source}`);
        }
        const targetDir = resolve(config.modRequest.projectRoot, `${ANDROID_RES_PATH}drawable-${density}`);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        copyFileSync(source, resolve(targetDir, 'ic_notification.png'));
      }
      return config;
    },
  ]);
}

/**
 * Points FCM at the drawable + tint color so Android notifications (which bypass notifee's
 * display path) use the branded silhouette instead of a gray launcher-icon blob.
 */
function withNotificationIconManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    mainApplication['meta-data'] = mainApplication['meta-data'] || [];

    const upsert = (name, attrs) => {
      const existing = mainApplication['meta-data'].find((item) => item.$['android:name'] === name);
      if (existing) {
        existing.$ = { 'android:name': name, ...attrs };
      } else {
        mainApplication['meta-data'].push({ $: { 'android:name': name, ...attrs } });
      }
    };

    upsert('com.google.firebase.messaging.default_notification_icon', { 'android:resource': '@drawable/ic_notification' });
    upsert('com.google.firebase.messaging.default_notification_color', { 'android:resource': '@color/notification_icon_color' });
    return config;
  });
}

/** Registers the tint color resource the manifest meta-data references. */
function withNotificationIconColor(config) {
  return withAndroidColors(config, (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name: 'notification_icon_color',
      value: NOTIFICATION_COLOR,
    });
    return config;
  });
}

module.exports = (config) => withNotificationIconColor(withNotificationIconManifest(withNotificationIconDrawables(config)));
