import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getShifts, subscribeToShiftUpdates, confirmShiftAssignment } from '@features/shifts/shiftsService';
import { ShiftCard } from '@shared/components/ShiftCard';
import { useLocation } from '@hooks/useLocation';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useSupabaseAuth';
import { PrimaryButton } from '@shared/components/PrimaryButton';

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString([], { month: 'long', year: 'numeric' });

export default function MyShiftsScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const { location, status } = useLocation();
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { data: shifts, isLoading, error, refetch } = useQuery({
    queryKey: ['shifts', userId],
    queryFn: () => getShifts(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
  const shiftList = shifts ?? [];
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));

  const filteredShifts = useMemo(() => {
    const monthStart = visibleMonth;
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    return shiftList.filter((shift) => {
      const shiftDate = new Date(shift.start);
      if (Number.isNaN(shiftDate.getTime())) {
        return false;
      }
      return shiftDate >= monthStart && shiftDate < nextMonth;
    });
  }, [shiftList, visibleMonth]);

  const handleMonthChange = (offset: number) => {
    setVisibleMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
      return next;
    });
  };

  useEffect(() => {
    if (!userId) return;
    const subscription = subscribeToShiftUpdates(userId, () => refetch());
    return () => subscription.unsubscribe();
  }, [userId, refetch]);

  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => refetch(), 120000);
    return () => clearInterval(timer);
  }, [userId, refetch]);

  const handleConfirm = async (assignmentId: string) => {
    try {
      setConfirmingId(assignmentId);
      await confirmShiftAssignment(assignmentId);
      await refetch();
    } catch (err) {
      console.error('Shift confirmation failed', err);
    } finally {
      setConfirmingId((current) => (current === assignmentId ? null : current));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Upcoming Shifts</Text>
        <Text style={styles.subLabel}>
          {status === 'granted'
            ? `Location: ${location?.coords.latitude.toFixed(2)}, ${location?.coords.longitude.toFixed(2)}`
            : 'Enable location to see nearby shifts'}
        </Text>
      </View>
      <View style={styles.monthSwitcher}>
        <TouchableOpacity style={styles.monthButton} onPress={() => handleMonthChange(-1)}>
          <Text style={styles.monthButtonText}>← Previous</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{getMonthLabel(visibleMonth)}</Text>
        <TouchableOpacity style={styles.monthButton} onPress={() => handleMonthChange(1)}>
          <Text style={styles.monthButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Shift sync failed</Text>
            <Text style={styles.errorText}>
              {error.message ?? 'We could not load your assignments right now. Retry or contact support if the issue persists.'}
            </Text>
            <PrimaryButton title="Retry sync" onPress={() => refetch()} style={styles.retryButton} />
          </View>
        ) : (
          filteredShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onPress={() => router.push(`/shift-details/${shift.id}`)}
              onConfirm={shift.assignmentId ? () => handleConfirm(shift.assignmentId) : undefined}
              confirmLoading={shift.assignmentId ? confirmingId === shift.assignmentId : false}
            />
          ))
        )}
        {!filteredShifts.length && !isLoading && !error ? (
          <Text style={styles.empty}>No shifts scheduled for {getMonthLabel(visibleMonth)}.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  label: {
    fontSize: 20,
    fontWeight: '700',
  },
  subLabel: {
    color: '#6b7280',
    marginTop: 4,
  },
  list: {
    paddingBottom: 24,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    color: '#9ca3af',
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 10,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },
  monthSwitcher: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthButton: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    marginHorizontal: 4,
  },
  monthButtonText: {
    color: '#1e40af',
    fontWeight: '600',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
});
