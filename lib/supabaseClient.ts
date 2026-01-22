import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const { extra } = Constants.expoConfig ?? {};

const supabaseUrl = extra?.supabaseUrl as string | undefined;
const supabaseAnonKey = extra?.supabaseAnonKey as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY in your environment.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
  },
});
