import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getShifts, subscribeToShiftUpdates, confirmShiftAssignment } from '../../services/shifts';
import { ShiftCard } from '../../components/ShiftCard';
import { useLocation } from '../../hooks/useLocation';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useSupabaseAuth';
import { PrimaryButton } from '../../components/PrimaryButton';

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
          shiftList.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onPress={() => router.push(`/shift-details/${shift.id}`)}
              onConfirm={shift.assignmentId ? () => handleConfirm(shift.assignmentId) : undefined}
              confirmLoading={shift.assignmentId ? confirmingId === shift.assignmentId : false}
            />
          ))
        )}
        {!shiftList.length && !isLoading && !error ? <Text style={styles.empty}>No shifts scheduled.</Text> : null}
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
});
