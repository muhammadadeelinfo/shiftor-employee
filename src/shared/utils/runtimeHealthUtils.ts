export const REQUIRED_EXPO_EXTRA_KEYS = ['supabaseUrl', 'supabaseAnonKey', 'apiBaseUrl'] as const;

type RequiredExtraKey = (typeof REQUIRED_EXPO_EXTRA_KEYS)[number];

export const parseBooleanExtra = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

export const getRuntimeConfigIssuesFromExtra = (
  extra: Record<string, unknown>
): string[] => {
  const issues: string[] = [];

  REQUIRED_EXPO_EXTRA_KEYS.forEach((key) => {
    const value = extra[key as RequiredExtraKey];
    if (typeof value !== 'string' || !value.trim()) {
      issues.push(`Missing required runtime config: ${key}`);
    }
  });

  return issues;
};

export const buildNotificationsHealthEndpoint = (supabaseUrl: string): string =>
  `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/notifications?select=id&limit=1`;

export const isMissingTableError = (status: number, body: string): boolean =>
  status === 404 && body.includes('PGRST205');
