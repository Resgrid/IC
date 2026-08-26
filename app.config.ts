/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import { ClientEnv, Env } from './env';
const packageJSON = require('./package.json');

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.APP_ENV !== 'production',
  badges: [
    {
      text: Env.APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: Env.NAME,
  description: `${Env.NAME} Incident Command`,
  owner: Env.EXPO_ACCOUNT_OWNER,
  scheme: Env.SCHEME,
  slug: 'resgrid-ic',
  version: packageJSON.version,
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    icon: './assets/ios-icon.png',
    version: packageJSON.version,
    buildNumber: packageJSON.version,
    supportsTablet: true,
    bundleIdentifier: Env.BUNDLE_ID,
    requireFullScreen: true,
    infoPlist: {
      UIBackgroundModes: ['remote-notification', 'audio', 'bluetooth-central', 'voip'],
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: false,
      NSBluetoothAlwaysUsageDescription: 'Allow Resgrid IC to connect to bluetooth devices for PTT.',
      // Allow the app to open its own custom-scheme deep links (needed for SSO callbacks)
      LSApplicationQueriesSchemes: ['resgridic'],
    },
    entitlements: {
      // Required for APNs registration. Previously added by the withForegroundNotifications
      // plugin; set explicitly so removing/swapping plugins can never silently drop it
      // (which would break ALL iOS push).
      'aps-environment': 'production',
      ...((Env.APP_ENV === 'production' || Env.APP_ENV === 'internal') && {
        'com.apple.developer.usernotifications.critical-alerts': true,
        'com.apple.developer.usernotifications.time-sensitive': true,
      }),
    },
  },
  experiments: {
    typedRoutes: true,
  },
  android: {
    version: packageJSON.version,
    versionCode: parseInt(packageJSON.versionCode),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2484c4',
    },
    // 'pan' makes Android scroll the window under the IME on its own, which fights
    // react-native-keyboard-controller. Its hooks flip the activity to adjustResize on
    // mount and call setDefaultMode() on unmount, restoring whatever this value is — so
    // with 'pan' any closing sheet or modal drops the app back into pan mode and inputs
    // end up under the keyboard. Edge-to-edge means the OS no longer resizes for us
    // either, so 'resize' leaves keyboard avoidance entirely to the library.
    softwareKeyboardLayoutMode: 'resize',
    package: Env.PACKAGE,
    googleServicesFile: 'google-services.json',
    // Register the ResgridIC:// deep-link scheme so OIDC / SAML callbacks are routed back here
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: false,
        data: [{ scheme: 'resgridic' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    permissions: [
      'android.permission.WAKE_LOCK',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAPTURE_AUDIO_OUTPUT',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.READ_PHONE_NUMBERS',
      'android.permission.MANAGE_OWN_CALLS',
    ],
    // Media is selected through Android's system Photo Picker. Block broad media
    // and legacy storage permissions even when a transitive native dependency
    // contributes them during manifest merging.
    blockedPermissions: [
      // Background location was removed from the app (Play policy: no declarable
      // background-location feature). Block the permissions outright so a transitive
      // native dependency cannot reintroduce them during manifest merging.
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      // Contributed by expo-notifications. withRestrictedBootReceivers strips every
      // BOOT_COMPLETED intent-filter (Android 15 crashes apps that launch restricted
      // foreground service types from boot), so nothing here listens for boot and the
      // permission would only be dead weight the Play Console keeps flagging.
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2a7dd5',
        image: './assets/adaptive-icon.png',
        imageWidth: 250,
      },
    ],
    [
      'expo-font',
      {
        fonts: ['./assets/fonts/Inter.ttf'],
      },
    ],
    'expo-localization',
    'expo-router',
    ['react-native-edge-to-edge'],
    'expo-web-browser',
    'expo-secure-store',
    'expo-image',
    'expo-sharing',
    'expo-status-bar',
    [
      '@rnmapbox/maps',
      {
        // Keep in step with the `mapbox` field of the installed @rnmapbox/maps — the JS
        // bindings are generated against a specific native SDK, and pinning an older one
        // makes style props the bindings emit (symbolZOffset and friends) trap natively.
        RNMapboxMapsVersion: '11.23.1',
      },
    ],
    [
      'expo-location',
      {
        // Foreground-only. The IC app centers the map and computes distances while the
        // user has it open; it has no background-location feature, so the background /
        // foreground-service flags and the task manager block stay off. Turning any of
        // them back on re-adds ACCESS_BACKGROUND_LOCATION and gets the Play listing
        // rejected for an undeclared background-location feature.
        locationWhenInUsePermission: 'Allow Resgrid IC to show current location on map.',
        // `false` deletes the key from Info.plist entirely (the plugin otherwise fills in
        // its own default text). The "Always" strings advertise background location on
        // iOS, and nothing here uses Core Motion.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
      },
    ],
    [
      'expo-screen-orientation',
      {
        initialOrientation: 'DEFAULT',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          extraProguardRules: '-keep class expo.modules.location.** { *; }',
          extraMavenRepos: ['../../node_modules/@notifee/react-native/android/libs'],
          targetSdkVersion: 36,
        },
        ios: {
          deploymentTarget: '18.1',
          useFrameworks: 'static',
        },
      },
    ],
    [
      'expo-asset',
      {
        assets: [
          'assets/mapping',
          'assets/audio/ui/space_notification1.mp3',
          'assets/audio/ui/space_notification2.mp3',
          'assets/audio/ui/positive_interface_beep.mp3',
          'assets/audio/ui/software_interface_start.mp3',
          'assets/audio/ui/software_interface_back.mp3',
        ],
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'sentry',
        project: 'ic',
        url: 'https://sentry.resgrid.net/',
      },
    ],
    [
      'expo-navigation-bar',
      {
        position: 'relative',
        visibility: 'hidden',
        behavior: 'inset-touch',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Allow Resgrid IC to access the microphone for audio input used in PTT and calls.',
      },
    ],
    'expo-video',
    'react-native-ble-manager',
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    './plugins/withWebRTCFrameworkFix.js',
    '@config-plugins/react-native-callkeep',
    [
      // Owns the FCM/local notification icon + color meta-data on Android (generates the
      // white-silhouette drawable from the source PNG). Manual meta-data edits are stripped
      // by this plugin, so branding MUST flow through these props.
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#2484c4',
      },
    ],
    './customGradle.plugin.js',
    './customManifest.plugin.js',
    // Must run after customManifest.plugin.js: both edit the merged application node.
    './plugins/withRestrictedBootReceivers.js',
    // Strips expo-location's location-typed foreground service: this app tracks location
    // only in the foreground, so nothing may ship a background-location surface.
    './plugins/withoutBackgroundLocation.js',
    './plugins/withNotificationSounds.js',
    './plugins/withMediaButtonModule.js',
    './plugins/withInCallAudioModule.js',
    ['./plugins/with-app-icon-badge.js', appIconBadgeConfig],
  ],
  extra: {
    ...ClientEnv,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
    },
  },
});
