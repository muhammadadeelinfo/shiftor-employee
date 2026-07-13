import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BackButton } from '@shared/components/BackButton';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { layoutTokens } from '@shared/theme/layout';
import { getContentMaxWidth, shouldStackForCompactWidth } from '@shared/utils/responsiveLayout';
import { formatMonthKey, formatMonthlyHoursMonthLabel, getEmployeeApiBaseUrl } from '@features/account/monthlyHours';
import { fetchEmployeeAvailability, submitEmployeeAvailability } from '@features/account/employeeSelfService';

type DayMode = 'available' | 'unavailable' | 'clear';

const shiftMonthKey = (monthKey: string, offset: number) => {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }
  return formatMonthKey(new Date(Date.UTC(year, month - 1 + offset, 1)));
};

const formatDayLabel = (value: string, language: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value.slice(-2);
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    weekday: 'short',
  }).format(parsed);
};

export default function AvailabilityScreen() {
  const { user, session } = useAuth();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const apiBaseUrl = getEmployeeApiBaseUrl();
  const currentMonthKey = useMemo(() => formatMonthKey(new Date()), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isCompact = shouldStackForCompactWidth(width);
  const contentMaxWidth = getContentMaxWidth(width);

  const queryKey = ['employeeAvailability', user?.id, selectedMonthKey, apiBaseUrl];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      fetchEmployeeAvailability({
        apiBaseUrl,
        accessToken: session?.access_token,
        month: selectedMonthKey,
        t,
      }),
    enabled: Boolean(user?.id && session?.access_token && apiBaseUrl),
    staleTime: 30_000,
    onSuccess: (payload) => {
      setAvailableDates(payload.availability?.availableDates ?? []);
      setUnavailableDates(payload.availability?.unavailableDates ?? []);
      setNote(payload.availability?.note ?? '');
    },
  });

  const monthDates = data?.monthDates ?? [];
  const monthLabel = formatMonthlyHoursMonthLabel(selectedMonthKey, language);
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const unavailableSet = useMemo(() => new Set(unavailableDates), [unavailableDates]);
  const selectedCount = availableDates.length + unavailableDates.length;

  const setDayMode = (date: string, mode: DayMode) => {
    setAvailableDates((current) =>
      mode === 'available'
        ? Array.from(new Set([...current, date])).sort()
        : current.filter((entry) => entry !== date)
    );
    setUnavailableDates((current) =>
      mode === 'unavailable'
        ? Array.from(new Set([...current, date])).sort()
        : current.filter((entry) => entry !== date)
    );
  };

  const cycleDate = (date: string) => {
    if (availableSet.has(date)) {
      setDayMode(date, 'unavailable');
      return;
    }
    if (unavailableSet.has(date)) {
      setDayMode(date, 'clear');
      return;
    }
    setDayMode(date, 'available');
  };

  const handleSubmit = async () => {
    if (!apiBaseUrl || !session?.access_token) {
      Alert.alert(t('availabilityTitle'), t('availabilityUnavailable'));
      return;
    }
    try {
      setSubmitting(true);
      await submitEmployeeAvailability({
        apiBaseUrl,
        accessToken: session.access_token,
        month: selectedMonthKey,
        availableDates,
        unavailableDates,
        note,
        t,
      });
      await queryClient.invalidateQueries({ queryKey });
      Alert.alert(t('availabilityTitle'), t('availabilitySubmitted'));
    } catch (submitError) {
      Alert.alert(
        t('availabilityTitle'),
        submitError instanceof Error ? submitError.message : t('availabilitySubmitFailed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 28,
            maxWidth: contentMaxWidth,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BackButton fallbackHref="/account" />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('availabilityTitle')}</Text>
            <Text style={[styles.headerHint, { color: theme.textSecondary }]}>{t('availabilityHint')}</Text>
          </View>
        </View>

        <LinearGradient
          colors={['#12213f', '#0f2b3a', '#0b1326']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>{t('availabilitySelfService')}</Text>
              <Text style={styles.heroTitle}>{monthLabel}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {t('availabilitySelectedCount', { count: selectedCount })}
              </Text>
            </View>
          </View>
          <View style={[styles.monthControls, isCompact && styles.monthControlsCompact]}>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => setSelectedMonthKey((value) => shiftMonthKey(value, -1))}
            >
              <Ionicons name="chevron-back" size={18} color="#f8fafc" />
            </TouchableOpacity>
            <View style={styles.monthCenter}>
              <Ionicons name="calendar-clear-outline" size={17} color="#67e8f9" />
              <Text style={styles.monthCenterText}>{monthLabel}</Text>
            </View>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => setSelectedMonthKey((value) => shiftMonthKey(value, 1))}
            >
              <Ionicons name="chevron-forward" size={18} color="#f8fafc" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t('availabilityLoading')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Text style={[styles.stateText, { color: theme.fail }]}>
              {error instanceof Error ? error.message : t('availabilityLoadFailed')}
            </Text>
            <PrimaryButton title={t('retry')} onPress={() => void refetch()} />
          </View>
        ) : null}

        {data?.setupRequired ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Text style={[styles.stateText, { color: theme.caution }]}>{t('availabilitySetupRequired')}</Text>
          </View>
        ) : null}

        {!isLoading && !error ? (
          <>
            <View style={[styles.legendCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              {[
                { label: t('availabilityAvailable'), color: theme.success },
                { label: t('availabilityUnavailableDay'), color: theme.fail },
                { label: t('availabilityTapToCycle'), color: theme.textSecondary },
              ].map((item) => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.calendarCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSoft }]}>
              <View style={styles.dayGrid}>
                {monthDates.map((date) => {
                  const isAvailable = availableSet.has(date);
                  const isUnavailable = unavailableSet.has(date);
                  const borderColor = isAvailable
                    ? theme.success
                    : isUnavailable
                      ? theme.fail
                      : theme.borderSoft;
                  const backgroundColor = isAvailable
                    ? `${theme.success}18`
                    : isUnavailable
                      ? `${theme.fail}18`
                      : theme.surface;
                  return (
                    <TouchableOpacity
                      key={date}
                      style={[
                        styles.dayButton,
                        {
                          backgroundColor,
                          borderColor,
                        },
                      ]}
                      onPress={() => cycleDate(date)}
                      activeOpacity={0.86}
                    >
                      <Text style={[styles.dayText, { color: theme.textPrimary }]}>
                        {formatDayLabel(date, language)}
                      </Text>
                      <Ionicons
                        name={
                          isAvailable
                            ? 'checkmark-circle'
                            : isUnavailable
                              ? 'close-circle'
                              : 'ellipse-outline'
                        }
                        size={18}
                        color={isAvailable ? theme.success : isUnavailable ? theme.fail : theme.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.noteCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{t('availabilityNoteLabel')}</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('availabilityNotePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={1000}
                style={[
                  styles.noteInput,
                  {
                    color: theme.textPrimary,
                    borderColor: theme.borderSoft,
                    backgroundColor: theme.surfaceMuted,
                  },
                ]}
              />
              <PrimaryButton
                title={submitting ? t('availabilitySubmitting') : t('availabilitySubmit')}
                onPress={() => void handleSubmit()}
                disabled={submitting || data?.setupRequired}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: layoutTokens.screenTop + 4,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerHint: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    overflow: 'hidden',
    gap: 18,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    color: 'rgba(226,232,240,0.72)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 6,
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(15,23,42,0.44)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 12,
  },
  monthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthControlsCompact: {
    gap: 8,
  },
  monthButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(15,23,42,0.44)',
  },
  monthCenter: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(15,23,42,0.44)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  monthCenterText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  legendCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: '31.6%',
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    justifyContent: 'space-between',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '800',
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  noteInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
});
