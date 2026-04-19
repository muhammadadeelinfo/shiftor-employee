import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@hooks/useSupabaseAuth';
import { BackButton } from '@shared/components/BackButton';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { useTheme } from '@shared/themeContext';
import { getContentMaxWidth, shouldStackForCompactWidth } from '@shared/utils/responsiveLayout';
import {
  fetchMonthlyHours,
  formatMinutesLabel,
  formatMonthKey,
  formatMonthlyHoursMonthLabel,
  formatDeltaMinutesLabel,
  getEmployeeApiBaseUrl,
  getMonthlyHoursShiftTimings,
  type MonthlyHoursShiftTiming,
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const shiftMonthKey = (monthKey: string, offset: number) => {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }

  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return formatMonthKey(next);
};

const formatTimingDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatTimingTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatTimingWindow = (shift: MonthlyHoursShiftTiming, t: (key: any, params?: Record<string, string | number>) => string) => {
  const start = formatTimingTime(shift.start);
  const end = formatTimingTime(shift.end);
  if (start === '—' && end === '—') {
    return t('notProvided');
  }
  return `${start} - ${end}`;
};

const getCompletionRatio = (workedMinutes?: number | null, plannedMinutes?: number | null) => {
  if (!plannedMinutes || plannedMinutes <= 0) return 0;
  return Math.max(0, Math.min(1, (workedMinutes ?? 0) / plannedMinutes));
};

