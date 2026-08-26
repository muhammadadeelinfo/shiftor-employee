type AuthResult = {
  error?: unknown;
};

type PasswordResetAuthClient = {
  resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<AuthResult>;
};

type SessionAuthClient = {
  signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<AuthResult>;
};

type MfaFactor = {
  status?: string;
};

type MfaAuthClient = {
  mfa: {
    listFactors: () => Promise<{
      data?: {
        all?: MfaFactor[];
      } | null;
      error?: unknown;
    }>;
  };
};

type RpcClient = {
  rpc: (functionName: string) => PromiseLike<{
    data?: unknown;
    error?: unknown;
  }>;
};

export const requestPasswordReset = async ({
  auth,
  email,
  redirectUrl,
}: {
  auth: PasswordResetAuthClient;
  email: string;
  redirectUrl?: string;
}) => {
  const { error } = await auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  if (error) throw error;
};

export const signOutOtherSessions = async (auth: SessionAuthClient) => {
  const { error } = await auth.signOut({ scope: 'others' });
  if (error) throw error;
};

export const getVerifiedMfaFactorCount = async (auth: MfaAuthClient) => {
  const { data, error } = await auth.mfa.listFactors();
  if (error) throw error;
  return (data?.all ?? []).filter((factor) => factor.status === 'verified').length;
};

export const requestEmployeeAccountDeletion = async (client: RpcClient) => {
  const { data, error } = await client.rpc('request_employee_account_deletion');
  if (error) throw error;
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return typeof payload.status === 'string' ? payload.status : '';
};
