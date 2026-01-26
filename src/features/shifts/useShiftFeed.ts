import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getShifts,
  subscribeToShiftUpdates,
  type Shift,
} from '@features/shifts/shiftsService';
import { useAuth } from '@hooks/useSupabaseAuth';

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

  const query = useQuery({
    queryKey: ['shifts', userId],
    queryFn: () => getShifts(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

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

  const orderedShifts = useMemo(() => orderShiftsByStart(query.data), [query.data]);

  return {
    ...query,
    orderedShifts,
  };
};
