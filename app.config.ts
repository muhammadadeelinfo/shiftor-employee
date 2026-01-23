import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  sdkVersion: '54.0.0',
  scheme: process.env.EXPO_SCHEME ?? 'employeeportal',
  extra: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    expoStage: process.env.EXPO_STAGE ?? 'development',
    easProjectId: process.env.EAS_PROJECT_ID ?? '',
    authRedirectUrl: process.env.AUTH_REDIRECT_URL ?? '',
    enableLocationInDev: process.env.ENABLE_LOCATION_IN_DEV === 'true',
  },
  plugins: [...(config.plugins ?? []), 'expo-router'],
});
