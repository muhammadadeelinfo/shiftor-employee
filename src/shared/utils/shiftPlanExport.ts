import type { Shift } from '@features/shifts/shiftMapping';

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

const formatIcsDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

const buildShiftDescription = (shift: Shift) => {
  const lines = [
    shift.objectName ? `Site: ${shift.objectName}` : null,
    shift.location ? `Location: ${shift.location}` : null,
    shift.objectContactName ? `Contact: ${shift.objectContactName}` : null,
    shift.objectContactPhone ? `Phone: ${shift.objectContactPhone}` : null,
    shift.objectContactEmail ? `Email: ${shift.objectContactEmail}` : null,
    shift.description ? `Notes: ${shift.description}` : null,
  ].filter(Boolean);

  return lines.join('\n');
};

export const buildShiftPlanCalendarContent = (
  shifts: Shift[],
  calendarName = 'Shiftor Shift Plan'
) => {
  const nowStamp = formatIcsDate(new Date().toISOString());
  const events = shifts
    .map((shift) => {
      const start = formatIcsDate(shift.start);
      const end = formatIcsDate(shift.end);
      if (!start || !end) return null;

      const summary = escapeIcsText(shift.title || 'Shift');
      const location = escapeIcsText(shift.objectAddress || shift.location || 'TBD');
      const description = escapeIcsText(buildShiftDescription(shift));
      const uid = escapeIcsText(`shift-${shift.id}@shiftor.employee`);

      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${summary}`,
        `LOCATION:${location}`,
        description ? `DESCRIPTION:${description}` : null,
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n');
    })
    .filter(Boolean)
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shiftor//Employee Shift Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
};

export const buildShiftPlanFileName = (shifts: Shift[]) => {
  const firstShift = shifts[0];
  const lastShift = shifts[shifts.length - 1];
  const firstDate = firstShift ? firstShift.start.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const lastDate = lastShift ? lastShift.end.slice(0, 10) : firstDate;
  return `shiftor-shift-plan-${firstDate}-to-${lastDate}.ics`;
};
