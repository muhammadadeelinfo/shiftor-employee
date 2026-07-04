import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Shift } from './shiftMapping';

export type CachedShiftFeed = {
  shifts: Shift[];
  cachedAt: string;
};

const SHIFT_CACHE_PREFIX = 'shiftor:shift-feed';

const cacheKey = (employeeId: string) => `${SHIFT_CACHE_PREFIX}:${employeeId}`;

const isShift = (value: unknown): value is Shift => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<Shift>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.location === 'string' &&
    typeof entry.start === 'string' &&
    typeof entry.end === 'string' &&
    typeof entry.status === 'string'
  );
};

export const parseCachedShiftFeed = (value: string | null): CachedShiftFeed | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CachedShiftFeed>;
    if (
      !parsed ||
      typeof parsed.cachedAt !== 'string' ||
      !Array.isArray(parsed.shifts) ||
      !parsed.shifts.every(isShift)
    ) {
      return null;
    }
    return {
      cachedAt: parsed.cachedAt,
      shifts: parsed.shifts,
    };
  } catch {
    return null;
  }
};

export const loadCachedShiftFeed = async (employeeId?: string | null): Promise<CachedShiftFeed | null> => {
  if (!employeeId) return null;
  return parseCachedShiftFeed(await AsyncStorage.getItem(cacheKey(employeeId)));
};

export const saveCachedShiftFeed = async (employeeId: string, shifts: Shift[]) => {
  const payload: CachedShiftFeed = {
    shifts,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(cacheKey(employeeId), JSON.stringify(payload));
  return payload;
};
