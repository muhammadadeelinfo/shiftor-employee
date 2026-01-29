import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@lib/supabaseClient';
import { useAuth } from '@hooks/useSupabaseAuth';
import { getShiftById, type Shift } from '@features/shifts/shiftsService';

type PostgresRealtimePayload = {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  commit_timestamp?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

const SHIFT_START_KEYS = [
  'shiftStartingDate',
  'shiftstartingdate',
  'start_date',
  'start',
  'start_at',
];
const SHIFT_END_KEYS = [
  'shiftEndingDate',
  'shiftendingdate',
  'end_date',
  'end',
  'end_at',
];
const SHIFT_LOCATION_KEYS = [
  'location',
  'address',
  'shiftLocation',
  'shift_location',
  'objectAddress',
  'shiftAddress',
  'object_address',
];

const readRowValue = (row: Record<string, unknown> | undefined, keys: string[]) => {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      if (value.trim()) return value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }
  return undefined;
};

const hasRowChange = (
  oldRow: Record<string, unknown> | undefined,
  newRow: Record<string, unknown> | undefined,
  keys: string[]
) => {
  return readRowValue(oldRow, keys) !== readRowValue(newRow, keys);
};

const formatShiftWindow = (shift?: Shift) => {
  if (!shift?.start) return undefined;
  const startDate = new Date(shift.start);
  if (Number.isNaN(startDate.getTime())) return undefined;
  const dateLabel = startDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const startLabel = startDate.toLocaleTimeString(undefined, timeOptions);
  let range = startLabel;
  if (shift.end) {
    const endDate = new Date(shift.end);
    if (!Number.isNaN(endDate.getTime())) {
      const endLabel = endDate.toLocaleTimeString(undefined, timeOptions);
      range = `${startLabel} – ${endLabel}`;
    }
  }
  return `${dateLabel} · ${range}`;
};

const buildShiftDetail = (shift?: Shift, fallbackRow?: Record<string, unknown>) => {
  const location = shift?.objectName ?? shift?.location ?? readRowValue(fallbackRow, SHIFT_LOCATION_KEYS);
  const windowLabel = formatShiftWindow(shift);
  const detailParts: string[] = [];
  if (windowLabel) {
    detailParts.push(windowLabel);
  }
  if (location) {
    detailParts.push(location);
  }
  if (detailParts.length) {
    return detailParts.join(' · ');
  }
  const fallbackParts = [];
  const start = readRowValue(fallbackRow, SHIFT_START_KEYS);
  const end = readRowValue(fallbackRow, SHIFT_END_KEYS);
  if (start || end) {
    fallbackParts.push([start, end].filter(Boolean).join(' – '));
  }
  if (location) {
    fallbackParts.push(location);
  }
  return fallbackParts.filter(Boolean).join(' · ') || 'Recent shift update';
};

const insertNotificationRow = async (employeeId: string, title: string, detail: string) => {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('notifications').insert({
      employee_id: employeeId,
      title,
      detail,
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('Failed to create shift notification', error);
  }
};

const getShiftId = (row: Record<string, unknown> | undefined) => {
  if (!row) return undefined;
  const id = row.id ?? row.shiftId ?? row.shift_id ?? row.assignmentId ?? row.assignment_id;
  if (typeof id === 'string' && id.trim()) return id;
  return undefined;
};

const buildEventKey = (shiftId: string, payload: PostgresRealtimePayload) => {
  const timestamp =
    payload.commit_timestamp ??
    (payload.new?.created_at as string | undefined) ??
    (payload.new?.updated_at as string | undefined) ??
    (payload.old?.updated_at as string | undefined) ??
    '';
  return `${shiftId}:${payload.eventType ?? 'unknown'}:${timestamp}`;
};

const shouldNotifyScheduleUpdate = (payload: PostgresRealtimePayload) => {
  if (!payload.eventType || payload.eventType.toUpperCase() !== 'UPDATE') {
    return false;
  }
  return (
    hasRowChange(payload.old, payload.new, SHIFT_START_KEYS) ||
    hasRowChange(payload.old, payload.new, SHIFT_END_KEYS) ||
    hasRowChange(payload.old, payload.new, SHIFT_LOCATION_KEYS)
  );
};

export const useShiftNotifications = (shiftIds: string[]) => {
  const { user } = useAuth();
  const employeeId = user?.id;
  const uniqueShiftIds = useMemo(() => Array.from(new Set(shiftIds.filter(Boolean))), [shiftIds]);
  const shiftFilterValue = useMemo(() => {
    if (!uniqueShiftIds.length) return '';
    return uniqueShiftIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
  }, [uniqueShiftIds]);
  const assignmentCache = useRef(new Map<string, string>());
  const shiftCache = useRef(new Map<string, string>());

  useEffect(() => {
    if (!employeeId) {
      assignmentCache.current.clear();
      shiftCache.current.clear();
    }
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId || !supabase) {
      return;
    }

    const handleAssignmentEvent = async (payload: PostgresRealtimePayload) => {
      const shiftId =
        getShiftId(payload.new) ?? getShiftId(payload.old) ?? getShiftId({ shiftId: payload.new?.shiftId });
      if (!shiftId) {
        return;
      }
      const eventKey = buildEventKey(shiftId, payload);
      if (assignmentCache.current.get(shiftId) === eventKey) {
        return;
      }
      assignmentCache.current.set(shiftId, eventKey);

      if (!payload.eventType) {
        return;
      }
      const normalizedEvent = payload.eventType.toUpperCase();
      if (normalizedEvent === 'UPDATE') {
        return;
      }

      const title = normalizedEvent === 'DELETE' ? 'Shift removed' : 'Shift published';
      const detail = buildShiftDetail(await getShiftById(shiftId), payload.new ?? payload.old);
      await insertNotificationRow(employeeId, title, detail);
    };

    const handleShiftChangeEvent = async (payload: PostgresRealtimePayload) => {
      if (!payload.eventType) {
        return;
      }

      if (!shouldNotifyScheduleUpdate(payload)) {
        return;
      }

      const shiftId = (payload.new?.id ?? payload.old?.id ?? payload.new?.shiftId ?? payload.old?.shiftId) as
        | string
        | undefined;
      if (!shiftId) {
        return;
      }

      const eventKey = buildEventKey(shiftId, payload);
      if (shiftCache.current.get(shiftId) === eventKey) {
        return;
      }
      shiftCache.current.set(shiftId, eventKey);

      const detail = buildShiftDetail(await getShiftById(shiftId), payload.new ?? payload.old);
      await insertNotificationRow(employeeId, 'Shift schedule updated', detail);
    };

    const assignmentChannel = supabase.channel(`shift-assignments-notifications:${employeeId}`);
    assignmentChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shift_assignments',
        filter: `employeeId=eq.${employeeId}`,
      },
      (payload) => {
        void handleAssignmentEvent(payload);
      }
    );
    void assignmentChannel.subscribe();

    let shiftChannel:
      | ReturnType<typeof supabase.channel>
      | null = null;
    if (shiftFilterValue) {
      shiftChannel = supabase.channel(`shift-details-notifications:${employeeId}`);
      shiftChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `id=in.(${shiftFilterValue})`,
        },
        (payload) => {
          void handleShiftChangeEvent(payload);
        }
      );
      void shiftChannel.subscribe();
    }

    return () => {
      assignmentChannel.unsubscribe();
      shiftChannel?.unsubscribe();
    };
  }, [employeeId, shiftFilterValue]);
};
