import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getShifts,
  subscribeToShiftUpdates,
  type Shift,
} from '@features/shifts/shiftsService';
import { useAuth } from '@hooks/useSupabaseAuth';
import { loadCachedShiftFeed, saveCachedShiftFeed, type CachedShiftFeed } from './shiftCache';

const orderShiftsByStart = (shifts?: Shift[]) => {
  if (!shifts?.length) return [];
  return [...shifts]
    .filter((shift) => {
      const startDate = new Date(shift.start);
      return !Number.isNaN(startDate.getTime());
    })
    .sort((a, b) => Number(new Date(a.start)) - Number(new Date(b.start)));
};

export const useShiftFeed = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [cachedFeed, setCachedFeed] = useState<CachedShiftFeed | null>(null);

  const query = useQuery({
    queryKey: ['shifts', userId],
    queryFn: () => getShifts(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    let isActive = true;
    loadCachedShiftFeed(userId)
      .then((nextCachedFeed) => {
        if (isActive) {
          setCachedFeed(nextCachedFeed);
        }
      })
      .catch(() => {
        if (isActive) {
          setCachedFeed(null);
        }
      });
    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !query.data) return;
    saveCachedShiftFeed(userId, query.data)
      .then((nextCachedFeed) => setCachedFeed(nextCachedFeed))
      .catch((error) => {
        console.warn('Failed to cache shift feed', error);
      });
  }, [query.data, userId]);

  useEffect(() => {
    if (!userId) return;
    const subscription = subscribeToShiftUpdates(userId, () => query.refetch());
    return () => subscription.unsubscribe();
  }, [userId, query.refetch]);

  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => query.refetch(), 120000);
    return () => clearInterval(timer);
  }, [userId, query.refetch]);

  const shouldUseCachedFeed =
    Boolean(userId) && !query.data?.length && Boolean(cachedFeed?.shifts.length) && Boolean(query.error);
  const displayedShifts = shouldUseCachedFeed ? cachedFeed?.shifts : query.data;
  const orderedShifts = useMemo(() => orderShiftsByStart(displayedShifts), [displayedShifts]);

  return {
    ...query,
    orderedShifts,
    isUsingCachedShifts: shouldUseCachedFeed,
    cachedShiftsAt: shouldUseCachedFeed ? cachedFeed?.cachedAt ?? null : null,
  };
};
