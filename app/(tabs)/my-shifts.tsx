import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getShifts } from '../../services/shifts';
import { ShiftCard } from '../../components/ShiftCard';
import { useLocation } from '../../hooks/useLocation';
import { useRouter } from 'expo-router';

export default function MyShiftsScreen() {
  const { data: shifts, isLoading, refetch } = useQuery({
    queryKey: ['shifts'],
    queryFn: getShifts,
  });
  const { location, status } = useLocation();
  const router = useRouter();

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
        {(shifts ?? []).map((shift) => (
          <ShiftCard key={shift.id} shift={shift} onPress={() => router.push(`/shift-details/${shift.id}`)} />
        ))}
        {!shifts?.length && !isLoading ? <Text style={styles.empty}>No shifts scheduled.</Text> : null}
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
});
