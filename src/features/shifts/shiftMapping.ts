import {
  ShiftConfirmationStatus,
  isShiftVisibleToEmployee,
  normalizeShiftConfirmationStatus,
} from '../../lib/shiftConfirmationStatus';
import { ensureShiftEndAfterStart } from '../../shared/utils/timeUtils';

export type ShiftStatus = 'scheduled' | 'in-progress' | 'completed' | 'blocked';

export type AssignmentMeta = {
  assignmentId?: string;
  shiftId?: string;
  confirmationStatus?: string;
  confirmedAt?: string;
};

export type Shift = {
  id: string;
  title: string;
  location: string;
  objectName?: string;
  objectAddress?: string;
  objectContactName?: string;
  objectContactPhone?: string;
  objectContactEmail?: string;
  start: string;
  end: string;
  status: ShiftStatus;
  description?: string;
  assignmentId?: string;
  confirmationStatus?: ShiftConfirmationStatus;
  confirmedAt?: string;
};

export const defaultShiftStartIso = '2026-01-25T08:00:00Z';
export const defaultShiftEndIso = '2026-01-25T12:00:00Z';

const normalizeStatus = (value?: string): ShiftStatus => {
  if (!value) return 'scheduled';
  const normalized = value.toLowerCase();
  if (normalized.includes('in-progress') || normalized.includes('progress')) return 'in-progress';
  if (normalized.includes('complete')) return 'completed';
  if (normalized.includes('block')) return 'blocked';
  if (normalized === 'scheduled') return 'scheduled';
  return 'scheduled';
};

const parseIso = (value?: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
};

const normalizeTimestampPair = (date?: unknown, time?: unknown, fallback?: string): string => {
  const isoDate = parseIso(date);
  const isoTime = parseIso(time);
  if (isoDate && isoTime) {
    const combinedDate = isoDate.split('T')[0];
    const combinedTime = isoTime.includes('T') ? isoTime.split('T')[1] : isoTime;
    const combined = new Date(`${combinedDate}T${combinedTime}`);
    if (!Number.isNaN(combined.getTime())) return combined.toISOString();
  }
  if (isoDate) return isoDate;
  if (isoTime) return isoTime;
  return fallback ?? defaultShiftStartIso;
};

const pickValue = (row: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
};

const pickFirstValue = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (key in row && row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
};

export const mapShiftRecord = (raw: Record<string, unknown>): Shift => {
  const start = normalizeTimestampPair(
    pickFirstValue(raw, ['shiftStartingDate', 'shiftstartingdate', 'start_date', 'start', 'start_at']),
    pickFirstValue(raw, ['shiftStartingTime', 'shiftstartingtime', 'start_time', 'startTime']),
    defaultShiftStartIso
  );
  let end = normalizeTimestampPair(
    pickFirstValue(raw, ['shiftEndingDate', 'shiftendingdate', 'end_date', 'end', 'end_at']),
    pickFirstValue(raw, ['shiftEndingTime', 'shiftendingtime', 'end_time', 'endTime']),
    defaultShiftEndIso
  );
  end = ensureShiftEndAfterStart(start, end);
  const title =
    pickValue(raw, ['title', 'shiftTitle', 'name', 'shift_name', 'ShiftTitle']) ?? 'Shift';
  const objectMeta = raw.object as Record<string, unknown> | undefined;
  const location =
    pickValue(raw, ['location', 'address', 'shiftLocation', 'shift_location']) ??
    pickValue(raw, ['objectAddress', 'shiftAddress', 'object_address']) ??
    (objectMeta ? pickValue(objectMeta, ['address']) : undefined) ??
    'TBD';
  const objectName =
    pickValue(raw, [
      'objectTitle',
      'objectName',
      'shiftObject',
      'shiftobject',
      'shiftLocation',
      'locationName',
    ]) ?? (objectMeta ? pickValue(objectMeta, ['title']) : undefined);
  const objectAddress =
    pickValue(raw, ['objectAddress', 'shiftAddress', 'address', 'object_address']) ??
    (objectMeta ? pickValue(objectMeta, ['address']) : undefined);
  const objectContactName =
    pickValue(raw, ['objectContactName', 'contactName', 'opsName']) ??
    (objectMeta ? pickValue(objectMeta, ['contactName', 'opsName']) : undefined);
  const objectContactPhone =
    pickValue(raw, ['objectContactPhone', 'contactPhone', 'opsPhone', 'phone']) ??
    (objectMeta ? pickValue(objectMeta, ['contactPhone', 'opsPhone', 'phone']) : undefined);
  const objectContactEmail =
    pickValue(raw, ['objectContactEmail', 'contactEmail', 'opsEmail', 'email']) ??
    (objectMeta ? pickValue(objectMeta, ['contactEmail', 'opsEmail', 'email']) : undefined);
  const description = pickValue(raw, ['description', 'shiftDescription']);
  const statusValue = pickValue(raw, ['status', 'shiftStatus']) ?? 'scheduled';
  return {
    id: (typeof raw.id === 'string' && raw.id) || 'unknown',
    title,
    location,
    objectName,
    objectAddress,
    objectContactName,
    objectContactPhone,
    objectContactEmail,
    start,
    end,
    status: normalizeStatus(statusValue),
    description: description ?? undefined,
  };
};

export const sortShiftsByStart = (list: Shift[]): Shift[] =>
  [...list].sort((a, b) => {
    const aTime = Number(new Date(a.start));
    const bTime = Number(new Date(b.start));
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return aTime - bTime;
  });

export const mapShiftArray = (
  data?: Record<string, unknown>[],
  assignments?: AssignmentMeta[]
): Shift[] => {
  if (!data?.length) return [];
  const assignmentByShiftId = new Map<string, AssignmentMeta>();
  assignments?.forEach((assignment) => {
    if (assignment.shiftId) {
      assignmentByShiftId.set(assignment.shiftId, assignment);
    }
  });

  const parsed: Shift[] = [];
  data.forEach((row) => {
    const shift = mapShiftRecord(row);
    if (shift.id === 'unknown') return;
    const assignment = assignmentByShiftId.get(shift.id);
    const confirmationStatus = normalizeShiftConfirmationStatus(assignment?.confirmationStatus);
    if (!isShiftVisibleToEmployee(confirmationStatus)) {
      return;
    }
    parsed.push({
      ...shift,
      assignmentId: assignment?.assignmentId,
      confirmationStatus,
      confirmedAt: assignment?.confirmedAt,
    });
  });
  return sortShiftsByStart(parsed);
};
