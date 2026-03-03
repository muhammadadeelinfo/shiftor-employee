import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const { extra } = Constants.expoConfig ?? {};

export const supabaseUrl = extra?.supabaseUrl as string | undefined;
export const supabaseAnonKey = extra?.supabaseAnonKey as string | undefined;
const configuredStorageBucket = extra?.supabaseStorageBucket as string | undefined;

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

let publicSupabaseClient: SupabaseClient | null = null;

export const getPublicSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!publicSupabaseClient) {
    publicSupabaseClient = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return publicSupabaseClient;
};

export const supabaseStorageBucket =
  configuredStorageBucket && configuredStorageBucket.trim()
    ? configuredStorageBucket.trim()
    : 'company-assets';
