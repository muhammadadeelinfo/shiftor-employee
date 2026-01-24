import {
  Animated,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
import { getShiftPhase, phaseMeta, ShiftPhase } from '@shared/utils/shiftPhase';

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

const dayKey = (date: Date) => date.toISOString().split('T')[0];

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
  const calendarFlip = useRef(new Animated.Value(0)).current;
  const rotateY = calendarFlip.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ['-90deg', '0deg', '90deg'],
  });
  const todayKey = useMemo(() => dayKey(new Date()), []);

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

  const showSkeletons = isLoading && !filteredShifts.length && !error;
  const now = new Date();
  const liveShift = filteredShifts.find((shift) => getShiftPhase(shift.start, shift.end, now) === 'live');
  const nextShift = filteredShifts.find((shift) => new Date(shift.start) > now);
  const focusedShiftId = liveShift?.id ?? nextShift?.id;
  const focusedDayKey = filteredShifts
    .find((shift) => shift.id === focusedShiftId)
    ?.start.split('T')[0];
  const dayPhaseMap = useMemo(() => {
    const map = new Map<string, ShiftPhase>();
    filteredShifts.forEach((shift) => {
      const key = shift.start.split('T')[0];
      const phase = getShiftPhase(shift.start, shift.end, now);
      const existing = map.get(key);
      if (!existing || existing === 'past' || (existing === 'upcoming' && phase === 'live')) {
        map.set(key, phase);
      }
    });
    return map;
  }, [filteredShifts, now]);

  const renderSkeletons = () => (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={`skeleton-${index}`} style={styles.skeletonCard}>
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonLineShort} />
        </View>
      ))}
    </View>
  );

  const renderListEmptyState = () => (
    <View style={styles.listEmptyState}>
      <Text style={styles.emptyTitle}>No shifts scheduled for {getMonthLabel(visibleMonth)}.</Text>
      <Text style={styles.emptySubtitle}>
        Check back soon or refresh to see new assignments that match your availability.
      </Text>
      <PrimaryButton title="Refresh shifts" onPress={() => refetch()} style={styles.emptyAction} />
    </View>
  );

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

  const handleMonthChange = useCallback((offset: number) => {
    Animated.timing(calendarFlip, {
      toValue: 90,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
      calendarFlip.setValue(-90);
      Animated.timing(calendarFlip, {
        toValue: 0,
        duration: 220,
        easing: undefined,
        useNativeDriver: true,
      }).start();
    });
  }, [calendarFlip]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => viewMode === 'calendar',
        onMoveShouldSetPanResponder: (_, gestureState) =>
          viewMode === 'calendar' &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20,
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) < 35) {
            return;
          }
          if (gestureState.dx < 0) {
            handleMonthChange(1);
          } else {
            handleMonthChange(-1);
          }
        },
      }),
    [viewMode, handleMonthChange]
  );

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
          {showSkeletons && renderSkeletons()}
          {!error &&
            filteredShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                phase={getShiftPhase(shift.start, shift.end, now)}
                isPrimary={shift.id === focusedShiftId}
                onPress={() => router.push(`/shift-details/${shift.id}`)}
                onConfirm={shift.assignmentId ? () => handleConfirm(shift.assignmentId) : undefined}
                confirmLoading={shift.assignmentId ? confirmingId === shift.assignmentId : false}
              />
            ))}
          {(!filteredShifts.length && !isLoading && !error) && renderListEmptyState()}
        </ScrollView>
      ) : (
        !error && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.calendarWrapper,
              {
                transform: [
                  { perspective: 1000 },
                  { rotateY: rotateY },
                ],
              },
            ]}
          >
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
                    const isToday = key === todayKey;
                    const isFocusedDay = focusedDayKey === key;
                    const dayPhase = dayPhaseMap.get(key);
                    return (
                      <View
                        key={key}
                        style={[
                          styles.calendarCell,
                          !isCurrentMonth && styles.calendarCellMuted,
                          dayShifts.length && styles.calendarCellActive,
                          isToday && styles.calendarCellToday,
                          isFocusedDay && styles.calendarCellFocused,
                        ]}
                      >
                        <View style={styles.calendarCellHeader}>
                          <Text
                            style={[
                              styles.calendarCellNumber,
                              !isCurrentMonth && styles.calendarCellNumberMuted,
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                        </View>
                    {dayShifts.length ? (
                      <View
                        style={[
                          styles.calendarShiftMarker,
                          dayPhase ? { backgroundColor: phaseMeta[dayPhase].background } : undefined,
                        ]}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={dayPhase ? phaseMeta[dayPhase].color : '#1d4ed8'}
                        />
                      </View>
                    ) : null}
                    {isFocusedDay && (
                      <View style={[styles.calendarFocusIndicator, styles.calendarFocusIndicatorActive]} />
                    )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </Animated.View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  header: {
    marginBottom: 6,
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
    marginBottom: 4,
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
    marginBottom: 4,
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
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 0,
    shadowColor: '#94a3ff',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 6,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  calendarWeeks: {
    marginTop: 4,
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarCell: {
    flex: 1,
    minHeight: 54,
    margin: 0.6,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e6e9f4',
    padding: 4,
    backgroundColor: '#f9fbff',
    position: 'relative',
  },
  calendarCellFocused: {
    borderColor: '#2563eb',
  },
  calendarCellMuted: {
    backgroundColor: '#f1f3f8',
  },
  calendarCellActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#ebf2ff',
    shadowColor: '#7c9cff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  calendarCellHeader: {
    alignItems: 'flex-start',
  },
  calendarCellNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  calendarCellNumberMuted: {
    color: '#a1a5b0',
  },
  calendarCellToday: {
    borderColor: '#2563eb',
    shadowColor: '#93c5fd',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  calendarShiftMarker: {
    marginTop: 6,
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  calendarFocusIndicator: {
    position: 'absolute',
    left: 2,
    top: 2,
    bottom: 2,
    width: 4,
    borderRadius: 999,
    backgroundColor: '#93c5fd',
    opacity: 0,
  },
  calendarFocusIndicatorActive: {
    opacity: 1,
  },
  listEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyAction: {
    minWidth: 180,
  },
  skeletonContainer: {
    marginBottom: 12,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    marginBottom: 12,
    padding: 16,
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonLineShort: {
    height: 12,
    width: '60%',
    backgroundColor: '#dbeafe',
    borderRadius: 6,
  },
});
