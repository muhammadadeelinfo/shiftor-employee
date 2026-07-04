import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@lib/supabaseClient';
import {
  type AssignmentMeta,
  type Shift,
  mapShiftArray,
  mapShiftRecord,
} from './shiftMapping';
export type { Shift } from './shiftMapping';

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

  const confirmedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('shift_assignments')
    .update({
      confirmationStatus: 'confirmed by employee',
      confirmedAt,
    })
    .eq('id', assignmentId)
    .select('id, confirmationStatus, confirmedAt')
    .maybeSingle();

  if (error) {
    throw error;
  }

  const updatedStatus =
    typeof data?.confirmationStatus === 'string' ? data.confirmationStatus.trim().toLowerCase() : '';
  const updatedConfirmedAt =
    typeof data?.confirmedAt === 'string' ? data.confirmedAt.trim() : '';

  if (!data?.id || updatedStatus !== 'confirmed by employee' || !updatedConfirmedAt) {
    throw new Error(`Shift confirmation was not applied for assignment ${assignmentId}.`);
  }
};

type ShiftSubscription = {
  unsubscribe: () => void;
};

let shiftSubscriptionSequence = 0;

export const subscribeToShiftUpdates = (employeeId: string, onUpdate: () => void): ShiftSubscription => {
  if (!supabase || !employeeId) {
    return { unsubscribe: () => {} };
  }

  shiftSubscriptionSequence += 1;
  const assignmentChannel = supabase.channel(
    `shift_assignments:${employeeId}:${shiftSubscriptionSequence}`
  );
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
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabase
    .from('shifts')
    .select('*, object:objectId (title, address)')
    .eq('id', shiftId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapShiftRecord(data) : undefined;
};
