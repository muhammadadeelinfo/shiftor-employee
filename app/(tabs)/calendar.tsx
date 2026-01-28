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
import { useCalendarSelection } from '@shared/context/CalendarSelectionContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '@shared/context/NotificationContext';
import { useRouter } from 'expo-router';
import * as Calendar from 'expo-calendar';

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

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getMonthLabel = (date: Date) => date.toLocaleDateString([], { month: 'long', year: 'numeric' });

const formatShiftTime = (shift: { start: string; end: string }) => {
  const start = new Date(shift.start);
  const end = new Date(shift.end);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { dateLabel, startLabel, endLabel };
};

const buildShiftLocation = (shift: {
  location: string;
  objectName?: string;
  objectAddress?: string;
}) => {
  const rawParts = [
    shift.objectName?.trim(),
    shift.location?.trim(),
    shift.objectAddress?.trim(),
  ].filter((value): value is string => Boolean(value));
  const seen = new Set<string>();
  const uniqueParts: string[] = [];
  rawParts.forEach((part) => {
    const normalized = part.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueParts.push(part);
    }
  });
  return uniqueParts.join(', ');
};

const PHASE_TRANSLATION_KEYS: Record<ShiftPhase, 'phasePast' | 'phaseLive' | 'phaseUpcoming'> = {
  past: 'phasePast',
  live: 'phaseLive',
  upcoming: 'phaseUpcoming',
};

const shiftTypeIconMap = {
  morning: { name: 'sunny', color: '#facc15' },
  evening: { name: 'partly-sunny', color: '#fb923c' },
  night: { name: 'moon', color: '#7c3aed' },
} as const;

type ShiftType = keyof typeof shiftTypeIconMap;

type LegendEntry = {
  key: string;
  label: string;
  variant: 'dot' | 'multiDot' | 'icon';
  color?: string;
  colors?: string[];
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  description?: string;
};

