import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Shift } from '@features/shifts/shiftsService';
import { PrimaryButton } from '@shared/components/PrimaryButton';

const statusColors: Record<string, string> = {
  scheduled: '#2563eb',
  'in-progress': '#059669',
  completed: '#6b7280',
  blocked: '#dc2626',
};

const formatTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatDate = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatDateTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '—';
  }
  const minutes = Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const hoursText = hours ? `${hours}h ` : '';
  const minutesText = remainder ? `${remainder}m` : '';
  return `${hoursText}${minutesText}`.trim() || '—';
};

const truncateText = (value: string, maxLength = 36) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
};

type Props = {
  shift: Shift;
  onPress?: () => void;
  onConfirm?: () => void;
  confirmLoading?: boolean;
};

export const ShiftCard = ({ shift, onPress, onConfirm, confirmLoading }: Props) => {
  const headerStatus = shift.status.replace(/\b\w/g, (char) => char.toUpperCase());
  const detailRows = [
    {
      icon: 'location',
      label: 'Location',
      title: shift.objectName ?? shift.location ?? 'TBD',
      subtitle: shift.objectAddress ?? shift.location ?? undefined,
    },
  ];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{shift.title}</Text>
            <Text style={styles.caption}>{formatDate(shift.start)}</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColors[shift.status] ?? '#c7d2fe' }]}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: statusColors[shift.status] ?? '#93c5fd' },
              ]}
            />
            <Text style={[styles.statusText, { color: statusColors[shift.status] ?? '#1d4ed8' }]}>
              {headerStatus}
            </Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <View>
            <Text style={styles.timeLabel}>Shift window</Text>
            <Text style={styles.timeValue}>
              {formatTime(shift.start)} – {formatTime(shift.end)}
            </Text>
          </View>
          <Text style={styles.duration}>{formatDuration(shift.start, shift.end)}</Text>
        </View>

        <View style={styles.detailRows}>
          {detailRows.map((detail) => (
            <View key={detail.label} style={styles.detailRow}>
              <Ionicons name={detail.icon as any} size={16} color="#94a3b8" style={styles.detailIcon} />
              <View>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text style={styles.detailValue}>{detail.title}</Text>
                {detail.subtitle ? (
                  <Text style={styles.detailSubtitle} numberOfLines={1} ellipsizeMode="tail">
                    {truncateText(detail.subtitle)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {shift.description ? <Text style={styles.description}>{shift.description}</Text> : null}

        {shift.assignmentId && (
          <View style={styles.confirmSection}>
            {shift.confirmationStatus?.toLowerCase() === 'confirmed' ? (
              <Text style={styles.confirmedText}>Confirmed</Text>
            ) : (
              onConfirm && (
                <PrimaryButton
                  title="Confirm shift"
                  onPress={onConfirm}
                  loading={confirmLoading}
                  style={styles.confirmButton}
                />
              )
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
  },
  accent: {
    width: 4,
    backgroundColor: '#2563eb',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  caption: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  duration: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailRows: {
    marginTop: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailIcon: {
    width: 20,
  },
  detailLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  detailSubtitle: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  description: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  confirmationMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  confirmSection: {
    marginTop: 12,
  },
  confirmButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },
  confirmedText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
});
