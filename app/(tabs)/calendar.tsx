import {
  Animated,
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
import { languageDefinitions, useLanguage } from '@shared/context/LanguageContext';

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
  const { t, language, setLanguage } = useLanguage();
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

  const emptyState = !orderedShifts.length && !isLoading && !error && (
    <View style={styles.listEmptyState}>
      <Text style={styles.emptyTitle}>{t('noUpcomingShifts')}</Text>
      <Text style={styles.emptySubtitle}>{t('listEmptySubtitle')}</Text>
      <PrimaryButton title={t('refreshShifts')} onPress={() => refetch()} style={styles.emptyAction} />
    </View>
  );

  const languageToggle = (
    <View style={styles.languageRow}>
      {languageDefinitions.map((definition) => (
        <Pressable
          key={definition.code}
          onPress={() => setLanguage(definition.code)}
          style={({ pressed }) => [
            styles.languageChip,
            language === definition.code && styles.languageChipActive,
            pressed && styles.languageChipPressed,
          ]}
        >
          <Text
            style={[
              styles.languageChipText,
              language === definition.code && styles.languageChipTextActive,
            ]}
          >
            {definition.flag} {definition.shortLabel}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.languageWrapper}>
          {languageToggle}
        </View>
        <Pressable style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={20} color="#0f172a" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>2</Text>
          </View>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
      >
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.headerTitle}>{t('calendarView')}</Text>
            <Text style={styles.headerSubtitle}>{monthLabel}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => handleMonthChange(-1)}
              style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            >
              <Ionicons name="chevron-back-outline" size={20} color="#2563eb" />
            </Pressable>
            <Pressable
              onPress={() => handleMonthChange(1)}
              style={({ pressed }) => [styles.navButton, styles.navButtonSpacing, pressed && styles.navButtonPressed]}
            >
              <Ionicons name="chevron-forward-outline" size={20} color="#2563eb" />
            </Pressable>
          </View>
        </View>
        {errorView}
        {showSkeletons && renderSkeletons()}
        {emptyState}
        {!error && (
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
                            <View
                              style={[
                                styles.calendarFocusIndicator,
                                styles.calendarFocusIndicatorActive,
                              ]}
                            />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef1ff',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e8efff',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 8,
  },
  languageWrapper: {
    backgroundColor: '#fff',
    borderRadius: 26,
    paddingVertical: 6,
    paddingHorizontal: 4,
    paddingLeft: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    marginRight: 4,
  },
  languageChipActive: {
    backgroundColor: '#2563eb',
  },
  languageChipPressed: {
    opacity: 0.7,
  },
  languageChipText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 13,
  },
  languageChipTextActive: {
    color: '#fff',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    right: -2,
    top: -4,
    backgroundColor: '#f87171',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    color: '#475569',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 3,
  },
  navButtonSpacing: {
    marginLeft: 10,
  },
  navButtonPressed: {
    opacity: 0.7,
  },
  calendarShell: {
    borderRadius: 32,
    padding: 12,
    backgroundColor: '#f1f3ff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 18,
    elevation: 4,
  },
  calendarWrapper: {
    backgroundColor: '#fff',
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 14,
    shadowColor: '#7c9cff',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    minHeight: 64,
    margin: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 6,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 1,
  },
  calendarCellFocused: {
    borderColor: '#2563eb',
    backgroundColor: '#eef2ff',
  },
  calendarCellMuted: {
    backgroundColor: '#f0f1f7',
  },
  calendarCellActive: {
    borderColor: '#e0e7ff',
    backgroundColor: '#eef2ff',
  },
  calendarCellHeader: {
    alignItems: 'flex-start',
    width: '100%',
  },
  calendarCellNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  calendarCellNumberMuted: {
    color: '#9ca3af',
  },
  calendarCellToday: {
    borderColor: '#7dd3fc',
    shadowColor: '#7dd3fc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  calendarShiftMarker: {
    marginTop: 6,
    width: 26,
    height: 26,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  calendarFocusIndicator: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    opacity: 0,
  },
  calendarFocusIndicatorActive: {
    opacity: 1,
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
});
