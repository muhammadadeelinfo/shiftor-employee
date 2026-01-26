import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useShiftFeed } from '@features/shifts/useShiftFeed';
import { getShiftPhase, phaseMeta, type ShiftPhase } from '@shared/utils/shiftPhase';
import { useLanguage } from '@shared/context/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '@shared/context/NotificationContext';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

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

  while (weeks.length < 6) {
    const lastWeek = weeks[weeks.length - 1];
    const nextWeekStart = new Date(lastWeek[lastWeek.length - 1]);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const extraWeek: Date[] = [];
    const cursorExtra = new Date(nextWeekStart);
    for (let i = 0; i < 7; i += 1) {
      extraWeek.push(new Date(cursorExtra));
      cursorExtra.setDate(cursorExtra.getDate() + 1);
    }
    weeks.push(extraWeek);
  }

  return weeks;
};

const dayKey = (date: Date) => date.toISOString().split('T')[0];
const getMonthLabel = (date: Date) => date.toLocaleDateString([], { month: 'long', year: 'numeric' });

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

export default function CalendarScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { orderedShifts, isLoading, error, refetch } = useShiftFeed();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const calendarFlip = useRef(new Animated.Value(0)).current;
  const hasManuallyChangedMonth = useRef(false);
  const rotateY = calendarFlip.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ['-90deg', '0deg', '90deg'],
  });
  const now = new Date();
  const liveShift = orderedShifts.find((shift) => getShiftPhase(shift.start, shift.end, now) === 'live');
  const nextShift = orderedShifts.find((shift) => new Date(shift.start) > now);
  const focusedShiftId = liveShift?.id ?? nextShift?.id;
  const focusedDayKey = orderedShifts.find((shift) => shift.id === focusedShiftId)?.start.split('T')[0];
  const todayKey = useMemo(() => dayKey(new Date()), []);
  const monthLabel = getMonthLabel(visibleMonth);

  const monthShifts = useMemo(() => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    return orderedShifts.filter((shift) => {
      const shiftDate = new Date(shift.start);
      return shiftDate >= visibleMonth && shiftDate < nextMonth;
    });
  }, [orderedShifts, visibleMonth]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, typeof orderedShifts[number]>();
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

  const calendarWeeks = useMemo(() => getCalendarWeeks(visibleMonth), [visibleMonth]);
  const showSkeletons = isLoading && !orderedShifts.length && !error;

  const handleMonthChange = useCallback(
    (offset: number) => {
      hasManuallyChangedMonth.current = true;
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
    },
    [calendarFlip]
  );

  const calendarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20,
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) < 35) return;
          if (gestureState.dx < 0) {
            handleMonthChange(1);
          } else {
            handleMonthChange(-1);
          }
        },
      }),
    [handleMonthChange]
  );

  useEffect(() => {
    if (hasManuallyChangedMonth.current) return;
    if (!orderedShifts.length) return;
    const nowRef = new Date();
    const live = orderedShifts.find((shift) => getShiftPhase(shift.start, shift.end, nowRef) === 'live');
    const upcoming = orderedShifts.find((shift) => new Date(shift.start) > nowRef);
    const shiftToFocus = live ?? upcoming;
    if (!shiftToFocus) return;
    const focusDate = new Date(shiftToFocus.start);
    if (Number.isNaN(focusDate.getTime())) return;
    const targetMonth = startOfMonth(focusDate);
    if (targetMonth.getTime() === visibleMonth.getTime()) return;
    setVisibleMonth(targetMonth);
  }, [orderedShifts, visibleMonth]);

  const errorView = error ? (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{t('shiftSyncFailedTitle')}</Text>
      <Text style={styles.errorText}>{t('shiftSyncFailedMessage')}</Text>
      <PrimaryButton title={t('retrySync')} onPress={() => refetch()} style={styles.retryButton} />
    </View>
  ) : null;

  const { addNotification } = useNotifications();
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const emptyNotifiedRef = useRef(false);

  useEffect(() => {
    if (!error && !isLoading && !orderedShifts.length) {
      if (!emptyNotifiedRef.current) {
        addNotification({
          title: t('noUpcomingShifts'),
          detail: t('listEmptySubtitle'),
        });
        emptyNotifiedRef.current = true;
      }
      setShowEmptyModal(true);
    } else {
      emptyNotifiedRef.current = false;
      setShowEmptyModal(false);
    }
  }, [addNotification, error, isLoading, orderedShifts.length, t]);

  const containerStyle = [styles.container, { paddingTop: 12 + insets.top }];
  const scrollContentStyle = [styles.scrollContent, { paddingBottom: 12 + insets.bottom }];

  return (
    <SafeAreaView style={containerStyle} edges={['top']}>
      <LinearGradient colors={['#eef3ff', '#f4f6ff']} style={styles.background} />
      <ScrollView
        contentContainerStyle={scrollContentStyle}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
      >
        <View style={styles.monthCard}>
          <LinearGradient
            colors={['#fdfdfe', '#eef2ff']}
            style={styles.monthCardGradient}
          />
          <View style={styles.monthNavRow}>
            <Pressable onPress={() => handleMonthChange(-1)} style={styles.monthNavButton}>
              <Ionicons name="chevron-back" size={20} color="#94a3b8" />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable onPress={() => handleMonthChange(1)} style={styles.monthNavButton}>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </Pressable>
          </View>
        </View>
        {errorView}
        {showSkeletons && renderSkeletons()}
        {!error && (
          <View style={styles.calendarCard}>
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
              <View style={styles.calendarGrid}>
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
                            styles.dayChip,
                            !isCurrentMonth && styles.dayChipMuted,
                            isFocusedDay && styles.dayChipFocused,
                            dayShifts.length && styles.dayChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayChipLabel,
                              !isCurrentMonth && styles.dayChipLabelMuted,
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                          {isToday && <View style={styles.dayTodayDot} />}
                          {isFocusedDay && (
                            <View style={[styles.dayHalo, styles.dayHaloActive]}>
                              <View style={styles.dayHaloIndicator} />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        )}
      </ScrollView>
      <Modal transparent visible={showEmptyModal} animationType="fade">
        <View style={styles.emptyModalBackdrop}>
          <View style={styles.emptyModalCard}>
            <Text style={styles.emptyModalTitle}>{t('noUpcomingShifts')}</Text>
            <Text style={styles.emptyModalSubtitle}>{t('listEmptySubtitle')}</Text>
            <PrimaryButton title={t('refreshShifts')} onPress={() => {
              setShowEmptyModal(false);
              refetch();
            }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef1ff',
    paddingHorizontal: 12,
  },
  monthCard: {
    backgroundColor: '#fff',
    borderRadius: 36,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  monthCardGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.65,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
  },
  monthNavButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#eef1ff',
    marginHorizontal: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  calendarCard: {
    borderRadius: 36,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  calendarWrapper: {
    borderRadius: 32,
    backgroundColor: '#f4f5ff',
    padding: 8,
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
    color: '#94a3b8',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  calendarGrid: {
    marginTop: 18,
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  dayChip: {
    flex: 1,
    margin: 3,
    minHeight: 70,
    borderRadius: 22,
    backgroundColor: '#eef1ff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayChipFocused: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  dayChipMuted: {
    opacity: 0.45,
  },
  dayChipActive: {
    borderColor: '#dbeafe',
  },
  dayChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  dayChipLabelMuted: {
    color: '#94a3b8',
  },
  dayTodayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    position: 'absolute',
    bottom: 8,
  },
  dayHalo: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayHaloActive: {
    borderColor: '#2563eb',
  },
  dayHaloIndicator: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    bottom: 6,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
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
  emptyModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyModalCard: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  emptyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
});
