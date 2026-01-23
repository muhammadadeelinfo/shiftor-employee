import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@lib/supabaseClient';

type ShiftStatus = 'scheduled' | 'in-progress' | 'completed' | 'blocked';

type AssignmentMeta = {
  assignmentId?: string;
  shiftId?: string;
  confirmationStatus?: string;
  confirmedAt?: string;
};

export type Shift = {
  id: string;
  title: string;
  location: string;
  start: string;
  end: string;
  status: ShiftStatus;
  description?: string;
  assignmentId?: string;
  confirmationStatus?: string;
  confirmedAt?: string;
};

const fallbackShifts: Shift[] = [
  {
    id: 'shift-1',
    title: 'Morning Lobby Coverage',
    location: 'Headquarters Lobby',
    start: '2026-01-25T08:00:00Z',
    end: '2026-01-25T12:00:00Z',
    status: 'scheduled',
    description: 'Greet visitors, issue badges, and keep the area tidy.',
  },
  {
    id: 'shift-2',
    title: 'Warehouse AMS Team',
    location: 'Warehouse B',
    start: '2026-01-24T16:00:00Z',
    end: '2026-01-24T20:00:00Z',
    status: 'in-progress',
    description: 'Cycle-count oversight and loading dock coordination.',
  },
];

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
  return fallback ?? fallbackShifts[0].start;
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

const mapShiftRecord = (raw: Record<string, unknown>): Shift => {
  const start = normalizeTimestampPair(
    pickFirstValue(raw, ['shiftStartingDate', 'start_date', 'start', 'start_at']),
    pickFirstValue(raw, ['shiftStartingTime', 'start_time', 'startTime']),
    fallbackShifts[0].start
  );
  const end = normalizeTimestampPair(
    pickFirstValue(raw, ['shiftEndingDate', 'end_date', 'end', 'end_at']),
    pickFirstValue(raw, ['shiftEndingTime', 'end_time', 'endTime']),
    fallbackShifts[0].end
  );
  const title =
    pickValue(raw, ['title', 'shiftTitle', 'name', 'shift_name']) ?? 'Shift';
  const location =
    pickValue(raw, ['location', 'address', 'shiftLocation', 'objectAddress', 'objectTitle']) ?? 'TBD';
  const description = pickValue(raw, ['description', 'shiftDescription']);
  const statusValue = pickValue(raw, ['status', 'shiftStatus']) ?? 'scheduled';
  return {
    id: (typeof raw.id === 'string' && raw.id) || 'unknown',
    title,
    location,
    start,
    end,
    status: normalizeStatus(statusValue),
    description: description ?? undefined,
  };
};

const isVisibleShiftRecord = (raw: Record<string, unknown>) => {
  const publishStatus = pickValue(raw, ['status', 'shiftStatus', 'publicationStatus', 'publishStatus']);
  if (!publishStatus) {
    return true;
  }
  return publishStatus.toLowerCase() !== 'pending';
};

const sortShiftsByStart = (list: Shift[]): Shift[] =>
  [...list].sort((a, b) => {
    const aTime = Number(new Date(a.start));
    const bTime = Number(new Date(b.start));
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return aTime - bTime;
  });

const mapShiftArray = (
  data?: Record<string, unknown>[],
  assignments?: AssignmentMeta[]
): Shift[] => {
  if (!data?.length) return [];
  const visibleRows = data.filter(isVisibleShiftRecord);
  if (!visibleRows.length) return [];
  const assignmentByShiftId = new Map<string, AssignmentMeta>();
  assignments?.forEach((assignment) => {
    if (assignment.shiftId) {
      assignmentByShiftId.set(assignment.shiftId, assignment);
    }
  });

  const parsed = visibleRows
    .map((row) => {
      const shift = mapShiftRecord(row);
      if (shift.id === 'unknown') return undefined;
      const assignment = assignmentByShiftId.get(shift.id);
      return {
        ...shift,
        assignmentId: assignment?.assignmentId,
        confirmationStatus: assignment?.confirmationStatus,
        confirmedAt: assignment?.confirmedAt,
      };
    })
    .filter((shift): shift is Shift => Boolean(shift));
  return sortShiftsByStart(parsed);
};

const isMissingColumnError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as PostgrestError).code === '42703';

const tryFetchShiftAssignments = async (employeeId: string): Promise<AssignmentMeta[]> => {
  const { data, error } = await supabase
    .from('shift_assignments')
    .select('id, shiftId, confirmationStatus, confirmedAt')
    .eq('employeeId', employeeId);

  if (error) {
    if (isMissingColumnError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row) => ({
    assignmentId: typeof row.id === 'string' ? row.id : undefined,
    shiftId: typeof row.shiftId === 'string' ? row.shiftId : undefined,
    confirmationStatus: typeof row.confirmationStatus === 'string' ? row.confirmationStatus : undefined,
    confirmedAt: typeof row.confirmedAt === 'string' ? row.confirmedAt : undefined,
  }));
};

const tryFetchShiftsByIds = async (ids: string[]): Promise<Record<string, unknown>[]> => {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('shifts').select('*').in('id', ids);

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchShiftAssignments = async (employeeId?: string): Promise<Shift[]> => {
  if (!employeeId) {
    return [];
  }

  const assignments = await tryFetchShiftAssignments(employeeId);
  const ids = assignments
    .map((assignment) => assignment.shiftId)
    .filter((shiftId): shiftId is string => Boolean(shiftId));

  if (!ids.length) {
    return [];
  }

  const shiftRows = await tryFetchShiftsByIds(ids);
  return mapShiftArray(shiftRows, assignments);
};

export const getShifts = async (employeeId?: string): Promise<Shift[]> => {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  return await fetchShiftAssignments(employeeId);
};

export const confirmShiftAssignment = async (assignmentId: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabase
    .from('shift_assignments')
    .update({
      confirmationStatus: 'confirmed',
      confirmedAt: new Date().toISOString(),
    })
    .eq('id', assignmentId);

  if (error) {
    throw error;
  }
};

type ShiftSubscription = {
  unsubscribe: () => void;
};

export const subscribeToShiftUpdates = (employeeId: string, onUpdate: () => void): ShiftSubscription => {
  if (!supabase || !employeeId) {
    return { unsubscribe: () => {} };
  }

  const assignmentChannel = supabase.channel(`shift_assignments:${employeeId}`);
  assignmentChannel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'shift_assignments',
      filter: `employeeId=eq.${employeeId}`,
    },
    () => onUpdate()
  );

  assignmentChannel.subscribe();

  return {
    unsubscribe: () => assignmentChannel.unsubscribe(),
  };
};

export const getShiftById = async (shiftId: string): Promise<Shift | undefined> => {
  if (!supabase) {
    return fallbackShifts.find((shift) => shift.id === shiftId) ?? fallbackShifts[0];
  }

  try {
    const { data, error } = await supabase.from('shifts').select('*').eq('id', shiftId).maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return mapShiftRecord(data);
    }
  } catch (error) {
    console.warn('Shift detail fetch failed', error);
  }

  return fallbackShifts.find((shift) => shift.id === shiftId) ?? fallbackShifts[0];
};
