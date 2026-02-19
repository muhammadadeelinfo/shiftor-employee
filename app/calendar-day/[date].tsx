import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Calendar from 'expo-calendar';
import { useShiftFeed } from '@features/shifts/useShiftFeed';
import { getShiftPhase, phaseMeta, type ShiftPhase } from '@shared/utils/shiftPhase';
import { useCalendarSelection } from '@shared/context/CalendarSelectionContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { openAddressInMaps } from '@shared/utils/maps';

type ImportedCalendarEvent = {
  title?: string;
  calendarTitle?: string;
  startDate?: string;
  color?: string;
};

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatShiftTime = (shift: { start: string; end: string }) => {
  const start = new Date(shift.start);
  const end = new Date(shift.end);
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { startLabel, endLabel };
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

export default function CalendarDayDetailsScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams();
  const dateParam = Array.isArray(date) ? date[0] : date;
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { orderedShifts } = useShiftFeed();
  const { selectedCalendars } = useCalendarSelection();
  const [importedEvents, setImportedEvents] = useState<ImportedCalendarEvent[]>([]);

  const parsedDate = useMemo(() => {
    if (!dateParam || typeof dateParam !== 'string') return null;
    const [year, month, day] = dateParam.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    const candidate = new Date(year, month - 1, day);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }, [dateParam]);

  const activeDayLabel = useMemo(() => {
    if (!parsedDate) return null;
    return parsedDate.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [parsedDate]);

  const activeDayShifts = useMemo(() => {
    if (!parsedDate) return [];
    const targetKey = dayKey(parsedDate);
    return orderedShifts.filter((shift) => {
      const shiftDate = new Date(shift.start);
      if (Number.isNaN(shiftDate.getTime())) return false;
      return dayKey(shiftDate) === targetKey;
    });
  }, [orderedShifts, parsedDate]);

  useEffect(() => {
    let isMounted = true;

    const fetchImportedEvents = async () => {
      if (!parsedDate || !selectedCalendars.length) {
        if (isMounted) setImportedEvents([]);
        return;
      }
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setImportedEvents([]);
          return;
        }
        const start = new Date(parsedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(parsedDate);
        end.setHours(23, 59, 59, 999);
        const calendarIds = selectedCalendars.map((calendar) => calendar.id);
        const events = await Calendar.getEventsAsync(calendarIds, start, end);
        if (!isMounted) return;
        const colorMap = new Map<string, string>();
        const palette = ['#34d399', '#fb923c', '#38bdf8', '#a855f7', '#f472b6'];
        selectedCalendars.forEach((calendar, index) => {
          colorMap.set(calendar.id, palette[index % palette.length]);
        });
        const normalized = events.map((event) => ({
          title: event.title ?? undefined,
          calendarTitle:
            selectedCalendars.find((calendar) => calendar.id === event.calendarId)?.title ?? undefined,
          startDate: event.startDate ? new Date(event.startDate).toISOString() : undefined,
          color: colorMap.get(event.calendarId) ?? '#38bdf8',
        }));
        normalized.sort((a, b) => {
          const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
          return aTime - bTime;
        });
        setImportedEvents(normalized);
      } catch {
        if (isMounted) setImportedEvents([]);
      }
    };

    void fetchImportedEvents();

    return () => {
      isMounted = false;
    };
  }, [parsedDate, selectedCalendars]);

  if (!parsedDate) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t('calendarDetailNoEvents')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <View style={styles.header}>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/calendar');
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('calendarDetailTitle')}</Text>
          {activeDayLabel ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{activeDayLabel}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t('calendarDetailShiftsTitle')}
          </Text>
          {activeDayShifts.length ? (
            activeDayShifts.map((shift) => {
              const { startLabel, endLabel } = formatShiftTime(shift);
              const shiftPhase = getShiftPhase(shift.start, shift.end);
              const phaseInfo = phaseMeta[shiftPhase];
              const phaseLabel = t(PHASE_TRANSLATION_KEYS[shiftPhase]);
              const locationLabel = buildShiftLocation(shift);
              return (
                <Pressable
                  key={shift.id}
                  style={({ pressed }) => [
                    styles.shiftCard,
                    { backgroundColor: theme.surfaceElevated },
                    pressed && styles.shiftCardPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: `/shift-details/${shift.id}`,
                      params: { from: 'calendar-day', date: dateParam },
                    })
                  }
                >
                  <View style={styles.shiftHeader}>
                    <Text style={[styles.shiftTitle, { color: theme.textPrimary }]}>{shift.title}</Text>
                    <View style={[styles.phaseChip, { backgroundColor: phaseInfo.background }]}>
                      <Ionicons
                        name={phaseInfo.icon as ComponentProps<typeof Ionicons>['name']}
                        size={15}
                        color={phaseInfo.color}
                        style={styles.phaseIcon}
                      />
                      <Text style={[styles.phaseLabel, { color: phaseInfo.color }]}>{phaseLabel}</Text>
                    </View>
                  </View>
                  <Text style={[styles.shiftTime, { color: theme.textSecondary }]}>
                    {startLabel} — {endLabel}
                  </Text>
                  {locationLabel ? (
                    <View style={styles.locationRow}>
                      <Text style={[styles.locationText, { color: theme.textSecondary }]}>{locationLabel}</Text>
                      <Pressable
                        style={[
                          styles.mapButton,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          openAddressInMaps(locationLabel);
                        }}
                      >
                        <Ionicons name="map-outline" size={15} color={theme.info} />
                      </Pressable>
                    </View>
                  ) : null}
                  {shift.description ? (
                    <Text style={[styles.shiftDescription, { color: theme.textSecondary }]}>
                      {shift.description}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('calendarDetailNoEvents')}</Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t('calendarDetailImportedTitle')}
          </Text>
          {importedEvents.length ? (
            importedEvents.map((event, index) => {
              const eventTime = event.startDate
                ? new Date(event.startDate).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : null;
              return (
                <View key={`${event.calendarTitle ?? 'event'}-${index}`} style={styles.importedRow}>
                  <View style={[styles.importedDot, { backgroundColor: event.color ?? '#38bdf8' }]} />
                  <View style={styles.importedMeta}>
                    <Text style={[styles.importedTitle, { color: theme.textPrimary }]}>
                      {event.title ?? t('calendarDetailImportedUntitled')}
                    </Text>
                    <Text style={[styles.importedInfo, { color: theme.textSecondary }]}>
                      {event.calendarTitle ?? t('calendarDetailImportedCalendarFallback')}
                    </Text>
                    {eventTime ? (
                      <Text style={[styles.importedInfo, { color: theme.textSecondary }]}>
                        {t('calendarDetailTimeLabel')}: {eventTime}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('calendarDetailNoImports')}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontWeight: '600',
  },
  shiftCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  shiftCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  shiftTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  phaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  phaseIcon: {
    marginRight: 4,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  shiftTime: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    marginRight: 8,
  },
  mapButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftDescription: {
    fontSize: 13,
  },
  importedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  importedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    marginTop: 5,
  },
  importedMeta: {
    flex: 1,
  },
  importedTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  importedInfo: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
