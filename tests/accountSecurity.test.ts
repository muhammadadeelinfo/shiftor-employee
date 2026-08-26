import assert from 'assert';
import {
  getVerifiedMfaFactorCount,
  requestEmployeeAccountDeletion,
  requestPasswordReset,
  signOutOtherSessions,
} from '../src/features/account/accountSecurity';

const calls: unknown[] = [];

const run = async () => {
  await requestPasswordReset({
    auth: {
      resetPasswordForEmail: async (email, options) => {
        calls.push({ email, options });
        return {};
      },
    },
    email: 'employee@example.com',
    redirectUrl: 'shiftor://reset-password',
  });
  assert.deepStrictEqual(calls.pop(), {
    email: 'employee@example.com',
    options: { redirectTo: 'shiftor://reset-password' },
  });

  await assert.rejects(
    requestPasswordReset({
      auth: {
        resetPasswordForEmail: async () => ({ error: new Error('reset failed') }),
      },
      email: 'employee@example.com',
    }),
    /reset failed/
  );

  await signOutOtherSessions({
    signOut: async (options) => {
      calls.push(options);
      return {};
    },
  });
  assert.deepStrictEqual(calls.pop(), { scope: 'others' });

  assert.strictEqual(
    await getVerifiedMfaFactorCount({
      mfa: {
        listFactors: async () => ({
          data: {
            all: [{ status: 'verified' }, { status: 'unverified' }, { status: 'verified' }],
          },
        }),
      },
    }),
    2
  );

  assert.strictEqual(
    await requestEmployeeAccountDeletion({
      rpc: async (functionName) => {
        calls.push(functionName);
        return { data: { status: 'already_pending' } };
      },
    }),
    'already_pending'
  );
  assert.strictEqual(calls.pop(), 'request_employee_account_deletion');

  await assert.rejects(
    requestEmployeeAccountDeletion({
      rpc: async () => ({ error: new Error('rpc failed') }),
    }),
    /rpc failed/
  );

  console.log('tests/accountSecurity.test.ts OK');
};

void run();
