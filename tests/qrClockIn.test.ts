import assert from 'assert';
import { findShiftForQrClockIn, parseQrClockInCode } from '../src/shared/utils/qrClockIn';
import type { Shift } from '../src/features/shifts/shiftMapping';

const shifts: Shift[] = [
  {
    id: 'shift-1',
    assignmentId: 'assignment-1',
    title: 'Lobby coverage',
    location: 'HQ',
    start: '2026-03-01T08:00:00Z',
    end: '2026-03-01T12:00:00Z',
    status: 'scheduled',
  },
  {
    id: 'shift-2',
    assignmentId: 'assignment-2',
    title: 'Warehouse run',
    location: 'Warehouse',
    start: '2026-03-01T12:00:00Z',
    end: '2026-03-01T16:00:00Z',
    status: 'scheduled',
  },
];

assert.deepStrictEqual(parseQrClockInCode('shift:shift-1'), { shiftId: 'shift-1' });
assert.deepStrictEqual(parseQrClockInCode('assignment:assignment-2'), { assignmentId: 'assignment-2' });
assert.deepStrictEqual(parseQrClockInCode('{"shiftId":"shift-2"}'), { shiftId: 'shift-2' });
assert.deepStrictEqual(
  parseQrClockInCode('https://shiftorapp.com/clock-in?assignmentId=assignment-1'),
  { assignmentId: 'assignment-1' }
);
assert.deepStrictEqual(parseQrClockInCode('shift-1'), { shiftId: 'shift-1' });

assert.strictEqual(findShiftForQrClockIn('shift:shift-1', shifts)?.id, 'shift-1');
assert.strictEqual(findShiftForQrClockIn('assignment:assignment-2', shifts)?.id, 'shift-2');
assert.strictEqual(findShiftForQrClockIn('{"assignmentId":"assignment-1"}', shifts)?.id, 'shift-1');
assert.strictEqual(findShiftForQrClockIn('missing-shift', shifts), null);

console.log('tests/qrClockIn.test.ts OK');
