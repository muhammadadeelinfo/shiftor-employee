import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getShifts,
  subscribeToShiftUpdates,
  confirmShiftAssignment,
} from '@features/shifts/shiftsService';
import type { Shift } from '@features/shifts/shiftsService';
import { ShiftCard } from '@shared/components/ShiftCard';
import { useLocation } from '@hooks/useLocation';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useSupabaseAuth';
import { PrimaryButton } from '@shared/components/PrimaryButton';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString([], { month: 'long', year: 'numeric' });

const getTimeLabel = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const getCalendarWeeks = (date: Date) => {
  const weeks: Date[][] = [];
  const monthStart = startOfMonth(date);
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  do {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === monthStart.getMonth());

  return weeks;
};

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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

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

  const calendarWeeks = useMemo(() => getCalendarWeeks(visibleMonth), [visibleMonth]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    filteredShifts.forEach((shift) => {
      const shiftDate = new Date(shift.start);
      if (Number.isNaN(shiftDate.getTime())) return;
      const key = shiftDate.toISOString().split('T')[0];
      const bucket = map.get(key) ?? [];
      bucket.push(shift);
      bucket.sort((a, b) => Number(new Date(a.start)) - Number(new Date(b.start)));
      map.set(key, bucket);
    });
    return map;
  }, [filteredShifts]);

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

  const errorView = error ? (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>Shift sync failed</Text>
      <Text style={styles.errorText}>
        {error.message ?? 'We could not load your assignments right now. Retry or contact support if the issue persists.'}
      </Text>
      <PrimaryButton title="Retry sync" onPress={() => refetch()} style={styles.retryButton} />
    </View>
  ) : null;

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
      <View style={styles.viewSwitcher}>
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewButtonText, viewMode === 'list' && styles.viewButtonTextActive]}>
            List view
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'calendar' && styles.viewButtonActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Text
            style={[styles.viewButtonText, viewMode === 'calendar' && styles.viewButtonTextActive]}
          >
            Calendar view
          </Text>
        </TouchableOpacity>
      </View>
      {errorView}
      {viewMode === 'list' ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
        >
          {!error &&
            filteredShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                onPress={() => router.push(`/shift-details/${shift.id}`)}
                onConfirm={shift.assignmentId ? () => handleConfirm(shift.assignmentId) : undefined}
                confirmLoading={shift.assignmentId ? confirmingId === shift.assignmentId : false}
              />
            ))}
          {!filteredShifts.length && !isLoading && !error ? (
            <Text style={styles.empty}>No shifts scheduled for {getMonthLabel(visibleMonth)}.</Text>
          ) : null}
        </ScrollView>
      ) : (
        !error && (
          <View style={styles.calendarWrapper}>
            <View style={styles.calendarHeader}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.calendarHeaderLabel}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.calendarWeeks}>
              {calendarWeeks.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
                  {week.map((day) => {
                    const key = day.toISOString().split('T')[0];
                    const dayShifts = shiftsByDay.get(key) ?? [];
                    const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                    return (
                      <View
                        key={key}
                        style={[
                          styles.calendarCell,
                          !isCurrentMonth && styles.calendarCellMuted,
                          dayShifts.length && styles.calendarCellActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarCellNumber,
                            !isCurrentMonth && styles.calendarCellNumberMuted,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                        {dayShifts.length ? (
                          <>
                            {dayShifts.slice(0, 2).map((shift) => (
                              <Pressable
                                key={shift.id}
                                style={styles.calendarShiftRow}
                                onPress={() => router.push(`/shift-details/${shift.id}`)}
                              >
                                <Text style={styles.calendarShiftTime}>
                                  {getTimeLabel(shift.start)} – {getTimeLabel(shift.end)}
                                </Text>
                                <Text style={styles.calendarShiftTitle}>{shift.title}</Text>
                              </Pressable>
                            ))}
                            {dayShifts.length > 2 && (
                              <Text style={styles.calendarShiftMore}>
                                +{dayShifts.length - 2} more
                              </Text>
                            )}
                          </>
                        ) : (
                          <Text style={styles.calendarEmptyText}>No shifts</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )
      )}
      {viewMode === 'calendar' && !filteredShifts.length && !isLoading && !error ? (
        <Text style={styles.empty}>No shifts scheduled for {getMonthLabel(visibleMonth)}.</Text>
      ) : null}
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
  viewSwitcher: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'center',
  },
  viewButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  viewButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  viewButtonText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  viewButtonTextActive: {
    color: '#fff',
  },
  calendarWrapper: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  calendarWeeks: {
    marginTop: 8,
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarCell: {
    flex: 1,
    minHeight: 110,
    margin: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
  },
  calendarCellMuted: {
    backgroundColor: '#f8fafc',
  },
  calendarCellActive: {
    borderColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarCellNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  calendarCellNumberMuted: {
    color: '#94a3b8',
  },
  calendarShiftRow: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 6,
    marginBottom: 4,
  },
  calendarShiftTime: {
    fontSize: 11,
    color: '#475569',
  },
  calendarShiftTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  calendarShiftMore: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
  },
  calendarEmptyText: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
