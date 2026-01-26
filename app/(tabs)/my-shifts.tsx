import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  const hasManuallyChangedMonth = useRef(false);
  const rotateY = calendarFlip.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ['-90deg', '0deg', '90deg'],
  });
  const todayKey = useMemo(() => dayKey(new Date()), []);
  const listScrollRef = useRef<ScrollView>(null);
  const shiftLayouts = useRef(new Map<string, number>());
  const lastAutoScrolledShiftId = useRef<string | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  const orderedShifts = useMemo(() => {
    return [...shiftList]
      .map((shift) => shift)
      .filter((shift) => {
        const shiftDate = new Date(shift.start);
        return !Number.isNaN(shiftDate.getTime());
      })
      .sort((a, b) => Number(new Date(a.start)) - Number(new Date(b.start)));
  }, [shiftList]);

  const monthShifts = useMemo(() => {
    const monthStart = visibleMonth;
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    return orderedShifts.filter((shift) => {
      const shiftDate = new Date(shift.start);
      return shiftDate >= monthStart && shiftDate < nextMonth;
    });
  }, [orderedShifts, visibleMonth]);

  const showSkeletons = isLoading && !orderedShifts.length && !error;
  const now = new Date();
  const liveShift = orderedShifts.find((shift) => getShiftPhase(shift.start, shift.end, now) === 'live');
  const nextShift = orderedShifts.find((shift) => new Date(shift.start) > now);
  const focusedShiftId = liveShift?.id ?? nextShift?.id;
  const focusedDayKey = orderedShifts
    .find((shift) => shift.id === focusedShiftId)
    ?.start.split('T')[0];
  const dayPhaseMap = useMemo(() => {
    const map = new Map<string, ShiftPhase>();
    monthShifts.forEach((shift) => {
      const key = shift.start.split('T')[0];
      const phase = getShiftPhase(shift.start, shift.end, now);
      const existing = map.get(key);
      if (!existing || existing === 'past' || (existing === 'upcoming' && phase === 'live')) {
        map.set(key, phase);
      }
    });
    return map;
  }, [monthShifts, now]);

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
      <Text style={styles.emptyTitle}>No shifts scheduled yet.</Text>
      <Text style={styles.emptySubtitle}>
        Check back soon or refresh to see new assignments that match your availability.
      </Text>
      <PrimaryButton title="Refresh shifts" onPress={() => refetch()} style={styles.emptyAction} />
    </View>
  );

  const calendarWeeks = useMemo(() => getCalendarWeeks(visibleMonth), [visibleMonth]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    monthShifts.forEach((shift) => {
      const shiftDate = new Date(shift.start);
      if (Number.isNaN(shiftDate.getTime())) return;
      const key = shiftDate.toISOString().split('T')[0];
      const bucket = map.get(key) ?? [];
      bucket.push(shift);
      bucket.sort((a, b) => Number(new Date(a.start)) - Number(new Date(b.start)));
      map.set(key, bucket);
    });
    return map;
  }, [monthShifts]);

  const scrollToMonth = useCallback(
    (month: Date) => {
      const targetMonthKey = month.getTime();
      const nextShift = orderedShifts.find(
        (shift) => startOfMonth(new Date(shift.start)).getTime() === targetMonthKey
      );
      if (!nextShift) return;
      const offset = shiftLayouts.current.get(nextShift.id);
      if (offset !== undefined) {
        listScrollRef.current?.scrollTo({ y: offset, animated: true });
      }
    },
    [orderedShifts]
  );

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      let candidateMonth: Date | null = null;
      for (const shift of orderedShifts) {
        const layout = shiftLayouts.current.get(shift.id);
        if (layout === undefined) continue;
        if (layout <= offset + 20) {
          candidateMonth = startOfMonth(new Date(shift.start));
        } else {
          break;
        }
      }
      if (candidateMonth && candidateMonth.getTime() !== visibleMonth.getTime()) {
        hasManuallyChangedMonth.current = true;
        setVisibleMonth(candidateMonth);
      }
    },
    [orderedShifts, visibleMonth]
  );

  const handleMonthChange = useCallback((offset: number) => {
    hasManuallyChangedMonth.current = true;
    Animated.timing(calendarFlip, {
      toValue: 90,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setVisibleMonth((prev) => {
        const nextMonth = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
        scrollToMonth(nextMonth);
        return nextMonth;
      });
      calendarFlip.setValue(-90);
      Animated.timing(calendarFlip, {
        toValue: 0,
        duration: 220,
        easing: undefined,
        useNativeDriver: true,
      }).start();
    });
  }, [calendarFlip]);

  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const calendarPanResponder = useMemo(
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
  const swipeHandledRef = useRef(false);
  const listSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          viewMode === 'list' &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          viewMode === 'list' &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20,
        onStartShouldSetPanResponderCapture: () => viewMode === 'list',
        onPanResponderGrant: () => {
          setListScrollEnabled(false);
          swipeHandledRef.current = false;
        },
        onPanResponderMove: (_, gestureState) => {
          if (swipeHandledRef.current) return;
          const absDx = Math.abs(gestureState.dx);
          if (absDx < 35 || absDx <= Math.abs(gestureState.dy)) return;
          swipeHandledRef.current = true;
          if (gestureState.dx < 0) {
            handleMonthChange(1);
          } else {
            handleMonthChange(-1);
          }
        },
        onPanResponderRelease: () => {
          setListScrollEnabled(true);
        },
        onPanResponderTerminate: () => setListScrollEnabled(true),
        onPanResponderTerminationRequest: () => true,
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

  useEffect(() => {
    if (hasManuallyChangedMonth.current) return;
    if (!shiftList.length) return;
    const now = new Date();
    const liveShift = shiftList.find((shift) => getShiftPhase(shift.start, shift.end, now) === 'live');
    const upcomingShift = shiftList.find((shift) => {
      const startDate = new Date(shift.start);
      if (Number.isNaN(startDate.getTime())) return false;
      return startDate > now;
    });
    const shiftToFocus = liveShift ?? upcomingShift;
    if (!shiftToFocus) return;

    const focusDate = new Date(shiftToFocus.start);
    if (Number.isNaN(focusDate.getTime())) return;
    const targetMonth = startOfMonth(focusDate);
    if (targetMonth.getTime() === visibleMonth.getTime()) return;
    scrollToMonth(targetMonth);
    setVisibleMonth(targetMonth);
  }, [shiftList, visibleMonth, scrollToMonth]);

  useEffect(() => {
    shiftLayouts.current.clear();
    lastAutoScrolledShiftId.current = null;
    setLayoutTick((tick) => tick + 1);
  }, [orderedShifts.length, viewMode]);

  useEffect(() => {
    if (viewMode !== 'list') return;
    if (!focusedShiftId) return;
    if (lastAutoScrolledShiftId.current === focusedShiftId) return;
    const targetOffset = shiftLayouts.current.get(focusedShiftId);
    if (targetOffset === undefined) return;
    listScrollRef.current?.scrollTo({ y: Math.max(targetOffset - 12, 0), animated: true });
    lastAutoScrolledShiftId.current = focusedShiftId;
  }, [focusedShiftId, layoutTick, viewMode]);

  const handleShiftLayout = useCallback(
    (shiftId: string) => (event: LayoutChangeEvent) => {
      shiftLayouts.current.set(shiftId, event.nativeEvent.layout.y);
      setLayoutTick((tick) => tick + 1);
    },
    [setLayoutTick]
  );

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
      <View style={styles.viewSwitcherRow}>
        <View style={styles.viewSwitcherContainer}>
          <TouchableOpacity
            style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>
              List view
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggle, viewMode === 'calendar' && styles.viewToggleActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Text
              style={[styles.viewToggleText, viewMode === 'calendar' && styles.viewToggleTextActive]}
            >
              Calendar view
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.headerWrapper}>
        <View>
          <Text style={styles.headerTitle}>
            Upcoming Shifts · {getMonthLabel(visibleMonth)}
          </Text>
        </View>
      </View>
      {errorView}
      {viewMode === 'list' ? (
        <ScrollView
          ref={listScrollRef}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
          scrollEnabled={listScrollEnabled}
          scrollEventThrottle={24}
          onScroll={handleListScroll}
          {...listSwipeResponder.panHandlers}
        >
          {showSkeletons && renderSkeletons()}
          {!error &&
            orderedShifts.map((shift) => (
              <View key={shift.id} onLayout={handleShiftLayout(shift.id)}>
                <ShiftCard
                  shift={shift}
                  phase={getShiftPhase(shift.start, shift.end, now)}
                  isPrimary={shift.id === focusedShiftId}
                  onPress={() => router.push(`/shift-details/${shift.id}`)}
                  onConfirm={shift.assignmentId ? () => handleConfirm(shift.assignmentId) : undefined}
                  confirmLoading={shift.assignmentId ? confirmingId === shift.assignmentId : false}
                />
              </View>
            ))}
          {(!orderedShifts.length && !isLoading && !error) && renderListEmptyState()}
        </ScrollView>
      ) : (
        !error && (
          <View style={styles.calendarShell}>
            <Animated.View
              {...calendarPanResponder.panHandlers}
              style={[
                styles.calendarWrapper,
                {
                  transform: [{ perspective: 1000 }, { rotateY: rotateY }],
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
          </View>
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
    paddingTop: 0,
    paddingBottom: 16,
  },
  headerWrapper: {
    marginBottom: 2,
  },
  viewSwitcherRow: {
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
    paddingTop: 2,
    flexGrow: 1,
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
  viewControlsContainer: {
    marginTop: 2,
    marginBottom: 6,
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  viewSwitcherContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  viewToggle: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  viewToggleActive: {
    backgroundColor: '#2563eb',
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  viewToggleTextActive: {
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  calendarShell: {
    borderRadius: 30,
    padding: 8,
    backgroundColor: '#f8fafc',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
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
