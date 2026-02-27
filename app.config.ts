import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Shiftor Employee',
  slug: config.slug ?? 'shiftor-employee',
  sdkVersion: '54.0.0',
  scheme: process.env.EXPO_SCHEME ?? 'shiftoremployee',
  version: process.env.APP_VERSION ?? config.version ?? '1.0.0',
  android: {
    ...config.android,
    package: process.env.ANDROID_PACKAGE ?? config.android?.package ?? 'com.shiftor.employee',
    versionCode: Number.parseInt(process.env.ANDROID_VERSION_CODE ?? '', 10) || config.android?.versionCode,
    blockedPermissions: [
      ...(config.android?.blockedPermissions ?? []),
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  extra: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    supabaseStorageBucket:
      process.env.SUPABASE_STORAGE_BUCKET ??
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
      'company-assets',
    sentryDsn: process.env.SENTRY_DSN ?? '',
    expoStage: process.env.EXPO_STAGE ?? 'production',
    easProjectId: process.env.EAS_PROJECT_ID ?? '',
    authRedirectUrl: process.env.AUTH_REDIRECT_URL ?? '',
    legalPrivacyUrl: process.env.LEGAL_PRIVACY_URL ?? '',
    legalTermsUrl: process.env.LEGAL_TERMS_URL ?? '',
    legalSupportUrl: process.env.LEGAL_SUPPORT_URL ?? '',
    apiBaseUrl: process.env.API_BASE_URL ?? '',
    enableLocationInDev: process.env.ENABLE_LOCATION_IN_DEV === 'true',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId ?? '',
    },
  },
  plugins: (() => {
    const plugins = [
      ...(config.plugins ?? []),
      'expo-router',
      [
        'expo-camera',
        {
          cameraPermission:
            process.env.IOS_CAMERA_USAGE_DESCRIPTION ??
            'Camera access is required to scan QR codes for clock-in.',
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-calendar',
        {
          calendarPermission:
            process.env.IOS_CALENDAR_USAGE_DESCRIPTION ??
            'Calendar access lets you import shifts and sync your schedule.',
          remindersPermission: false,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            process.env.IOS_PHOTOS_USAGE_DESCRIPTION ??
            'Photo library access lets you upload a profile picture.',
        },
      ],
    ];
    const sentryOrg = process.env.SENTRY_ORG?.trim();
    const sentryProject = process.env.SENTRY_PROJECT?.trim();

    if (sentryOrg && sentryProject) {
      plugins.push([
        '@sentry/react-native/expo',
        {
          organization: sentryOrg,
          project: sentryProject,
        },
      ]);
    }

    return plugins;
  })(),
  ios: {
    ...config.ios,
    supportsTablet: true,
    bundleIdentifier:
      process.env.IOS_BUNDLE_IDENTIFIER ?? config.ios?.bundleIdentifier ?? 'com.shiftor.employee',
    buildNumber: process.env.IOS_BUILD_NUMBER ?? config.ios?.buildNumber ?? '1',
    infoPlist: {
      ...config.ios?.infoPlist,
      NSCameraUsageDescription:
        process.env.IOS_CAMERA_USAGE_DESCRIPTION ??
        'Camera access is required to scan QR codes for clock-in.',
      NSCalendarsUsageDescription:
        process.env.IOS_CALENDAR_USAGE_DESCRIPTION ??
        'Calendar access lets you import shifts and sync your schedule.',
      NSCalendarsFullAccessUsageDescription:
        process.env.IOS_CALENDAR_USAGE_DESCRIPTION ??
        'Calendar access lets you import shifts and sync your schedule.',
      NSCalendarsWriteOnlyAccessUsageDescription:
        process.env.IOS_CALENDAR_USAGE_DESCRIPTION ??
        'Calendar access lets you import shifts and sync your schedule.',
      NSUserNotificationsUsageDescription:
        process.env.IOS_NOTIFICATIONS_USAGE_DESCRIPTION ??
        'Notifications keep you updated about shifts and schedule changes.',
      NSPhotoLibraryUsageDescription:
        process.env.IOS_PHOTOS_USAGE_DESCRIPTION ??
        'Photo library access lets you upload a profile picture.',
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSExceptionDomains: {
          localhost: {
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
    },
  },
});
