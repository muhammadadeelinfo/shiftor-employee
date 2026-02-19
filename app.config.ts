import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Shiftor Employee',
  slug: config.slug ?? 'shiftor-employee',
  sdkVersion: '54.0.0',
  scheme: process.env.EXPO_SCHEME ?? 'employeeportal',
  version: process.env.APP_VERSION ?? config.version ?? '1.0.0',
  ios: {
    ...config.ios,
    supportsTablet: true,
    bundleIdentifier:
      process.env.IOS_BUNDLE_IDENTIFIER ?? config.ios?.bundleIdentifier ?? 'com.shiftor.employeeportal',
    buildNumber: process.env.IOS_BUILD_NUMBER ?? config.ios?.buildNumber ?? '1',
    infoPlist: {
      ...config.ios?.infoPlist,
      NSCameraUsageDescription:
        process.env.IOS_CAMERA_USAGE_DESCRIPTION ??
        'Camera access is required to scan QR codes for clock-in.',
      NSLocationWhenInUseUsageDescription:
        process.env.IOS_LOCATION_USAGE_DESCRIPTION ??
        'Location access is used to show nearby shifts and verify shift locations.',
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
    },
  },
  extra: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    sentryDsn: process.env.SENTRY_DSN ?? '',
    expoStage: process.env.EXPO_STAGE ?? 'production',
    easProjectId: process.env.EAS_PROJECT_ID ?? '',
    authRedirectUrl: process.env.AUTH_REDIRECT_URL ?? '',
    apiBaseUrl: process.env.API_BASE_URL ?? '',
    enableLocationInDev: process.env.ENABLE_LOCATION_IN_DEV === 'true',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId ?? '',
    },
  },
  plugins: (() => {
    const plugins = [...(config.plugins ?? []), 'expo-router'];
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
});
