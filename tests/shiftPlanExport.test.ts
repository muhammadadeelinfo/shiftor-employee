import assert from 'assert';
import { buildShiftPlanCalendarContent, buildShiftPlanFileName } from '../src/shared/utils/shiftPlanExport';

const shifts = [
  {
    id: 'shift-1',
    title: 'Morning Lobby Shift',
    location: '10 Main St',
    objectName: 'HQ Building',
    objectAddress: '10 Main St, Berlin',
    objectContactName: 'Jordan Lee',
    objectContactPhone: '+49 123 456',
    objectContactEmail: 'ops@example.com',
    start: '2026-04-20T08:00:00.000Z',
    end: '2026-04-20T16:00:00.000Z',
    status: 'scheduled' as const,
    description: 'Arrive 10 minutes early.',
  },
  {
    id: 'shift-2',
    title: 'Evening Patrol',
    location: 'Warehouse Gate',
    start: '2026-04-22T18:30:00.000Z',
    end: '2026-04-22T22:30:00.000Z',
    status: 'scheduled' as const,
  },
];

const content = buildShiftPlanCalendarContent(shifts);

assert.ok(content.includes('BEGIN:VCALENDAR'));
assert.ok(content.includes('BEGIN:VEVENT'));
assert.ok(content.includes('SUMMARY:Morning Lobby Shift'));
assert.ok(content.includes('LOCATION:10 Main St\\, Berlin'));
assert.ok(content.includes('DESCRIPTION:Site: HQ Building\\nLocation: 10 Main St\\nContact: Jordan Lee'));
assert.ok(content.includes('DTSTART:20260420T080000Z'));
assert.ok(content.includes('DTEND:20260422T223000Z'));
assert.ok(content.includes('UID:shift-shift-1@shiftor.employee'));

assert.strictEqual(
  buildShiftPlanFileName(shifts),
  'shiftor-shift-plan-2026-04-20-to-2026-04-22.ics'
);

console.log('tests/shiftPlanExport.test.ts OK');
