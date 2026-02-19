import assert from 'assert';
import {
  buildNotificationsHealthEndpoint,
  getRuntimeConfigIssuesFromExtra,
  isMissingTableError,
  parseBooleanExtra,
} from '../src/shared/utils/runtimeHealthUtils';

assert.strictEqual(parseBooleanExtra(true), true);
assert.strictEqual(parseBooleanExtra(false), false);
assert.strictEqual(parseBooleanExtra('true'), true);
assert.strictEqual(parseBooleanExtra(' YES '), true);
assert.strictEqual(parseBooleanExtra('1'), true);
assert.strictEqual(parseBooleanExtra('on'), true);
assert.strictEqual(parseBooleanExtra('false'), false);
assert.strictEqual(parseBooleanExtra('0'), false);
assert.strictEqual(parseBooleanExtra(1), false);
assert.strictEqual(parseBooleanExtra(undefined), false);

assert.deepStrictEqual(
  getRuntimeConfigIssuesFromExtra({
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon',
    apiBaseUrl: 'https://api.example.com',
  }),
  []
);

assert.deepStrictEqual(getRuntimeConfigIssuesFromExtra({}), [
  'Missing required runtime config: supabaseUrl',
  'Missing required runtime config: supabaseAnonKey',
  'Missing required runtime config: apiBaseUrl',
]);

assert.deepStrictEqual(
  getRuntimeConfigIssuesFromExtra({
    supabaseUrl: ' ',
    supabaseAnonKey: '',
    apiBaseUrl: 'ok',
  }),
  [
    'Missing required runtime config: supabaseUrl',
    'Missing required runtime config: supabaseAnonKey',
  ]
);

assert.strictEqual(
  buildNotificationsHealthEndpoint('https://x.supabase.co'),
  'https://x.supabase.co/rest/v1/notifications?select=id&limit=1'
);
assert.strictEqual(
  buildNotificationsHealthEndpoint('https://x.supabase.co///'),
  'https://x.supabase.co/rest/v1/notifications?select=id&limit=1'
);

assert.strictEqual(isMissingTableError(404, '...PGRST205...'), true);
assert.strictEqual(isMissingTableError(404, 'some other error'), false);
assert.strictEqual(isMissingTableError(500, 'PGRST205'), false);

console.log('tests/runtimeHealthUtils.test.ts OK');
