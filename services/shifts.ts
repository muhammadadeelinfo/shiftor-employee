import { supabase } from '../lib/supabaseClient';

type ShiftStatus = 'scheduled' | 'in-progress' | 'completed' | 'blocked';

export type Shift = {
  id: string;
  title: string;
  location: string;
  start: string;
  end: string;
  status: ShiftStatus;
  description?: string;
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

export const getShifts = async (): Promise<Shift[]> => {
  try {
    const { data, error } = await supabase
      .from<Shift>('shifts')
      .select('id,title,location,start,end,status,description')
      .order('start', { ascending: true });

    if (error) {
      throw error;
    }

    return (data && data.length ? data : fallbackShifts) as Shift[];
  } catch (error) {
    console.warn('Shifts fetch failed, using fallback data', error);
    return fallbackShifts;
  }
};

export const getShiftById = async (shiftId: string): Promise<Shift | undefined> => {
  try {
    const { data, error } = await supabase
      .from<Shift>('shifts')
      .select('id,title,location,start,end,status,description')
      .eq('id', shiftId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) return data;
  } catch (error) {
    console.warn('Shift detail fetch failed', error);
  }

  return fallbackShifts.find((shift) => shift.id === shiftId) ?? fallbackShifts[0];
};
