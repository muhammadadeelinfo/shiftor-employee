import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useNotifications } from '@shared/context/NotificationContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useQuery } from '@tanstack/react-query';
import { getShifts, Shift } from '@features/shifts/shiftsService';

const shiftStatusColors: Record<Shift['status'], string> = {
  scheduled: '#2563eb',
  'in-progress': '#059669',
  completed: '#6b7280',
  blocked: '#dc2626',
};

const stageColorMap: Record<string, string> = {
  production: '#22c55e',
  staging: '#f97316',
  development: '#38bdf8',
};

const stageLabelMap: Record<string, string> = {
  production: 'Live',
  staging: 'Preview',
  development: 'Dev',
};

export const TopBar = () => {
  const insets = useSafeAreaInsets();
  const { toggle } = useNotifications();
  const { user } = useAuth();
  const stage = Constants.expoConfig?.extra?.expoStage ?? 'development';
  const stageColor = stageColorMap[stage] ?? '#38bdf8';
  const stageLabel = stageLabelMap[stage] ?? 'Dev';

  const { data: shifts } = useQuery({
    queryKey: ['topbar-next-shift', user?.id],
    queryFn: () => getShifts(user?.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const nextShift = shifts?.find((shift) => new Date(shift.start).getTime() > Date.now()) ?? shifts?.[0];
  const shiftStatusColor = nextShift
    ? shiftStatusColors[nextShift.status] ?? '#2563eb'
    : '#94a3b8';

  const formatDate = (iso: string | undefined) => {
    if (!iso) return '—';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTimeRange = (start: string | undefined, end: string | undefined) => {
    if (!start || !end) return '—';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '—';
    return `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  };

  const firstName =
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.user_metadata?.name ??
    user?.email ??
    'there';
  const statusLabel = nextShift
    ? nextShift.status === 'in-progress'
      ? 'On shift'
      : nextShift.status === 'blocked'
      ? 'Blocked'
      : nextShift.status === 'completed'
      ? 'Completed'
      : 'Scheduled'
    : 'Awaiting schedule';

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.leftGroup}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#1d4ed8" />
          </View>
          <View style={styles.titleGroup}>
            <Text style={styles.title}>Good to see you, {firstName}</Text>
            <Text style={styles.subtitle}>
              {nextShift
                ? `${formatDate(nextShift.start)} · ${formatTimeRange(nextShift.start, nextShift.end)}`
                : 'No shifts scheduled yet'}
            </Text>
            <Text style={styles.locationText}>
              {nextShift
                ? nextShift.objectName ?? nextShift.location ?? 'Location TBD'
                : 'We’ll let you know once the next assignment is ready.'}
            </Text>
          </View>
        </View>
        <View style={styles.rightGroup}>
          <View style={[styles.stageChip, { borderColor: stageColor }]}>
            <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
            <Text style={[styles.stageText, { color: stageColor }]}>{stageLabel}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { borderColor: shiftStatusColor, backgroundColor: `${shiftStatusColor}1A` },
            ]}
          >
            <View style={[styles.statusIndicator, { backgroundColor: shiftStatusColor }]} />
            <Text style={[styles.statusText, { color: shiftStatusColor }]}>{statusLabel}</Text>
          </View>
          <Pressable style={[styles.iconButton, styles.notificationButton]} onPress={toggle}>
            <Ionicons name="notifications-outline" size={20} color="#0f172a" />
            <View style={[styles.notificationDot, styles.redDot]} />
          </Pressable>
          <Pressable style={[styles.iconButton, styles.secondaryButton]}>
            <Ionicons name="person-circle-outline" size={22} color="#0f172a" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  bar: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    justifyContent: 'center',
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#475569',
    fontSize: 12,
  },
  locationText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    marginTop: 2,
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    gap: 6,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: '#fff',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  redDot: {
    backgroundColor: '#ef4444',
    borderColor: '#fef2f2',
  },
});
