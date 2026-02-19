import assert from 'assert';
import { getShiftPhase, phaseMeta } from '../src/shared/utils/shiftPhase';

const start = '2026-03-10T08:00:00Z';
const end = '2026-03-10T16:00:00Z';

assert.strictEqual(
  getShiftPhase(start, end, new Date('2026-03-10T07:59:59Z')),
  'upcoming',
  'before shift start should be upcoming'
);

assert.strictEqual(
  getShiftPhase(start, end, new Date('2026-03-10T08:00:00Z')),
  'live',
  'exact shift start should be live'
);

assert.strictEqual(
  getShiftPhase(start, end, new Date('2026-03-10T12:00:00Z')),
  'live',
  'between start and end should be live'
);

assert.strictEqual(
  getShiftPhase(start, end, new Date('2026-03-10T16:00:00Z')),
  'live',
  'exact shift end is still live with current logic'
);

assert.strictEqual(
  getShiftPhase(start, end, new Date('2026-03-10T16:00:01Z')),
  'past',
  'after shift end should be past'
);

assert.strictEqual(phaseMeta.past.label, 'Past shift');
assert.strictEqual(phaseMeta.live.label, 'Live now');
assert.strictEqual(phaseMeta.upcoming.label, 'Upcoming');
assert.ok(phaseMeta.past.icon.length > 0);
assert.ok(phaseMeta.live.icon.length > 0);
assert.ok(phaseMeta.upcoming.icon.length > 0);
assert.ok(phaseMeta.past.color.startsWith('#'));
assert.ok(phaseMeta.live.background.startsWith('#'));
assert.ok(phaseMeta.upcoming.background.startsWith('#'));

console.log('tests/shiftPhase.test.ts OK');