type ImportedCalendarEvent = {
  title?: string;
  calendarId: string;
  calendarTitle?: string;
  startDate?: string;
  color?: string;
};

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
  const router = useRouter();
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
  const monthLabel = getMonthLabel(visibleMonth);
  const { selectedCalendars } = useCalendarSelection();
  const [importedEventsByDay, setImportedEventsByDay] = useState<
    Record<string, ImportedCalendarEvent[]>
  >({});
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [dayDetailModalVisible, setDayDetailModalVisible] = useState(false);
  const closeDayDetailModal = useCallback(() => {
    setDayDetailModalVisible(false);
    setActiveDayKey(null);
  }, []);
  const legendGroups = useMemo(
    () => [
      {
        key: 'shifts',
        title: t('calendarLegendShiftGroup'),
        entries: [
          {
            key: 'imported',
            variant: 'multiDot',
            colors: ['#34d399', '#fb923c', '#38bdf8'],
            label: t('calendarLegendImported'),
            description: t('calendarLegendImportedDesc'),
          },
          {
            key: 'pink',
            variant: 'dot',
            color: '#f472b6',
            label: t('calendarLegendPink'),
            description: t('calendarLegendPinkDesc'),
          },
        ],
      },
      {
        key: 'timeOfDay',
        title: t('calendarLegendTimeGroup'),
        entries: [
          {
            key: 'morning',
            variant: 'icon',
            color: '#facc15',
            icon: 'sunny-outline',
            label: t('calendarLegendMorning'),
            description: t('calendarLegendMorningDesc'),
          },
          {
            key: 'evening',
            variant: 'icon',
            color: '#fb923c',
            icon: 'partly-sunny-outline',
            label: t('calendarLegendEvening'),
            description: t('calendarLegendEveningDesc'),
          },
          {
            key: 'night',
            variant: 'icon',
            color: '#a855f7',
            icon: 'moon-outline',
            label: t('calendarLegendNight'),
            description: t('calendarLegendNightDesc'),
          },
        ],
      },
    ] as const,
    [t]
  );

  const monthShifts = useMemo(() => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    return orderedShifts.filter((shift) => {
      const shiftDate = new Date(shift.start);
      return shiftDate >= visibleMonth && shiftDate < nextMonth;
    });
  }, [orderedShifts, visibleMonth]);

  const shiftTypesByDay = useMemo(() => {
    const map = new Map<string, Set<ShiftType>>();
    const categorize = (shiftStart: string): ShiftType => {
      const hour = new Date(shiftStart).getHours();
      if (hour >= 6 && hour < 14) return 'morning';
      if (hour >= 14 && hour < 22) return 'evening';
      return 'night';
    };
    monthShifts.forEach((shift) => {
      const key = shift.start.split('T')[0];
      const set = map.get(key) ?? new Set<ShiftType>();
      set.add(categorize(shift.start));
      map.set(key, set);
    });
    return map;
  }, [monthShifts]);

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

  const importedCalendarColorMap = useMemo(() => {
    const palette = ['#34d399', '#fb923c', '#38bdf8', '#a855f7', '#f472b6'];
    const map = new Map<string, string>();
    selectedCalendars.forEach((calendar, index) => {
      map.set(calendar.id, palette[index % palette.length]);
    });
    return map;
  }, [selectedCalendars]);

  const activeDayShifts = useMemo(() => {
    if (!activeDayKey) {
      return [];
    }
    return shiftsByDay.get(activeDayKey) ?? [];
  }, [activeDayKey, shiftsByDay]);

  const activeDayImportedEvents = useMemo(() => {
    if (!activeDayKey) {
      return [];
    }
    return importedEventsByDay[activeDayKey] ?? [];
  }, [activeDayKey, importedEventsByDay]);

  const sortedActiveDayImportedEvents = useMemo(() => {
    return [...activeDayImportedEvents].sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
      return aTime - bTime;
    });
  }, [activeDayImportedEvents]);

  const activeDayLabel = useMemo(() => {
    if (!activeDayKey) {
      return null;
    }
    const parsed = activeDayKey.split('-').map((part) => Number(part));
    if (parsed.length !== 3 || parsed.some((part) => Number.isNaN(part))) {
      return null;
    }
    const [year, month, day] = parsed;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [activeDayKey]);


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

  useEffect(() => {
    let isMounted = true;
    if (!selectedCalendars.length) {
      setImportedEventsByDay({});
      return () => {
        isMounted = false;
      };
    }

    const fetchImportedEvents = async () => {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setImportedEventsByDay({});
          }
          return;
        }
        const start = startOfMonth(visibleMonth);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        const events = await Calendar.getEventsAsync(
          selectedCalendars.map((calendar) => calendar.id),
          start,
          end
        );
        if (!isMounted) return;
      const normalized: Record<string, ImportedCalendarEvent[]> = {};
      events.forEach((event) => {
        const eventStart = new Date(event.startDate);
        if (Number.isNaN(eventStart.getTime())) return;
        const key = dayKey(eventStart);
        const calendarMeta = selectedCalendars.find((cal) => cal.id === event.calendarId);
        const entry: ImportedCalendarEvent = {
          title: event.title ?? undefined,
          calendarId: event.calendarId ?? '',
          calendarTitle: calendarMeta?.title,
          startDate: eventStart.toISOString(),
          color: importedCalendarColorMap.get(event.calendarId ?? '') ?? '#facc15',
        };
        normalized[key] = normalized[key] ?? [];
        normalized[key].push(entry);
        });
        setImportedEventsByDay(normalized);
      } catch (error) {
        console.error('Failed to load imported calendar events', error);
        if (isMounted) {
          setImportedEventsByDay({});
        }
      }
    };

    fetchImportedEvents();

    return () => {
      isMounted = false;
    };
  }, [selectedCalendars, visibleMonth, importedCalendarColorMap]);

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
                      const key = dayKey(day);
                      const dayShifts = shiftsByDay.get(key) ?? [];
                      const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                      const isFocusedDay = focusedDayKey === key;
                      const dayPhase = dayPhaseMap.get(key);
                      const shiftTypes = shiftTypesByDay.get(key);
                      const importedEvents = importedEventsByDay[key] ?? [];
                      const importedColors = importedEvents.map(
                        (event) => importedCalendarColorMap.get(event.calendarId) ?? '#fcd34d'
                      );
                      return (
                        <Pressable
                          key={key}
                          style={({ pressed }) => [
                            styles.dayChip,
                            !isCurrentMonth && styles.dayChipMuted,
                            isFocusedDay && styles.dayChipFocused,
                            dayShifts.length && styles.dayChipActive,
                            pressed && dayShifts.length ? styles.dayChipPressed : undefined,
                          ]}
                          accessibilityRole="button"
                          onPress={() => {
                            setActiveDayKey(key);
                            setDayDetailModalVisible(true);
                          }}
                        >
                          <Text
                            style={[
                              styles.dayChipLabel,
                              !isCurrentMonth && styles.dayChipLabelMuted,
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                          {shiftTypes && shiftTypes.size ? (
                            <View style={styles.shiftIconRow}>
                              {Array.from(shiftTypes).map((type) => (
                                <View key={type} style={styles.shiftIcon}>
                                  <Ionicons
                                    name={shiftTypeIconMap[type].name}
                                    size={12}
                                    color={shiftTypeIconMap[type].color}
                                  />
                                </View>
                              ))}
                            </View>
                          ) : null}
                          {importedEvents.length > 0 && (
                            <View style={styles.importedEventRow}>
                              {importedColors.slice(0, 3).map((color, idx) => (
                                <View
                                  key={`imported-dot-${key}-${idx}`}
                                  style={[styles.importedEventDot, { backgroundColor: color }]}
                                />
                              ))}
                              {importedEvents.length > 3 && (
                                <Text style={styles.importedEventMore}>
                                  +{importedEvents.length - 3}
                                </Text>
                              )}
                            </View>
                          )}
                          {isFocusedDay && (
                            <View style={[styles.dayHalo, styles.dayHaloActive]} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        )}
        <View style={styles.legendCard}>
          <LinearGradient colors={['#fff', '#eef3ff']} style={styles.legendGradient} />
          <View style={styles.legendHeader}>
            <Text style={styles.legendTitle}>{t('calendarLegendTitle')}</Text>
            <View style={styles.legendHeaderDivider} />
          </View>
          {legendGroups.map((group) => (
          <View key={group.key} style={styles.legendGroup}>
            <Text style={styles.legendGroupTitle}>{group.title}</Text>
          <View style={styles.legendList}>
            {group.entries.map((entry) => (
              <View key={entry.key} style={styles.legendEntryCard}>
                <View style={styles.legendEntryIcon}>
                  {entry.variant === 'dot' && (
                        <View
                          style={[
                            styles.legendChipIcon,
                            { backgroundColor: entry.color ?? '#fff' },
                          ]}
                        />
                      )}
                      {entry.variant === 'multiDot' && (
                        <View style={styles.legendMultiIcon}>
                          {entry.colors?.map((color, index) => (
                            <View
                              key={`${entry.key}-${index}`}
                              style={[
                                styles.legendDotMini,
                                { backgroundColor: color },
                              ]}
                            />
                          ))}
                        </View>
                      )}
                      {entry.variant === 'icon' && entry.icon && (
                        <Ionicons name={entry.icon} size={16} color={entry.color} />
                      )}
                    </View>
                    <View style={styles.legendText}>
                      <Text style={styles.legendLabel}>{entry.label}</Text>
                      {entry.description ? (
                        <Text style={styles.legendDescription}>{entry.description}</Text>
                      ) : null}
                  </View>
                </View>
              ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={dayDetailModalVisible}
        animationType="slide"
        onRequestClose={closeDayDetailModal}
      >
        <Pressable style={styles.dayDetailBackdrop} onPress={closeDayDetailModal} />
        <View style={styles.dayDetailCard}>
          <View style={styles.dayDetailHeader}>
            <View>
              <Text style={styles.dayDetailTitle}>{t('calendarDetailTitle')}</Text>
              {activeDayLabel ? (
                <Text style={styles.dayDetailDate}>{activeDayLabel}</Text>
              ) : null}
            </View>
            <Pressable style={styles.dayDetailCloseButton} onPress={closeDayDetailModal}>
              <Ionicons name="close" size={18} color="#475569" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.dayDetailScroll}
            contentContainerStyle={styles.dayDetailScrollContent}
            showsVerticalScrollIndicator
            indicatorStyle="black"
            nestedScrollEnabled
          >
            <View style={styles.dayDetailSection}>
              <Text style={styles.dayDetailSectionTitle}>{t('calendarDetailShiftsTitle')}</Text>
              {activeDayShifts.length ? (
                activeDayShifts.map((shift) => {
                  const { startLabel, endLabel } = formatShiftTime(shift);
                  const shiftPhase = getShiftPhase(shift.start, shift.end);
                  const phaseInfo = phaseMeta[shiftPhase];
                  const phaseLabel = t(PHASE_TRANSLATION_KEYS[shiftPhase]);
                  const locationLabel = buildShiftLocation(shift);
                  return (
                    <View key={shift.id} style={styles.dayDetailShiftCard}>
                      <View style={styles.dayDetailShiftHeader}>
                        <Text style={styles.dayDetailShiftTitle}>{shift.title}</Text>
                        <View
                          style={[
                            styles.dayDetailPhaseChip,
                            { backgroundColor: phaseInfo.background },
                          ]}
                        >
                          <Ionicons
                            name={phaseInfo.icon}
                            size={16}
                            color={phaseInfo.color}
                            style={styles.dayDetailPhaseIcon}
                          />
                          <Text style={[styles.dayDetailPhaseLabel, { color: phaseInfo.color }]}>
                            {phaseLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.dayDetailShiftTime}>
                        {startLabel} — {endLabel}
                      </Text>
                      {locationLabel ? (
                        <Text style={styles.dayDetailLocation}>{locationLabel}</Text>
                      ) : null}
                      {shift.description ? (
                        <Text style={styles.dayDetailDescription}>{shift.description}</Text>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.dayDetailEmptyText}>{t('calendarDetailNoEvents')}</Text>
              )}
            </View>
            <View style={styles.dayDetailSection}>
              <Text style={styles.dayDetailSectionTitle}>{t('calendarDetailImportedTitle')}</Text>
              {sortedActiveDayImportedEvents.length ? (
                sortedActiveDayImportedEvents.map((event) => {
                  const eventTime = event.startDate
                    ? new Date(event.startDate).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : null;
                  return (
                    <View key={`${event.calendarId}-${event.title ?? 'event'}`} style={styles.dayDetailItem}>
                      <View style={styles.dayDetailImportedRow}>
                        <View
                          style={[
                            styles.dayDetailImportedDot,
                            { backgroundColor: event.color ?? '#38bdf8' },
                          ]}
                        />
                        <View style={styles.dayDetailImportedMeta}>
                          <Text style={styles.dayDetailItemTitle}>
                            {event.title ?? t('calendarDetailImportedUntitled')}
                          </Text>
                          <Text style={styles.dayDetailItemMeta}>
                            {event.calendarTitle ?? t('calendarDetailImportedCalendarFallback')}
                          </Text>
                          {eventTime ? (
                            <Text style={styles.dayDetailItemMeta}>
                              {t('calendarDetailTimeLabel')}: {eventTime}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.dayDetailEmptyText}>{t('calendarDetailNoImports')}</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  dayChipPressed: {
    opacity: 0.75,
  },
  dayChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  dayChipLabelMuted: {
    color: '#94a3b8',
  },
  shiftIconRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
  },
  shiftIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dbeafe',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  importedEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  importedEventDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 4,
  },
  importedEventMore: {
    fontSize: 10,
    color: '#475569',
  },
  legendCard: {
    borderRadius: 26,
    marginTop: 12,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  legendGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    marginBottom: 14,
  },
  legendTitle: {
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#475569',
    fontWeight: '700',
  },
  legendHeaderDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e7ff',
    borderRadius: 1,
  },
  legendList: {
    width: '100%',
  },
  legendEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f7f9ff',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    gap: 12,
  },
  legendEntryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    shadowColor: '#64748b',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  legendGroup: {
    marginBottom: 12,
  },
  legendGroupTitle: {
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 6,
  },
  legendChipIcon: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendMultiIcon: {
    flexDirection: 'row',
    gap: 3,
  },
  legendDotMini: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  legendDescription: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  dayDetailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 10,
  },
  dayDetailCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '15%',
    bottom: '10%',
    borderRadius: 24,
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 20,
    zIndex: 20,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayDetailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  dayDetailDate: {
    fontSize: 12,
    color: '#475569',
  },
  dayDetailCloseButton: {
    padding: 6,
    borderRadius: 12,
  },
  dayDetailScroll: {
    flex: 1,
    marginTop: 4,
  },
  dayDetailScrollContent: {
    paddingBottom: 20,
  },
  dayDetailSection: {
    marginBottom: 14,
  },
  dayDetailSectionTitle: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 8,
  },
  dayDetailItem: {
    marginBottom: 10,
  },
  dayDetailItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  dayDetailItemMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  dayDetailEmptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dayDetailImportedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dayDetailImportedDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 10,
    marginTop: 5,
  },
  dayDetailImportedMeta: {
    flex: 1,
  },
  dayDetailShiftCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  dayDetailShiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dayDetailShiftTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  dayDetailPhaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  dayDetailPhaseIcon: {
    marginRight: 4,
  },
  dayDetailPhaseLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayDetailShiftTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  dayDetailLocation: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  dayDetailDescription: {
    fontSize: 12,
    color: '#475569',
  },
  legendGroup: {
    marginBottom: 12,
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
