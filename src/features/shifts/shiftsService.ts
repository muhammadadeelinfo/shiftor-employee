import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@lib/supabaseClient';
import {
  type AssignmentMeta,
  type Shift,
  mapShiftArray,
  mapShiftRecord,
} from './shiftMapping';

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

const isMissingColumnError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as PostgrestError).code === '42703';

const tryFetchShiftAssignments = async (employeeId: string): Promise<AssignmentMeta[]> => {
  if (!supabase) return [];
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
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shifts')
    .select('*, object:objectId (title, address)')
    .in('id', ids);

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
    const { data, error } = await supabase
      .from('shifts')
      .select('*, object:objectId (title, address)')
      .eq('id', shiftId)
      .maybeSingle();

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
