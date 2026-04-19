import assert from 'assert';
import { getMonthlyHoursShiftTimings } from '../src/features/account/monthlyHoursParsing';

const parsed = getMonthlyHoursShiftTimings({
  rows: [
    {
      shiftId: 'shift-1',
      objectTitle: 'Museum of Photography',
      plannedStartAt: '2026-04-19T08:00:00Z',
      plannedEndAt: '2026-04-19T20:00:00Z',
      firstClockInAt: '2026-04-19T08:04:00Z',
      lastClockOutAt: '2026-04-19T19:58:00Z',
      workedMinutes: 714,
    },
    {
      shiftId: 'shift-2',
      title: 'Ignored shift',
      plannedStartAt: '2026-04-20T08:00:00Z',
      plannedEndAt: '2026-04-20T16:00:00Z',
    },
  ],
});

assert.strictEqual(parsed.length, 1);
assert.deepStrictEqual(parsed[0], {
  id: 'shift-1',
  title: 'Shift 1',
  location: 'Museum of Photography',
  start: '2026-04-19T08:00:00Z',
  end: '2026-04-19T20:00:00Z',
  clockIn: '2026-04-19T08:04:00Z',
  clockOut: '2026-04-19T19:58:00Z',
  workedMinutes: 714,
});

const fallbackShape = getMonthlyHoursShiftTimings({
  shiftEntries: [
    {
      shiftId: 'shift-3',
      title: 'Front desk',
      object: { title: 'Main Lobby' },
      scheduledStart: '2026-04-21T09:00:00Z',
      scheduledEnd: '2026-04-21T17:00:00Z',
      actualStart: Date.parse('2026-04-21T09:05:00Z'),
      actualEnd: Date.parse('2026-04-21T17:10:00Z'),
    },
  ],
});

assert.strictEqual(fallbackShape.length, 1);
assert.strictEqual(fallbackShape[0]?.id, 'shift-3');
assert.strictEqual(fallbackShape[0]?.title, 'Front desk');
assert.strictEqual(fallbackShape[0]?.location, 'Main Lobby');
assert.strictEqual(fallbackShape[0]?.clockIn, '2026-04-21T09:05:00.000Z');
assert.strictEqual(fallbackShape[0]?.clockOut, '2026-04-21T17:10:00.000Z');
assert.strictEqual(fallbackShape[0]?.workedMinutes, 0);

console.log('tests/monthlyHours.test.ts OK');
