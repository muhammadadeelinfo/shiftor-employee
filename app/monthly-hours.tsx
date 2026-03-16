import { useEffect, useMemo, useState } from 'react';
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
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

export default function MonthlyHoursScreen() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
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
                      ${escapeHtml(formatSignedMinutesLabel(summary.deltaMinutes, t))}
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
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const shareTitle = t('reportGeneratePdf');
      const fileName = `shiftor-monthly-hours-${selectedMonthKey}.pdf`;
      const target = `${FileSystem.documentDirectory ?? ''}${fileName}`;
      let savedUri: string | null = null;

      if (FileSystem.documentDirectory) {
        try {
          await FileSystem.copyAsync({ from: uri, to: target });
          savedUri = target;
        } catch {
          savedUri = null;
        }
      }

      if (savedUri) {
        const relative = savedUri.replace(FileSystem.documentDirectory ?? '', 'Files/');
        presentExportNotice(
          t('reportDownloadedTitle'),
          t('reportDownloadedBody', { path: relative }),
          'success'
        );
      } else if (await Sharing.isAvailableAsync()) {
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
          <View style={[styles.monthSwitcher, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
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
          colors={['rgba(129, 140, 248, 0.2)', 'rgba(56, 189, 248, 0.1)', 'rgba(12, 19, 37, 0.16)']}
          start={[0, 0]}
          end={[1, 1]}
          style={[styles.heroCard, { borderColor: theme.borderSoft }]}
        >
          <View style={styles.heroGlow} />
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
                  <Text style={[styles.heroMetricHint, { color: theme.textSecondary }]}>
                    {t('accountMonthlyHoursPlanned')}: {formatMinutesLabel(summary.plannedMinutes, t)}
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

              <View
                style={[
                  styles.progressWrap,
                  { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
                ]}
              >
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressSectionTitle, { color: theme.textPrimary }]}>
                    {t('accountMonthlyHoursWorked')}
                  </Text>
                  <View
                    style={[
                      styles.progressBadge,
                      { backgroundColor: 'rgba(12, 19, 37, 0.36)', borderColor: 'rgba(255,255,255,0.12)' },
                    ]}
                  >
                    <Text style={[styles.progressBadgeText, { color: theme.textPrimary }]}>{progressPercent}</Text>
                  </View>
                </View>
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
                  <Text style={[styles.progressValue, { color: theme.textPrimary }]}>
                    {t('accountMonthlyHoursShiftCount', { count: summary.shiftsCount })}
                  </Text>
                </View>
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
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
                {t('accountMonthlyHoursBreakdownTitle')}
              </Text>
              <View style={[styles.panelBadge, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
                <Text style={[styles.panelBadgeText, { color: theme.textSecondary }]}>
                  {t('accountMonthlyHoursShiftCount', { count: summary.shiftsCount })}
                </Text>
              </View>
            </View>
            <View style={styles.statusGrid}>
              {statusCards.map((item) => (
                <View
                  key={item.label}
                  style={[styles.statusCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
                >
                  <View style={[styles.statusIconWrap, { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                    <Ionicons name={item.icon} size={15} color={item.tone} />
                  </View>
                  <Text style={[styles.statusValue, { color: item.tone }]}>{item.value}</Text>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
              {t('accountMonthlyHoursLocationsTitle')}
            </Text>
            {objectTotals.length > 0 ? (
              <View style={[styles.panelBadge, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
                <Text style={[styles.panelBadgeText, { color: theme.textSecondary }]}>{objectTotals.length}</Text>
              </View>
            ) : null}
          </View>
          {objectTotals.length > 0 ? (
            <View style={styles.locationList}>
              {objectTotals.map((item, index) => (
                <View
                  key={`${item.objectId ?? item.objectTitle ?? 'location'}-${index}`}
                  style={[styles.locationRow, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}
                >
                  <View style={styles.locationHeader}>
                    <View style={styles.locationCopy}>
                      <Text style={[styles.locationTitle, { color: theme.textPrimary }]}>
                        {item.objectTitle?.trim() || t('notProvided')}
                      </Text>
                      <Text style={[styles.locationMeta, { color: theme.textSecondary }]}>
                        {t('accountMonthlyHoursShiftCount', { count: item.shiftsCount ?? 0 })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.locationWorkedBadge,
                        { backgroundColor: 'rgba(12, 19, 37, 0.3)', borderColor: 'rgba(255,255,255,0.08)' },
                      ]}
                    >
                      <Text style={[styles.locationWorkedBadgeText, { color: theme.primary }]}>
                        {formatMinutesLabel(item.workedMinutes ?? 0, t)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationFooter}>
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
  exportButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.55,
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
  monthSwitcherWrap: {
    gap: 10,
  },
  monthSwitcher: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthSwitcherButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSwitcherButtonDisabled: {
    opacity: 0.45,
  },
  monthSwitcherCenter: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthSwitcherIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSwitcherCopy: {
    flex: 1,
  },
  monthSwitcherLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthSwitcherValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
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
    borderRadius: 24,
    padding: 18,
    gap: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -18,
    right: -12,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
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
  heroMetricHint: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
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
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  progressBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  progressBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  },
  panelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
    padding: 14,
    gap: 8,
  },
  statusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationCopy: {
    flex: 1,
    gap: 2,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  locationMeta: {
    fontSize: 12,
  },
  locationTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  locationPlanned: {
    fontSize: 12,
    flex: 1,
  },
  locationWorkedBadge: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locationWorkedBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  locationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
