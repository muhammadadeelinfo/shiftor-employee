import type { Shift } from '@features/shifts/shiftMapping';

type ParsedQrPayload = {
  shiftId?: string;
  assignmentId?: string;
};

const compactPayload = (payload: ParsedQrPayload): ParsedQrPayload => {
  const next: ParsedQrPayload = {};
  if (payload.shiftId) next.shiftId = payload.shiftId;
  if (payload.assignmentId) next.assignmentId = payload.assignmentId;
  return next;
};

const normalizeToken = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const readJsonPayload = (rawValue: string): ParsedQrPayload | null => {
  if (!rawValue.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    return compactPayload({
      shiftId: normalizeToken(parsed.shiftId ?? parsed.shift_id),
      assignmentId: normalizeToken(parsed.assignmentId ?? parsed.assignment_id),
    });
  } catch {
    return null;
  }
};

const readUrlPayload = (rawValue: string): ParsedQrPayload | null => {
  try {
    const parsed = new URL(rawValue);
    return compactPayload({
      shiftId: normalizeToken(parsed.searchParams.get('shiftId') ?? parsed.searchParams.get('shift_id')),
      assignmentId: normalizeToken(
        parsed.searchParams.get('assignmentId') ?? parsed.searchParams.get('assignment_id')
      ),
    });
  } catch {
    return null;
  }
};

const readPrefixedPayload = (rawValue: string): ParsedQrPayload => {
  const [prefix, ...rest] = rawValue.split(':');
  if (!rest.length) return {};

  const value = normalizeToken(rest.join(':'));
  if (!value) return {};

  switch (prefix.trim().toLowerCase()) {
    case 'shift':
    case 'shiftid':
      return compactPayload({ shiftId: value });
    case 'assignment':
    case 'assignmentid':
      return compactPayload({ assignmentId: value });
    default:
      return {};
  }
};

export const parseQrClockInCode = (rawValue: string): ParsedQrPayload => {
  const normalized = rawValue.trim();
  if (!normalized) return {};

  const jsonPayload = readJsonPayload(normalized);
  if (jsonPayload && (jsonPayload.shiftId || jsonPayload.assignmentId)) {
    return jsonPayload;
  }

  const urlPayload = readUrlPayload(normalized);
  if (urlPayload && (urlPayload.shiftId || urlPayload.assignmentId)) {
    return urlPayload;
  }

  const prefixedPayload = readPrefixedPayload(normalized);
  if (prefixedPayload.shiftId || prefixedPayload.assignmentId) {
    return prefixedPayload;
  }

  return compactPayload({
    shiftId: normalized,
  });
};

export const findShiftForQrClockIn = (rawValue: string, shifts: Shift[]): Shift | null => {
  const parsed = parseQrClockInCode(rawValue);

  if (parsed.assignmentId) {
    const byAssignmentId = shifts.find((shift) => shift.assignmentId === parsed.assignmentId);
    if (byAssignmentId) return byAssignmentId;
  }

  if (parsed.shiftId) {
    const byShiftId = shifts.find((shift) => shift.id === parsed.shiftId);
    if (byShiftId) return byShiftId;
  }

  return null;
};
