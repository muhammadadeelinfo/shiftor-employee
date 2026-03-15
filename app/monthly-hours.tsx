import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import {
  fetchMonthlyHours,
  formatMinutesLabel,
  formatMonthKey,
  formatMonthlyHoursMonthLabel,
  formatSignedMinutesLabel,
  getEmployeeApiBaseUrl,
} from '@features/account/monthlyHours';

type ObjectTotal = {
  objectId?: string | null;
  objectTitle?: string;
  plannedMinutes?: number;
  workedMinutes?: number;
  shiftsCount?: number;
};

const getObjectTotals = (value: unknown): ObjectTotal[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ObjectTotal => Boolean(entry) && typeof entry === 'object');
};

export default function MonthlyHoursScreen() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const apiBaseUrl = getEmployeeApiBaseUrl();
  const currentMonthKey = useMemo(() => formatMonthKey(new Date()), []);

  const { data, error, isLoading } = useQuery({
    queryKey: ['employeeMonthlyHoursPage', user?.id, currentMonthKey, apiBaseUrl],
    queryFn: () =>
      fetchMonthlyHours({
        apiBaseUrl,
        accessToken: session?.access_token,
        month: currentMonthKey,
        t,
      }),
    enabled: Boolean(user?.id && session?.access_token && apiBaseUrl),
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const monthLabel = useMemo(
    () => formatMonthlyHoursMonthLabel(summary?.month ?? currentMonthKey, language),
    [currentMonthKey, language, summary?.month]
  );
  const progress = summary
    ? Math.max(
        0,
        Math.min(1, summary.plannedMinutes > 0 ? summary.workedMinutes / summary.plannedMinutes : 0)
      )
    : 0;
  const progressPercent: `${number}%` = `${Math.round(progress * 100)}%`;
  const balanceTone = summary
    ? summary.deltaMinutes < 0
      ? theme.fail
      : summary.deltaMinutes > 0
        ? theme.success
        : theme.textPrimary
    : theme.textPrimary;
  const statusCards = summary
    ? [
        {
          label: t('accountMonthlyHoursStatusComplete'),
          value: summary.completeCount,
          tone: theme.success,
        },
        {
          label: t('accountMonthlyHoursStatusOpen'),
          value: summary.openCount,
          tone: theme.caution,
        },
        {
          label: t('accountMonthlyHoursStatusMissing'),
          value: summary.missingCount,
          tone: theme.fail,
        },
        {
          label: t('accountMonthlyHoursStatusScheduled'),
          value: summary.scheduledCount,
          tone: theme.info,
        },
      ]
    : [];
  const objectTotals = getObjectTotals(data?.objectTotals);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('commonBack')}
            style={[styles.backButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              {t('accountMonthlyHoursPageTitle')}
            </Text>
            <Text style={[styles.headerHint, { color: theme.textSecondary }]}>
              {t('accountMonthlyHoursPageHint')}
            </Text>
          </View>
        </View>

        <LinearGradient
          colors={['rgba(129, 140, 248, 0.2)', 'rgba(56, 189, 248, 0.1)', 'rgba(12, 19, 37, 0.16)']}
          start={[0, 0]}
          end={[1, 1]}
          style={[styles.heroCard, { borderColor: theme.borderSoft }]}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: theme.textSecondary }]}>
                {t('accountMonthlyHoursTitle')}
              </Text>
              <Text style={[styles.heroMonth, { color: theme.textPrimary }]}>{monthLabel}</Text>
            </View>
            {summary ? (
              <View style={[styles.shiftsBadge, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
                <Text style={[styles.shiftsBadgeText, { color: theme.textPrimary }]}>
                  {t('accountMonthlyHoursShiftCount', { count: summary.shiftsCount })}
                </Text>
              </View>
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('accountMonthlyHoursLoading')}
              </Text>
            </View>
          ) : summary ? (
            <>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroMetric}>
                  <Text style={[styles.heroMetricLabel, { color: theme.textSecondary }]}>
                    {t('accountMonthlyHoursWorked')}
                  </Text>
                  <Text style={[styles.heroMetricValue, { color: theme.textPrimary }]}>
                    {formatMinutesLabel(summary.workedMinutes, t)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.balanceCard,
                    {
                      backgroundColor:
                        summary.deltaMinutes < 0
                          ? 'rgba(239, 68, 68, 0.14)'
                          : summary.deltaMinutes > 0
                            ? 'rgba(34, 197, 94, 0.14)'
                            : 'rgba(255,255,255,0.08)',
                      borderColor:
                        summary.deltaMinutes < 0
                          ? 'rgba(239, 68, 68, 0.34)'
                          : summary.deltaMinutes > 0
                            ? 'rgba(34, 197, 94, 0.32)'
                            : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                >
                  <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                    {t('accountMonthlyHoursBalance')}
                  </Text>
                  <Text style={[styles.balanceValue, { color: balanceTone }]}>
                    {formatSignedMinutesLabel(summary.deltaMinutes, t)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <LinearGradient
                    colors={[theme.primary, theme.info]}
                    start={[0, 0]}
                    end={[1, 0]}
                    style={[
                      styles.progressFill,
                      {
                        width: progressPercent,
                        minWidth: progress > 0 ? 10 : 0,
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressMeta}>
                  <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                    {t('accountMonthlyHoursPlanned')}: {formatMinutesLabel(summary.plannedMinutes, t)}
                  </Text>
                  <Text style={[styles.progressValue, { color: theme.textPrimary }]}>{progressPercent}</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                {[
                  {
                    label: t('accountMonthlyHoursWorked'),
                    value: formatMinutesLabel(summary.workedMinutes, t),
                    tone: theme.primary,
                  },
                  {
                    label: t('accountMonthlyHoursPlanned'),
                    value: formatMinutesLabel(summary.plannedMinutes, t),
                    tone: theme.info,
                  },
                  {
                    label: t('accountMonthlyHoursBalance'),
                    value: formatSignedMinutesLabel(summary.deltaMinutes, t),
                    tone: balanceTone,
                  },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={[styles.statCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
                  >
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                    <Text style={[styles.statValue, { color: stat.tone }]}>{stat.value}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>
              {apiBaseUrl
                ? error instanceof Error
                  ? error.message
                  : t('accountMonthlyHoursUnavailable')
                : t('accountMonthlyHoursUnavailable')}
            </Text>
          )}
        </LinearGradient>

        {summary ? (
          <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
              {t('accountMonthlyHoursBreakdownTitle')}
            </Text>
            <View style={styles.statusGrid}>
              {statusCards.map((item) => (
                <View
                  key={item.label}
                  style={[styles.statusCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
                >
                  <Text style={[styles.statusValue, { color: item.tone }]}>{item.value}</Text>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
            {t('accountMonthlyHoursLocationsTitle')}
          </Text>
          {objectTotals.length > 0 ? (
            <View style={styles.locationList}>
              {objectTotals.map((item, index) => (
                <View
                  key={`${item.objectId ?? item.objectTitle ?? 'location'}-${index}`}
                  style={[styles.locationRow, { borderColor: theme.borderSoft }]}
                >
                  <View style={styles.locationCopy}>
                    <Text style={[styles.locationTitle, { color: theme.textPrimary }]}>
                      {item.objectTitle?.trim() || t('notProvided')}
                    </Text>
                    <Text style={[styles.locationMeta, { color: theme.textSecondary }]}>
                      {t('accountMonthlyHoursShiftCount', { count: item.shiftsCount ?? 0 })}
                    </Text>
                  </View>
                  <View style={styles.locationTotals}>
                    <Text style={[styles.locationTotal, { color: theme.primary }]}>
                      {formatMinutesLabel(item.workedMinutes ?? 0, t)}
                    </Text>
                    <Text style={[styles.locationPlanned, { color: theme.textSecondary }]}>
                      {t('accountMonthlyHoursPlanned')}: {formatMinutesLabel(item.plannedMinutes ?? 0, t)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('accountMonthlyHoursNoLocations')}
            </Text>
          )}
        </View>
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
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerHint: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 16,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroMonth: {
    marginTop: 5,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  shiftsBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shiftsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stateBlock: {
    alignItems: 'flex-start',
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  heroMetric: {
    flex: 1,
  },
  heroMetricLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  heroMetricValue: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  balanceCard: {
    minWidth: 128,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  progressWrap: {
    gap: 8,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  statusValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationList: {
    gap: 12,
  },
  locationRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  locationCopy: {
    gap: 2,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  locationMeta: {
    fontSize: 12,
  },
  locationTotals: {
    gap: 2,
  },
  locationTotal: {
    fontSize: 15,
    fontWeight: '800',
  },
  locationPlanned: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
