import assert from 'assert';
import { parseCachedShiftFeed } from '../src/features/shifts/shiftCache';

const cached = parseCachedShiftFeed(
  JSON.stringify({
    cachedAt: '2026-07-04T09:00:00Z',
    shifts: [
      {
        id: 'shift-1',
        title: 'Shift',
        location: 'HQ',
        start: '2026-07-04T10:00:00Z',
        end: '2026-07-04T14:00:00Z',
        status: 'scheduled',
      },
    ],
  })
);

assert.strictEqual(cached?.cachedAt, '2026-07-04T09:00:00Z');
assert.strictEqual(cached?.shifts[0].id, 'shift-1');

assert.strictEqual(parseCachedShiftFeed(null), null);
assert.strictEqual(parseCachedShiftFeed('not-json'), null);
assert.strictEqual(
  parseCachedShiftFeed(JSON.stringify({ cachedAt: '2026-07-04T09:00:00Z', shifts: [{ id: 'broken' }] })),
  null
);

console.log('tests/shiftCache.test.ts OK');
