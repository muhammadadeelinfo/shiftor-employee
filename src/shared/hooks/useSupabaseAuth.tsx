import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { supabase } from '@lib/supabaseClient';

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  session: Session | null;
  refreshSession: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_BOOT_TIMEOUT_MS = 8000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    const client = supabase;
    if (!client) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let didComplete = false;
    const completeLoad = () => {
      if (didComplete) return;
      didComplete = true;
      setLoading(false);
    };

    const timeoutId = setTimeout(() => {
      console.warn(`Supabase session bootstrap timed out after ${AUTH_BOOT_TIMEOUT_MS}ms.`);
      completeLoad();
    }, AUTH_BOOT_TIMEOUT_MS);

    try {
      const {
        data: { session: currentSession },
      } = await client.auth.getSession();
      setSession(currentSession);
    } catch (error) {
      console.warn('Failed to bootstrap Supabase session.', error);
    } finally {
      clearTimeout(timeoutId);
      completeLoad();
    }
  };

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    void refreshSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const authRedirectUrl = Constants.expoConfig?.extra?.authRedirectUrl as string | undefined;

  const SUPABASE_CONFIG_ERROR_MESSAGE =
    'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY in your environment.';

  const ensureClient = () => {
    if (!supabase) {
      throw new Error(SUPABASE_CONFIG_ERROR_MESSAGE);
    }
    return supabase;
  };

  const signInWithEmail = async (email: string) => {
    const options = authRedirectUrl ? { emailRedirectTo: authRedirectUrl } : undefined;
    const client = ensureClient();

    const { error } = await client.auth.signInWithOtp({
      email,
      options,
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    const client = ensureClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  };

  const value = useMemo(
    () => ({
      loading,
      user: session?.user ?? null,
      session,
      refreshSession,
      signInWithEmail,
      signOut,
    }),
    [loading, refreshSession, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
