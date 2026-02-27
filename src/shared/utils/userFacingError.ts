type UserFacingErrorOptions = {
  fallback: string;
  invalidCredentials?: string;
  emailNotConfirmed?: string;
};

const INTERNAL_ERROR_PATTERNS: RegExp[] = [
  /schema cache/i,
  /could not find the function/i,
  /does not exist/i,
  /permission denied/i,
  /row-level security/i,
  /violates .* constraint/i,
  /on conflict specification/i,
  /\bPGRST\d+\b/i,
  /\bSQLSTATE\b/i,
  /supabase/i,
  /postgrest/i,
  /public\.[a-z0-9_]+/i,
];

const extractErrorMessage = (error: unknown): string | null => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object') {
    const keys = ['message', 'error_description', 'details', 'hint'] as const;
    for (const key of keys) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
};

export const getUserFacingErrorMessage = (
  error: unknown,
  options: UserFacingErrorOptions
): string => {
  const rawMessage = extractErrorMessage(error);
  if (!rawMessage) return options.fallback;

  if (/invalid login credentials|invalid email or password/i.test(rawMessage)) {
    return options.invalidCredentials ?? options.fallback;
  }

  if (/email not confirmed|email not verified/i.test(rawMessage)) {
    return options.emailNotConfirmed ?? options.fallback;
  }

  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return options.fallback;
  }

  return rawMessage;
};
