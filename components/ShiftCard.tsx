import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Shift } from '../services/shifts';

const statusColors: Record<string, string> = {
  scheduled: '#2563eb',
  'in-progress': '#059669',
  completed: '#6b7280',
  blocked: '#dc2626',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type Props = {
  shift: Shift;
  onPress?: () => void;
};

export const ShiftCard = ({ shift, onPress }: Props) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{shift.title}</Text>
        <View style={[styles.status, { borderColor: statusColors[shift.status] ?? '#000' }]}>
          <Text style={[styles.statusText, { color: statusColors[shift.status] ?? '#000' }]}>
            {shift.status.replace(/\b\w/g, (char) => char.toUpperCase())}
          </Text>
        </View>
      </View>
      <Text style={styles.timeLine}>
        {formatTime(shift.start)} – {formatTime(shift.end)}
      </Text>
      <Text style={styles.location}>{shift.location}</Text>
      {shift.description ? <Text style={styles.description}>{shift.description}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeLine: {
    color: '#4b5563',
    fontSize: 14,
  },
  location: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  description: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
});
