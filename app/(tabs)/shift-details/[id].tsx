import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'expo-router';
import { getShiftById } from '../../../services/shifts';
import { PrimaryButton } from '../../../components/PrimaryButton';

export default function ShiftDetailsScreen() {
  const { id } = useSearchParams();
  const shiftId = Array.isArray(id) ? id[0] : id;

  const { data: shift, isLoading, refetch } = useQuery({
    queryKey: ['shift', shiftId],
    queryFn: () => (shiftId ? getShiftById(shiftId) : Promise.resolve(undefined)),
    enabled: Boolean(shiftId),
  });
  const router = useRouter();

  if (!shiftId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Unable to determine which shift to load.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!shift) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Shift not found. Pull to retry.</Text>
        <PrimaryButton title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{shift.title}</Text>
      <Text style={styles.meta}>{shift.location}</Text>
      <Text style={styles.meta}>
        {new Date(shift.start).toLocaleString()} — {new Date(shift.end).toLocaleString()}
      </Text>
      {shift.description ? <Text style={styles.description}>{shift.description}</Text> : null}
      <PrimaryButton title="Clock in with QR" onPress={() => router.push('/qr-clock-in')} style={styles.cta} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: '#374151',
    fontSize: 16,
    marginBottom: 2,
  },
  description: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
    fontWeight: '600',
  },
  cta: {
    marginTop: 24,
  },
});
