export type MonthlyHoursShiftTiming = {
  id: string;
  title: string;
  location: string;
  start: string | null;
  end: string | null;
  clockIn: string | null;
  clockOut: string | null;
  workedMinutes: number;
};

type MonthlyHoursShiftPayload = {
  rows?: Array<unknown>;
  shifts?: Array<unknown>;
  shiftTotals?: Array<unknown>;
  shiftEntries?: Array<unknown>;
  entries?: Array<unknown>;
  items?: Array<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pickArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => isRecord(entry)) : [];

const pickString = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const parseIso = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return undefined;
};

const pickNumber = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const pickIso = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = parseIso(row[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
};

export const getMonthlyHoursShiftTimings = (
  payload?: MonthlyHoursShiftPayload | null
): MonthlyHoursShiftTiming[] => {
  const candidates = [
    pickArray(payload?.rows),
    pickArray(payload?.shifts),
    pickArray(payload?.shiftTotals),
    pickArray(payload?.shiftEntries),
    pickArray(payload?.entries),
    pickArray(payload?.items),
  ];
  const rows = candidates.find((items) => items.length > 0) ?? [];

  if (!rows.length) {
    return [];
  }

  return rows
    .map((row, index) => {
      const objectMeta = isRecord(row.object) ? row.object : undefined;
      const title =
        pickString(row, ['title', 'shiftTitle', 'name']) ??
        pickString(objectMeta ?? {}, ['title']) ??
        `Shift ${index + 1}`;
      const location =
        pickString(row, ['objectTitle', 'objectName', 'location', 'objectAddress', 'address']) ??
        pickString(objectMeta ?? {}, ['title', 'address']) ??
        '';
      const start = pickIso(row, [
        'plannedStartAt',
        'start',
        'startAt',
        'scheduledStart',
        'shiftStart',
        'plannedStart',
      ]);
      const end = pickIso(row, [
        'plannedEndAt',
        'end',
        'endAt',
        'scheduledEnd',
        'shiftEnd',
        'plannedEnd',
      ]);
      const clockIn = pickIso(row, [
        'firstClockInAt',
        'clockIn',
        'clockInAt',
        'clockedInAt',
        'actualStart',
        'actualStartAt',
        'checkIn',
        'checkInAt',
      ]);
      const clockOut = pickIso(row, [
        'lastClockOutAt',
        'clockOut',
        'clockOutAt',
        'clockedOutAt',
        'actualEnd',
        'actualEndAt',
        'checkOut',
        'checkOutAt',
      ]);
      const workedMinutes = Math.max(
        0,
        Math.round(pickNumber(row, ['workedMinutes']) ?? 0)
      );

      if (!clockIn && !clockOut && workedMinutes <= 0) {
        return null;
      }

      return {
        id: pickString(row, ['id', 'shiftId']) ?? `monthly-hours-shift-${index}`,
        title,
        location,
        start: start ?? null,
        end: end ?? null,
        clockIn: clockIn ?? null,
        clockOut: clockOut ?? null,
        workedMinutes,
      };
    })
    .filter((entry): entry is MonthlyHoursShiftTiming => Boolean(entry))
    .sort((a, b) => {
      const aTime = Number(new Date(a.clockIn ?? a.start ?? 0));
      const bTime = Number(new Date(b.clockIn ?? b.start ?? 0));
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    });
};