export default function MonthlyHoursScreen() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const apiBaseUrl = getEmployeeApiBaseUrl();
  const currentMonthKey = useMemo(() => formatMonthKey(new Date()), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportNotice, setExportNotice] = useState<{
    title: string;
    body: string;
    tone: 'success' | 'error';
  } | null>(null);
  const canGoToNextMonth = selectedMonthKey < currentMonthKey;

  const { data, error, isLoading } = useQuery({
    queryKey: ['employeeMonthlyHoursPage', user?.id, selectedMonthKey, apiBaseUrl],
    queryFn: () =>
      fetchMonthlyHours({
        apiBaseUrl,
        accessToken: session?.access_token,
        month: selectedMonthKey,
        t,
      }),
    enabled: Boolean(user?.id && session?.access_token && apiBaseUrl),
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const monthLabel = useMemo(
    () => formatMonthlyHoursMonthLabel(summary?.month ?? selectedMonthKey, language),
    [language, selectedMonthKey, summary?.month]
  );
  const contentMaxWidth = getContentMaxWidth(width) ?? 1080;
  const isCompactPhoneLayout = shouldStackForCompactWidth(width);
  const isTabletLayout = width >= 768;
  const isNarrowPhoneLayout = width < 390;
  const useSingleRowTimingStats = width < 460;
  const progress = summary ? getCompletionRatio(summary.workedMinutes, summary.plannedMinutes) : 0;
  const progressPercent: `${number}%` = `${Math.round(progress * 100)}%`;
  const balanceTone = summary
    ? summary.deltaMinutes < 0
      ? theme.fail
      : summary.deltaMinutes > 0
        ? theme.success
        : theme.textPrimary
    : theme.textPrimary;
  const heroBalanceTone =
    summary && summary.deltaMinutes === 0 ? '#f8fafc' : balanceTone;
  const statusCards = summary
    ? [
        {
          label: t('accountMonthlyHoursStatusComplete'),
          value: summary.completeCount,
          tone: theme.success,
          icon: 'checkmark-done-outline' as const,
        },
        {
          label: t('accountMonthlyHoursStatusOpen'),
          value: summary.openCount,
          tone: theme.caution,
          icon: 'time-outline' as const,
        },
        {
          label: t('accountMonthlyHoursStatusMissing'),
          value: summary.missingCount,
          tone: theme.fail,
          icon: 'alert-circle-outline' as const,
        },
        {
          label: t('accountMonthlyHoursStatusScheduled'),
          value: summary.scheduledCount,
          tone: theme.info,
          icon: 'calendar-outline' as const,
        },
      ]
    : [];
  const objectTotals = getObjectTotals(data?.objectTotals);
  const shiftTimings = useMemo(() => getMonthlyHoursShiftTimings(data), [data]);

  const presentExportNotice = (
    title: string,
    body: string,
    tone: 'success' | 'error'
  ) => {
    setExportNotice({ title, body, tone });
  };

  useEffect(() => {
    if (!exportNotice) return;
    const timeoutId = setTimeout(() => {
      setExportNotice(null);
    }, 3600);
    return () => clearTimeout(timeoutId);
  }, [exportNotice]);

  const handleExportPdf = async () => {
    if (!summary || isExportingPdf) return;
    setIsExportingPdf(true);

    try {
      const statusHtml = statusCards
        .map(
          (item) => `
            <div class="stat-box">
              <div class="stat-value" style="color:${item.tone}">${item.value}</div>
              <div class="stat-label">${escapeHtml(item.label)}</div>
            </div>
          `
        )
        .join('');

      const locationsHtml =
        objectTotals.length > 0
          ? objectTotals
              .map(
                (item) => `
                  <div class="location-row">
                    <div class="location-head">
                      <div>
                        <div class="location-title">${escapeHtml(item.objectTitle?.trim() || t('notProvided'))}</div>
                        <div class="location-meta">${escapeHtml(
                          t('accountMonthlyHoursShiftCount', { count: item.shiftsCount ?? 0 })
                        )}</div>
                      </div>
                      <div class="worked-pill">${escapeHtml(
                        formatMinutesLabel(item.workedMinutes ?? 0, t)
                      )}</div>
                    </div>
                    <div class="location-foot">
                      <span>${escapeHtml(
                        `${t('accountMonthlyHoursPlanned')}: ${formatMinutesLabel(item.plannedMinutes ?? 0, t)}`
                      )}</span>
                      <strong>${escapeHtml(
                        item.plannedMinutes && item.plannedMinutes > 0
                          ? `${Math.round(((item.workedMinutes ?? 0) / item.plannedMinutes) * 100)}%`
                          : progressPercent
                      )}</strong>
                    </div>
                  </div>
                `
              )
              .join('')
          : `<p class="empty">${escapeHtml(t('accountMonthlyHoursNoLocations'))}</p>`;
      const shiftTimingsHtml =
        shiftTimings.length > 0
          ? shiftTimings
              .map(
                (shift) => `
                  <div class="timing-row">
                    <div class="timing-head">
                      <div>
                        <div class="location-title">${escapeHtml(shift.location || shift.title)}</div>
                        <div class="location-meta">${escapeHtml(formatTimingDate(shift.clockIn ?? shift.clockOut ?? shift.start))}</div>
                      </div>
                      <div class="worked-pill">${escapeHtml(formatTimingWindow(shift, t))}</div>
                    </div>
                  <div class="timing-grid timing-grid-three">
                    <div class="timing-box">
                      <div class="timing-label">${escapeHtml(t('accountMonthlyHoursWorked'))}</div>
                      <div class="timing-value">${escapeHtml(formatMinutesLabel(shift.workedMinutes, t))}</div>
                    </div>
                    <div class="timing-box">
                      <div class="timing-label">${escapeHtml(t('accountMonthlyHoursClockInLabel'))}</div>
                      <div class="timing-value">${escapeHtml(formatTimingTime(shift.clockIn))}</div>
                      </div>
                      <div class="timing-box">
                        <div class="timing-label">${escapeHtml(t('accountMonthlyHoursClockOutLabel'))}</div>
                        <div class="timing-value">${escapeHtml(formatTimingTime(shift.clockOut))}</div>
                      </div>
                    </div>
                  </div>
                `
              )
              .join('')
          : '';

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; padding: 28px; }
              .hero { background: linear-gradient(135deg, #0f2746, #172554 55%, #1e3a5f); color: white; border-radius: 24px; padding: 24px; }
              .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.72; margin-bottom: 8px; }
              .title { font-size: 34px; font-weight: 800; margin: 0 0 10px; }
              .meta { font-size: 14px; opacity: 0.82; margin-bottom: 20px; }
              .summary { display: table; width: 100%; }
              .summary-cell { display: table-cell; vertical-align: top; }
              .metric-label { font-size: 13px; opacity: 0.76; margin-bottom: 6px; }
              .metric-value { font-size: 40px; font-weight: 800; }
              .balance-card { border: 1px solid #334155; border-radius: 18px; padding: 16px; background: rgba(15, 23, 42, 0.28); text-align: right; }
              .progress { margin-top: 22px; }
              .track { height: 12px; border-radius: 999px; background: rgba(255,255,255,0.14); overflow: hidden; }
              .fill { height: 100%; width: ${progressPercent}; background: linear-gradient(90deg, #818cf8, #38bdf8); }
              .progress-meta { margin-top: 10px; display: table; width: 100%; font-size: 13px; opacity: 0.88; }
              .progress-meta span:last-child { display: table-cell; text-align: right; }
              .section { margin-top: 24px; border: 1px solid #dbe4f0; border-radius: 22px; padding: 20px; }
              .section-title { font-size: 20px; font-weight: 800; margin: 0 0 16px; color: #0f172a; }
              .stats-grid { display: table; width: 100%; border-spacing: 12px 12px; margin: -12px; }
              .stat-box { display: inline-block; width: calc(50% - 12px); box-sizing: border-box; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; margin: 12px 12px 0 0; }
              .stat-value { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
              .stat-label { font-size: 13px; color: #475569; }
              .location-row { border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 14px; }
              .location-row:first-child { border-top: none; padding-top: 0; margin-top: 0; }
              .location-head, .location-foot { display: table; width: 100%; }
              .location-title { font-size: 18px; font-weight: 700; color: #0f172a; }
              .location-meta { font-size: 13px; color: #64748b; margin-top: 4px; }
              .worked-pill { display: table-cell; text-align: right; font-size: 15px; font-weight: 800; color: #2563eb; }
              .location-foot { margin-top: 10px; font-size: 13px; color: #475569; }
              .location-foot strong { display: table-cell; text-align: right; color: #0f172a; }
              .timing-row { border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 14px; }
              .timing-row:first-child { border-top: none; padding-top: 0; margin-top: 0; }
              .timing-head { display: table; width: 100%; margin-bottom: 10px; }
              .timing-grid { display: table; width: 100%; border-spacing: 12px 0; margin: 0 -12px; }
              .timing-grid-three .timing-box { width: calc(33.333% - 12px); }
              .timing-box { display: inline-block; width: calc(50% - 12px); box-sizing: border-box; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; margin: 0 12px 0 0; }
              .timing-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
              .timing-value { font-size: 18px; font-weight: 800; color: #0f172a; }
              .empty { color: #64748b; margin: 0; }
            </style>
          </head>
          <body>
            <div class="hero">
              <div class="eyebrow">${escapeHtml(t('accountMonthlyHoursTitle'))}</div>
              <h1 class="title">${escapeHtml(monthLabel)}</h1>
              <div class="meta">${escapeHtml(t('accountMonthlyHoursShiftCount', { count: summary.shiftsCount }))}</div>
              <div class="summary">
                <div class="summary-cell">
                  <div class="metric-label">${escapeHtml(t('accountMonthlyHoursWorked'))}</div>
                  <div class="metric-value">${escapeHtml(formatMinutesLabel(summary.workedMinutes, t))}</div>
                </div>
                <div class="summary-cell">
                  <div class="balance-card">
                    <div class="metric-label">${escapeHtml(t('accountMonthlyHoursBalance'))}</div>
                    <div class="metric-value" style="font-size:32px;color:${balanceTone}">
                      ${escapeHtml(formatDeltaMinutesLabel(summary.deltaMinutes, t))}
                    </div>
                  </div>
                </div>
              </div>
              <div class="progress">
                <div class="track"><div class="fill"></div></div>
                <div class="progress-meta">
                  <span>${escapeHtml(
                    `${t('accountMonthlyHoursPlanned')}: ${formatMinutesLabel(summary.plannedMinutes, t)}`
                  )}</span>
                  <span>${escapeHtml(progressPercent)}</span>
                </div>
              </div>
            </div>
            <div class="section">
              <h2 class="section-title">${escapeHtml(t('accountMonthlyHoursBreakdownTitle'))}</h2>
              ${statusHtml}
            </div>
            <div class="section">
              <h2 class="section-title">${escapeHtml(t('accountMonthlyHoursLocationsTitle'))}</h2>
              ${locationsHtml}
            </div>
            ${
              shiftTimingsHtml
                ? `<div class="section">
                    <h2 class="section-title">${escapeHtml(t('accountMonthlyHoursClockTimesTitle'))}</h2>
                    ${shiftTimingsHtml}
                  </div>`
                : ''
            }
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const shareTitle = t('reportGeneratePdf');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: shareTitle,
        });
      } else {
        presentExportNotice(t('reportFailedTitle'), t('reportFailedBody'), 'error');
      }
    } catch (pdfError) {
      console.error('Failed to export monthly hours PDF', pdfError);
      presentExportNotice(t('reportFailedTitle'), t('reportFailedBody'), 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isCompactPhoneLayout && styles.contentCompact,
          { paddingBottom: insets.bottom + 28, maxWidth: contentMaxWidth },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BackButton fallbackHref="/account" />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              {t('accountMonthlyHoursPageTitle')}
            </Text>
            <Text style={[styles.headerHint, { color: theme.textSecondary }]}>
              {t('accountMonthlyHoursPageHint')}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('reportGeneratePdf')}
            style={[
              styles.exportButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
              isExportingPdf && styles.exportButtonDisabled,
            ]}
            onPress={() => void handleExportPdf()}
            disabled={!summary || isExportingPdf}
          >
            <Ionicons name={isExportingPdf ? 'hourglass-outline' : 'download-outline'} size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.monthSwitcherWrap}>
          <View
            style={[
              styles.monthSwitcher,
              isCompactPhoneLayout && styles.monthSwitcherCompact,
              { backgroundColor: theme.surface, borderColor: theme.borderSoft },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('accountMonthlyHoursPreviousMonth')}
              style={[styles.monthSwitcherButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
              onPress={() => setSelectedMonthKey((value) => shiftMonthKey(value, -1))}
            >
              <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
            </TouchableOpacity>
            <View
              style={[
                styles.monthSwitcherCenter,
                isCompactPhoneLayout && styles.monthSwitcherCenterCompact,
                { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' },
              ]}
            >
              <View style={[styles.monthSwitcherIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="calendar-clear-outline" size={15} color={theme.primary} />
              </View>
              <View style={styles.monthSwitcherCopy}>
                <Text style={[styles.monthSwitcherLabel, { color: theme.textSecondary }]}>
                  {t('accountMonthlyHoursSelectedMonth')}
                </Text>
                <Text style={[styles.monthSwitcherValue, { color: theme.textPrimary }]}>{monthLabel}</Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('accountMonthlyHoursNextMonth')}
              style={[
                styles.monthSwitcherButton,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                !canGoToNextMonth && styles.monthSwitcherButtonDisabled,
              ]}
              onPress={() => {
                if (!canGoToNextMonth) return;
                setSelectedMonthKey((value) => shiftMonthKey(value, 1));
              }}
              disabled={!canGoToNextMonth}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color={canGoToNextMonth ? theme.textPrimary : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {selectedMonthKey !== currentMonthKey ? (
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.monthResetChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
              onPress={() => setSelectedMonthKey(currentMonthKey)}
            >
              <Ionicons name="refresh-outline" size={14} color={theme.primary} />
              <Text style={[styles.monthResetText, { color: theme.primary }]}>
                {t('accountMonthlyHoursCurrentMonth')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <LinearGradient
          colors={['#13203f', '#172a52', '#0d152b']}
          start={[0, 0]}
          end={[1, 0.9]}
          style={[styles.heroCard, { borderColor: 'rgba(148, 163, 184, 0.22)' }]}
        >
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowSecondary} />
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: 'rgba(226, 232, 240, 0.72)' }]}>
                {t('accountMonthlyHoursTitle')}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.stateText, { color: 'rgba(226, 232, 240, 0.78)' }]}>
                {t('accountMonthlyHoursLoading')}
              </Text>
            </View>
          ) : summary ? (
            <>
              <View style={[styles.heroStatsRow, isCompactPhoneLayout && styles.heroStatsRowCompact]}>
                <View style={[styles.heroMetricCard, styles.heroGlassCard]}>
                  <Text style={[styles.heroMetricLabel, { color: 'rgba(226, 232, 240, 0.72)' }]}>
                    {t('accountMonthlyHoursWorked')}
                  </Text>
                  <Text style={[styles.heroMetricValue, { color: '#f8fafc' }]}>
                    {formatMinutesLabel(summary.workedMinutes, t)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.balanceCard,
                    styles.heroGlassCard,
                    {
                      backgroundColor:
                        summary.deltaMinutes < 0
                          ? 'rgba(127, 29, 29, 0.3)'
                          : summary.deltaMinutes > 0
                            ? 'rgba(20, 83, 45, 0.34)'
                            : 'rgba(15, 23, 42, 0.24)',
                      borderColor:
                        summary.deltaMinutes < 0
                          ? 'rgba(248, 113, 113, 0.34)'
                          : summary.deltaMinutes > 0
                            ? 'rgba(74, 222, 128, 0.28)'
                            : 'rgba(226, 232, 240, 0.12)',
                    },
                  ]}
                >
                  <Text style={[styles.balanceLabel, { color: 'rgba(226, 232, 240, 0.72)' }]}>
                    {t('accountMonthlyHoursBalance')}
                  </Text>
                  <Text style={[styles.balanceValue, { color: heroBalanceTone }]}>
                    {formatDeltaMinutesLabel(summary.deltaMinutes, t)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.progressWrap,
                  styles.heroGlassCard,
                  { backgroundColor: 'rgba(15, 23, 42, 0.22)', borderColor: 'rgba(226, 232, 240, 0.12)' },
                ]}
              >
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressSectionTitle, { color: 'rgba(226, 232, 240, 0.72)' }]}>
                    {t('accountMonthlyHoursPlanned')}
                  </Text>
                  <View style={[styles.progressBadge, styles.heroGlassBadge]}>
                    <Text style={[styles.progressBadgeText, { color: '#f8fafc' }]}>{progressPercent}</Text>
                  </View>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <LinearGradient
                    colors={['#60a5fa', '#67e8f9']}
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
                  <Text style={[styles.progressLabel, { color: 'rgba(226, 232, 240, 0.72)' }]}>
                    {t('accountMonthlyHoursPlanned')}: {formatMinutesLabel(summary.plannedMinutes, t)}
                  </Text>
                  <Text style={[styles.progressValue, { color: '#f8fafc' }]}>{progressPercent}</Text>
                </View>
              </View>

            </>
          ) : (
            <Text style={[styles.stateText, { color: 'rgba(226, 232, 240, 0.78)' }]}>
              {apiBaseUrl
                ? error instanceof Error
                  ? error.message
                  : t('accountMonthlyHoursUnavailable')
                : t('accountMonthlyHoursUnavailable')}
            </Text>
          )}
        </LinearGradient>

        {summary ? (
          <View style={[styles.panel, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSoft }]}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderCopy}>
                <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
                  {t('accountMonthlyHoursBreakdownTitle')}
                </Text>
              </View>
            </View>
            <View style={[styles.statusGrid, isCompactPhoneLayout && styles.statusGridCompact]}>
              {statusCards.map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.statusCard,
                    isCompactPhoneLayout && styles.statusCardCompact,
                    isTabletLayout && styles.statusCardWide,
                    { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                  ]}
                >
                  <View style={[styles.statusIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name={item.icon} size={15} color={item.tone} />
                  </View>
                  <Text style={[styles.statusValue, { color: item.tone }]}>{item.value}</Text>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.panel, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSoft }]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderCopy}>
              <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
                {t('accountMonthlyHoursLocationsTitle')}
              </Text>
            </View>
          </View>
          {objectTotals.length > 0 ? (
            <View style={styles.locationList}>
              {objectTotals.map((item, index) => (
                <View
                  key={`${item.objectId ?? item.objectTitle ?? 'location'}-${index}`}
                  style={[
                    styles.locationRow,
                    isCompactPhoneLayout && styles.locationRowCompact,
                    { borderColor: theme.borderSoft, backgroundColor: theme.surface },
                  ]}
                >
                  <View style={[styles.locationHeader, isCompactPhoneLayout && styles.locationHeaderCompact]}>
                    <View style={styles.locationCopy}>
                      <Text style={[styles.locationTitle, { color: theme.textPrimary }]}>
                        {item.objectTitle?.trim() || t('notProvided')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.locationWorkedBadge,
                        isCompactPhoneLayout && styles.locationWorkedBadgeCompact,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                      ]}
                    >
                      <Text style={[styles.locationWorkedBadgeText, { color: theme.primary }]}>
                        {formatMinutesLabel(item.workedMinutes ?? 0, t)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationProgressWrap}>
                    <View style={[styles.locationProgressTrack, { backgroundColor: theme.surfaceMuted }]}>
                      <LinearGradient
                        colors={['#60a5fa', '#67e8f9']}
                        start={[0, 0]}
                        end={[1, 0]}
                        style={[
                          styles.locationProgressFill,
                          {
                            width: `${Math.round(
                              getCompletionRatio(item.workedMinutes ?? 0, item.plannedMinutes ?? 0) * 100
                            )}%`,
                            minWidth: (item.workedMinutes ?? 0) > 0 ? 10 : 0,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={[styles.locationFooter, isNarrowPhoneLayout && styles.locationFooterCompact]}>
                    <Text style={[styles.locationPlanned, { color: theme.textSecondary }]}>
                      {t('accountMonthlyHoursPlanned')}: {formatMinutesLabel(item.plannedMinutes ?? 0, t)}
                    </Text>
                    <Text style={[styles.locationTotal, { color: theme.textPrimary }]}>
                      {item.plannedMinutes && item.plannedMinutes > 0
                        ? `${Math.round(((item.workedMinutes ?? 0) / item.plannedMinutes) * 100)}%`
                        : progressPercent}
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

        {summary ? (
          <View style={[styles.panel, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSoft }]}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderCopy}>
                <Text
                  style={[
                    styles.panelTitle,
                    isCompactPhoneLayout && styles.panelTitleCompact,
                    { color: theme.textPrimary },
                  ]}
                >
                  {t('accountMonthlyHoursClockTimesTitle')}
                </Text>
              </View>
            </View>
            {shiftTimings.length > 0 ? (
              <View style={styles.timingList}>
                {shiftTimings.map((shift) => (
                  <View
                    key={shift.id}
                    style={[
                      styles.timingRow,
                      isCompactPhoneLayout && styles.timingRowCompact,
                      { borderColor: theme.borderSoft, backgroundColor: theme.surface },
                    ]}
                  >
                    <View style={[styles.timingHeader, isCompactPhoneLayout && styles.timingHeaderCompact]}>
                      <View style={styles.timingCopy}>
                        <Text style={[styles.timingTitle, { color: theme.textPrimary }]}>
                          {shift.location || shift.title}
                        </Text>
                        <View style={[styles.timingMetaRow, isCompactPhoneLayout && styles.timingMetaRowCompact]}>
                          <Text style={[styles.timingMeta, { color: theme.textSecondary }]}>
                            {formatTimingDate(shift.clockIn ?? shift.clockOut ?? shift.start)}
                          </Text>
                          {isCompactPhoneLayout ? (
                            <View
                              style={[
                                styles.timingInlineWorkedBadge,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                              ]}
                            >
                              <Text style={[styles.timingInlineWorkedLabel, { color: theme.textSecondary }]}>
                                {t('accountMonthlyHoursWorked')}
                              </Text>
                              <Text style={[styles.timingInlineWorkedValue, { color: theme.textPrimary }]}>
                                {formatMinutesLabel(shift.workedMinutes, t)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View
                        style={[
                          styles.locationWorkedBadge,
                          isCompactPhoneLayout && styles.locationWorkedBadgeCompact,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                        ]}
                      >
                        <Text style={[styles.locationWorkedBadgeText, { color: theme.primary }]}>
                          {formatTimingWindow(shift, t)}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.timingStats,
                        useSingleRowTimingStats && styles.timingStatsCompact,
                      ]}
                    >
                      {useSingleRowTimingStats ? (
                        <View
                          style={[
                            styles.timingStatCard,
                            styles.timingStatCardCompactWorked,
                            styles.timingStatCardCompactThird,
                            { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.timingStatLabel,
                              styles.timingStatLabelCompact,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {t('accountMonthlyHoursWorked')}
                          </Text>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.85}
                            style={[
                              styles.timingStatValue,
                              styles.timingStatValueCompact,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {formatMinutesLabel(shift.workedMinutes, t)}
                          </Text>
                        </View>
                      ) : null}
                      {useSingleRowTimingStats ? null : (
                        <View
                          style={[
                            styles.timingStatCard,
                            styles.timingStatCardWorked,
                            isTabletLayout && styles.timingStatCardWide,
                            { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                          ]}
                        >
                          <Text style={[styles.timingStatLabel, { color: theme.textSecondary }]}>
                            {t('accountMonthlyHoursWorked')}
                          </Text>
                          <Text style={[styles.timingStatValue, { color: theme.textPrimary }]}>
                            {formatMinutesLabel(shift.workedMinutes, t)}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.timingStatCard,
                          useSingleRowTimingStats && styles.timingStatCardCompactTime,
                          useSingleRowTimingStats && styles.timingStatCardCompactThird,
                          isTabletLayout && styles.timingStatCardWide,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.timingStatLabel,
                            useSingleRowTimingStats && styles.timingStatLabelCompact,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {t('accountMonthlyHoursClockInLabel')}
                        </Text>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          style={[
                            styles.timingStatValue,
                            useSingleRowTimingStats && styles.timingStatValueCompact,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {formatTimingTime(shift.clockIn)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.timingStatCard,
                          useSingleRowTimingStats && styles.timingStatCardCompactTime,
                          useSingleRowTimingStats && styles.timingStatCardCompactThird,
                          isTabletLayout && styles.timingStatCardWide,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.timingStatLabel,
                            useSingleRowTimingStats && styles.timingStatLabelCompact,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {t('accountMonthlyHoursClockOutLabel')}
                        </Text>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          style={[
                            styles.timingStatValue,
                            useSingleRowTimingStats && styles.timingStatValueCompact,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {formatTimingTime(shift.clockOut)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {t('accountMonthlyHoursClockTimesEmpty')}
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
      {exportNotice ? (
        <View pointerEvents="box-none" style={[styles.noticeLayer, { bottom: insets.bottom + 18 }]}>
          <LinearGradient
            colors={
              exportNotice.tone === 'success'
                ? ['rgba(22, 101, 52, 0.96)', 'rgba(15, 23, 42, 0.99)']
                : ['rgba(127, 29, 29, 0.96)', 'rgba(15, 23, 42, 0.99)']
            }
            start={[0, 0]}
            end={[1, 1]}
            style={[
              styles.noticeToast,
              {
                borderColor: exportNotice.tone === 'success' ? 'rgba(34, 197, 94, 0.38)' : 'rgba(239, 68, 68, 0.38)',
                shadowColor: exportNotice.tone === 'success' ? theme.success : theme.fail,
              },
            ]}
          >
            <View
              style={[
                styles.noticeIconWrap,
                styles.noticeIconWrapCompact,
                {
                  backgroundColor:
                    exportNotice.tone === 'success'
                      ? 'rgba(34, 197, 94, 0.16)'
                      : 'rgba(239, 68, 68, 0.16)',
                },
              ]}
            >
              <Ionicons
                name={exportNotice.tone === 'success' ? 'checkmark' : 'alert'}
                size={18}
                color={exportNotice.tone === 'success' ? theme.success : theme.fail}
              />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={[styles.noticeTitle, styles.noticeTitleCompact, { color: theme.textPrimary }]}>
                {exportNotice.title}
              </Text>
              <Text
                numberOfLines={3}
                style={[styles.noticeBody, styles.noticeBodyCompact, { color: theme.textSecondary }]}
              >
                {exportNotice.body}
              </Text>
            </View>
            <TouchableOpacity style={styles.noticeClose} onPress={() => setExportNotice(null)}>
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ) : null}
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
  noticeLayer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  noticeToast: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 28,
    elevation: 14,
  },
  noticeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noticeIconWrapCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 0,
    flexShrink: 0,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
  },
  noticeTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  noticeTitleCompact: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  noticeBody: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
  },
  noticeBodyCompact: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: layoutTokens.screenTop + 4,
    gap: 18,
  },
  contentCompact: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  exportButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.55,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerHint: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  monthSwitcherWrap: {
    gap: 12,
  },
  monthSwitcher: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthSwitcherCompact: {
    padding: 10,
    gap: 10,
  },
  monthSwitcherButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSwitcherButtonDisabled: {
    opacity: 0.45,
  },
  monthSwitcherCenter: {
    flex: 1,
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthSwitcherCenterCompact: {
    minHeight: 58,
    paddingHorizontal: 12,
    gap: 10,
  },
  monthSwitcherIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSwitcherCopy: {
    flex: 1,
  },
  monthSwitcherLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  monthSwitcherValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  monthResetChip: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthResetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 22,
    gap: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowPrimary: {
    position: 'absolute',
    top: -48,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(96, 165, 250, 0.18)',
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -70,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
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
    letterSpacing: 1.2,
  },
  heroMonth: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  shiftsBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroGlassBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    borderColor: 'rgba(226, 232, 240, 0.14)',
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
  heroStatsRowCompact: {
    flexDirection: 'column',
  },
  heroMetricCard: {
    flex: 1,
    borderRadius: 22,
    padding: 18,
  },
  heroGlassCard: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    borderColor: 'rgba(226, 232, 240, 0.12)',
  },
  heroMetricLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroMetricValue: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  heroMetricHint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
  },
  balanceCard: {
    minWidth: 172,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  balanceValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  progressWrap: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  progressBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  progressBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 14,
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
  heroSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroSummaryGridCompact: {
    gap: 8,
  },
  heroSummaryGridWide: {
    flexWrap: 'nowrap',
  },
  heroSummaryCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  heroSummaryCardCompact: {
    minWidth: '31%',
    padding: 12,
  },
  heroSummaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroSummaryValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  panelHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  panelTitleCompact: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  panelBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  panelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusGridCompact: {
    gap: 10,
  },
  statusCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  statusCardCompact: {
    width: '47%',
    padding: 14,
  },
  statusCardWide: {
    width: '23.5%',
  },
  statusIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationList: {
    gap: 14,
  },
  locationRow: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  locationRowCompact: {
    padding: 14,
    gap: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationHeaderCompact: {
    gap: 10,
  },
  locationCopy: {
    flex: 1,
    gap: 2,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  locationMeta: {
    fontSize: 13,
  },
  locationTotal: {
    fontSize: 14,
    fontWeight: '800',
  },
  locationPlanned: {
    fontSize: 13,
    flex: 1,
  },
  locationWorkedBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationWorkedBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  locationProgressWrap: {
    gap: 8,
  },
  locationProgressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  locationProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  locationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationFooterCompact: {
    alignItems: 'flex-start',
  },
  timingList: {
    gap: 14,
  },
  timingRow: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  timingRowCompact: {
    padding: 14,
    gap: 12,
  },
  timingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  timingHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  timingCopy: {
    flex: 1,
    gap: 2,
  },
  timingTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  timingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  timingMetaRowCompact: {
    justifyContent: 'space-between',
  },
  timingMeta: {
    fontSize: 13,
  },
  timingInlineWorkedBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timingInlineWorkedLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timingInlineWorkedValue: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  timingStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timingStatsCompact: {
    flexWrap: 'nowrap',
    gap: 8,
  },
  timingStatCard: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  timingStatCardWide: {
    minWidth: 0,
  },
  timingStatCardCompactThird: {
    minWidth: 0,
    flexBasis: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timingStatCardCompactWorked: {
    flex: 0.82,
  },
  timingStatCardCompactTime: {
    flex: 1.08,
  },
  timingStatCardWorked: {
    backgroundColor: '#0f172a',
  },
  timingStatLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  timingStatLabelCompact: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  timingStatValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  timingStatValueCompact: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  locationWorkedBadgeCompact: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
