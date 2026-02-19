import Constants from 'expo-constants';
import {
  buildNotificationsHealthEndpoint,
  getRuntimeConfigIssuesFromExtra,
  isMissingTableError,
  parseBooleanExtra,
} from './runtimeHealthUtils';

export const getRuntimeConfigIssues = (): string[] => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return getRuntimeConfigIssuesFromExtra(extra);
};

export const shouldRunNotificationsTableHealthCheck = (): boolean => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return parseBooleanExtra(extra.requireNotificationsTableHealthCheck);
};

export const checkNotificationsTableHealth = async (
  timeoutMs = 8000
): Promise<{ ok: boolean; issue?: string }> => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const supabaseUrl = typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl.trim() : '';
  const supabaseAnonKey =
    typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey.trim() : '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, issue: 'Cannot check notifications table: missing Supabase config.' };
  }

  const endpoint = buildNotificationsHealthEndpoint(supabaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    const bodyText = await response.text();

    if (response.ok) {
      return { ok: true };
    }
    if (isMissingTableError(response.status, bodyText)) {
      return {
        ok: false,
        issue: 'notifications table is missing. Apply supabase/notifications-table.sql.',
      };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, issue: 'Notifications health check unauthorized. Verify Supabase API keys.' };
    }

    return {
      ok: false,
      issue: `Notifications health check failed (${response.status}).`,
    };
  } catch {
    return { ok: false, issue: 'Notifications health check failed due to network or timeout.' };
  } finally {
    clearTimeout(timeoutId);
  }
};
