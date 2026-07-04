import assert from 'assert';
import { sanitizeAnalyticsProperties } from '../src/shared/utils/analyticsUtils';

assert.deepStrictEqual(
  sanitizeAnalyticsProperties({
    result: 'success',
    durationMs: 240,
    email: 'private@example.com',
    joinCode: 'SECRET',
    cached: true,
  }),
  { result: 'success', durationMs: 240, cached: true }
);
assert.strictEqual(sanitizeAnalyticsProperties({ value: 'x'.repeat(100) }).value, 'x'.repeat(80));

console.log('tests/analyticsUtils.test.ts OK');
