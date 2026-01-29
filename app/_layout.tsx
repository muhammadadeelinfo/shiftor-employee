import { useCallback, useEffect, useMemo, useState } from 'react';
import { Slot, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Pressable,
  Linking,
  Alert,
  ScrollView,
  useWindowDimensions,
  Modal,
  Switch,
  TextInput,
} from 'react-native';
import { AuthProvider } from '@hooks/useSupabaseAuth';
import { queryClient } from '@lib/queryClient';
import { useExpoPushToken } from '@hooks/useExpoPushToken';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { NotificationBell } from '@shared/components/NotificationBell';
import { NotificationProvider, useNotifications } from '@shared/context/NotificationContext';
import {
  LanguageProvider,
  useLanguage,
} from '@shared/context/LanguageContext';
import {
  CalendarSelectionProvider,
  useCalendarSelection,
} from '@shared/context/CalendarSelectionContext';
import { ThemeProvider, useTheme } from '@shared/themeContext';
import * as Calendar from 'expo-calendar';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useQuery } from '@tanstack/react-query';
import { getShifts, type Shift } from '@features/shifts/shiftsService';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const hiddenTopBarPaths = ['/login', '/signup', '/guest'];

type ReportOptionKey =
  | 'includeEmployeeName'
  | 'includeEmail'
  | 'includePhone'
  | 'includeObjectName'
  | 'includeObjectAddress'
  | 'includeTotalHours'
  | 'includeShiftLocation';

type ReportOptions = Record<ReportOptionKey, boolean>;

const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  includeEmployeeName: true,
  includeEmail: true,
  includePhone: false,
  includeObjectName: true,
  includeObjectAddress: true,
  includeTotalHours: true,
  includeShiftLocation: true,
};

const formatHourValue = (hours: number) => {
  const rounded = Math.round(hours * 100) / 100;
  if (!Number.isFinite(rounded)) return '0';
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
};

const REPORT_FOLDER_NAME = 'EmployeePortalReports';

const buildReportDestination = async (reportType: 'monthly' | 'summary') => {
  const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!baseDirectory) {
    return null;
  }
  const directory = `${baseDirectory}${REPORT_FOLDER_NAME}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
  const slug = reportType === 'monthly' ? 'Monthly' : 'Summary';
  const fileName = `${slug}-Report-${timestamp}.pdf`;
  return { directory, fileName, destination: `${directory}${fileName}` };
};

const saveReportToDevice = async (uri: string, reportType: 'monthly' | 'summary') => {
  const info = await buildReportDestination(reportType);
  if (!info) return null;
  await FileSystem.copyAsync({
    from: uri,
    to: info.destination,
  });
  return info.destination;
};

function LayoutContentInner() {
  const pushToken = useExpoPushToken();
  const pathname = usePathname();
  const router = useRouter();
  const [quickActionMenuOpen, setQuickActionMenuOpen] = useState(false);
  const { t } = useLanguage();
  const { selectedCalendars, toggleCalendarSelection } = useCalendarSelection();
  const [calendars, setCalendars] = useState<Calendar.Calendar[] | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [previewReportType, setPreviewReportType] = useState<'monthly' | 'summary' | null>(
    null
  );
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS);
  const [includedShiftKeys, setIncludedShiftKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [customReportTitle, setCustomReportTitle] = useState(() => t('reportGeneratePdf'));
  const [customReportDescription, setCustomReportDescription] = useState(() => t('reportSummaryDescribe'));
  const [reportNote, setReportNote] = useState('');
  const [reportThemeSelection, setReportThemeSelection] = useState<'default' | 'soft'>('default');
  const formatShiftKey = useCallback(
    (shift: Shift) => shift.id ?? `${shift.start}-${shift.end}`,
    []
  );
  const includedShiftSet = useMemo(() => new Set(includedShiftKeys), [includedShiftKeys]);
  const { user, loading } = useAuth();
  const userId = user?.id;
  const { data: quickShifts = [] } = useQuery({
    queryKey: ['quickActionsShifts', userId],
    queryFn: () => getShifts(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });
  const monthlyShifts = useMemo(() => {
    const monthStart = new Date(selectedMonth);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    return quickShifts.filter((shift) => {
      const start = new Date(shift.start);
      return start >= monthStart && start < monthEnd;
    });
  }, [quickShifts, selectedMonth]);
  const monthSelectorLabel = useMemo(() => {
    return selectedMonth.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedMonth]);
  const changeMonth = useCallback((direction: number) => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  }, []);
  const canAdvanceMonth = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return selectedMonth < currentMonthStart;
  }, [selectedMonth]);
  const selectedShifts = useMemo(
    () => monthlyShifts.filter((shift) => includedShiftSet.has(formatShiftKey(shift))),
    [monthlyShifts, includedShiftSet, formatShiftKey]
  );
  const reportOptionDefinitions = useMemo<
    { key: ReportOptionKey; label: string }[]
  >(
    () => [
      { key: 'includeEmployeeName', label: t('reportOptionEmployeeName') },
      { key: 'includeEmail', label: t('reportOptionEmail') },
      { key: 'includePhone', label: t('reportOptionPhone') },
      { key: 'includeObjectName', label: t('reportOptionObjectName') },
      { key: 'includeObjectAddress', label: t('reportOptionAddress') },
      { key: 'includeTotalHours', label: t('reportOptionTotalHours') },
      { key: 'includeShiftLocation', label: t('reportOptionShiftLocation') },
    ],
    [t]
  );
  useEffect(() => {
    setCustomReportTitle(t('reportGeneratePdf'));
    setCustomReportDescription(t('reportSummaryDescribe'));
  }, [t]);
  const userReportInfo = useMemo(() => {
    const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const fallbackName = metadata.full_name ?? metadata.name;
    const normalizedName =
      typeof fallbackName === 'string' && fallbackName.trim()
        ? fallbackName
        : typeof user?.email === 'string'
        ? user.email
        : undefined;
    const normalizedEmail =
      typeof metadata.email === 'string' && metadata.email.trim()
        ? metadata.email
        : typeof user?.email === 'string'
        ? user.email
        : undefined;
    const normalizedPhone =
      typeof metadata.phone === 'string' && metadata.phone.trim()
        ? metadata.phone
        : typeof user?.phone === 'string'
        ? user.phone
        : undefined;
    return {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
    };
  }, [user]);
  const toggleReportOption = useCallback((key: ReportOptionKey) => {
    setReportOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  useEffect(() => {
    const nextKeys = monthlyShifts.map(formatShiftKey);
    if (nextKeys.length === 0) {
      setIncludedShiftKeys((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setIncludedShiftKeys((prev) => {
      if (
        prev.length === nextKeys.length &&
        prev.every((key, index) => nextKeys[index] === key)
      ) {
        return prev;
      }
      const preserved = prev.filter((key) => nextKeys.includes(key));
      const additions = nextKeys.filter((key) => !preserved.includes(key));
      return [...preserved, ...additions];
    });
  }, [quickShifts, formatShiftKey]);
  useEffect(() => {
    if (loading) return;

    const authFreePaths = ['/login', '/signup', '/guest'];
    const isAuthFree = pathname ? authFreePaths.some((path) => pathname.startsWith(path)) : false;

    if (!user && !isAuthFree) {
      router.replace('/login');
    }
  }, [loading, pathname, router, user]);

  const shouldShowNotificationBell = pathname
    ? !hiddenTopBarPaths.some((path) => pathname.startsWith(path))
    : true;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { unreadCount } = useNotifications();
  const { theme, mode } = useTheme();
  const reportThemeOptions = useMemo(
    () => ({
      default: [theme.primary, theme.primaryAccent],
      soft: [theme.primaryAccent, theme.surface],
    }),
    [theme]
  );
  const statusBarStyle = mode === 'dark' ? 'light' : 'dark';
  const statusBarBgColor = theme.surface;
  const previewTitle = customReportTitle;
  const previewDescription = customReportDescription;

  useEffect(() => {
    if (Constants.appOwnership === 'expo') {
      console.warn(
        'Remote push notifications are not available in Expo Go (SDK 53+). Use a dev build for push tokens.'
      );
      return;
    }

    let isMounted = true;

    (async () => {
      const { setNotificationHandler } = await import('expo-notifications');
      if (!isMounted) return;

      setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowAlert: true,
        }),
      });
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (pushToken) {
      console.log('Push token registered', pushToken);
    }
  }, [pushToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        if (mounted) {
          setCalendars([]);
        }
        return;
      }
      const available = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      if (mounted) {
        setCalendars(available);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const formatShiftTime = (shift: Shift) => {
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


  const buildReportHtml = (
    title: string,
    description: string,
    shifts: Shift[],
    options: ReportOptions,
    userInfo: { name?: string; email?: string; phone?: string },
    reportContext: {
      note: string;
      monthLabel: string;
      accentColors: [string, string];
    }
  ) => {
    const showLocationColumn = options.includeShiftLocation;
    const columnCount = showLocationColumn ? 4 : 3;
    const shiftRows =
      shifts.length > 0
        ? shifts
            .map((shift) => {
              const { dateLabel, startLabel, endLabel } = formatShiftTime(shift);
              return `
                <tr>
                  <td>${dateLabel}</td>
                  <td>${startLabel}</td>
                  <td>${endLabel}</td>
                  ${showLocationColumn ? `<td>${shift.location ?? 'TBD'}</td>` : ''}
                </tr>
              `;
            })
            .join('')
        : `
          <tr>
            <td colspan="${columnCount}" style="text-align:center;">${t('reportNoShifts')}</td>
          </tr>
        `;

    const totalMilliseconds = shifts.reduce((sum, shift) => {
      const startTime = Number(new Date(shift.start));
      const endTime = Number(new Date(shift.end));
      if (Number.isNaN(startTime) || Number.isNaN(endTime)) return sum;
      return sum + Math.max(0, endTime - startTime);
    }, 0);
    const totalHours = totalMilliseconds / (1000 * 60 * 60);

    const metadataEntries: { label: string; value: string }[] = [];
    if (options.includeEmployeeName) {
      metadataEntries.push({
        label: t('reportMetadataEmployee'),
        value: userInfo.name ?? t('reportMetadataUnknown'),
      });
    }
    if (options.includeEmail && userInfo.email) {
      metadataEntries.push({ label: t('reportMetadataEmail'), value: userInfo.email });
    }
    if (options.includePhone && userInfo.phone) {
      metadataEntries.push({ label: t('reportMetadataPhone'), value: userInfo.phone });
    }
    if (options.includeTotalHours) {
      metadataEntries.push({
        label: t('reportMetadataTotalHours'),
        value: `${formatHourValue(totalHours)} ${t('reportMetadataHoursUnit')}`,
      });
    }

    const metadataSection =
      metadataEntries.length > 0
        ? `
          <div class="metadata-block">
            <h2>${t('reportMetadataTitle')}</h2>
            <table class="metadata-table">
              <tbody>
                ${metadataEntries
                  .map(
                    (entry) => `
                  <tr>
                    <td>${entry.label}</td>
                    <td><span class="metadata-chip">${entry.value}</span></td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        : '';

    const objectMap = new Map<string, { name?: string; address?: string }>();
    shifts.forEach((shift) => {
      const name = shift.objectName ?? shift.title ?? 'Shift location';
      const address = shift.objectAddress ?? shift.location ?? 'TBD';
      const key = `${name}|${address}`;
      if (!objectMap.has(key)) {
        objectMap.set(key, { name, address });
      }
    });

    const objectItems: string[] = [];
    objectMap.forEach((value) => {
      const parts: string[] = [];
      if (options.includeObjectName && value.name) {
        parts.push(`<strong>${value.name}</strong>`);
      }
      if (options.includeObjectAddress && value.address) {
        parts.push(`<span>${value.address}</span>`);
      }
      if (parts.length) {
        objectItems.push(`<li>${parts.join('<br/>')}</li>`);
      }
    });

    const objectSection =
      objectItems.length > 0
        ? `
          <div class="site-block">
            <h2>${t('reportMetadataObjectDetails')}</h2>
            <ul class="site-list">
              ${objectItems.join('')}
            </ul>
          </div>
        `
        : '';

    const sanitizedNote = reportContext.note ? reportContext.note.replace(/\n/g, '<br/>') : '';
    const periodBlock = reportContext.monthLabel
      ? `<div class="report-period">${reportContext.monthLabel}</div>`
      : '';
    const noteBlock = sanitizedNote ? `<div class="report-note">${sanitizedNote}</div>` : '';
    const [primaryColor, secondaryColor] = reportContext.accentColors;

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            :root {
              --primary-color: ${primaryColor};
              --secondary-color: ${secondaryColor};
            }
            body {
              font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              margin: 0;
              padding: 0;
              background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            }
            .app-shell {
              background: #fff;
              border-radius: 32px;
              margin: 24px;
              padding: 32px;
              box-shadow: 0 25px 60px rgba(15, 23, 42, 0.2);
            }
            .report-header h1 {
              font-size: 28px;
              margin-bottom: 8px;
              color: #0f172a;
            }
            .report-header p {
              color: #475569;
              margin: 0 0 14px;
            }
            .report-period {
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              color: #64748b;
              margin-bottom: 6px;
            }
            .report-note {
              font-size: 14px;
              color: #1d2939;
              background: #f8fafc;
              border-radius: 12px;
              padding: 10px 12px;
              margin-bottom: 18px;
            }
            .panel {
              background: #fff;
              border-radius: 20px;
              padding: 24px;
              box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
              margin-bottom: 24px;
            }
            .metadata-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 15px;
            }
            .metadata-table td {
              padding: 10px 14px;
              border-bottom: 1px solid #e2e8f0;
            }
            .metadata-chip {
              display: inline-flex;
              padding: 6px 10px;
              border-radius: 999px;
              background: #eef2ff;
              color: #4338ca;
              font-size: 13px;
            }
            .metadata-table tr:last-child td {
              border-bottom: none;
            }
            .metadata-table td:first-child {
              font-weight: 600;
              color: #0f172a;
              width: 35%;
            }
            .site-list {
              list-style: none;
              margin: 0;
              padding: 0;
              display: grid;
              gap: 12px;
            }
            .site-list li {
              background: #f8fafc;
              border-radius: 14px;
              border: 1px solid #e2e8f0;
              padding: 12px 14px;
            }
            .site-list li strong {
              display: block;
              font-size: 16px;
              margin-bottom: 4px;
            }
            .section-divider {
              height: 1px;
              margin: 24px 0;
              background: linear-gradient(90deg, rgba(15,23,42,0), rgba(15,23,42,0.2), rgba(15,23,42,0));
            }
            .shift-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
            }
            .shift-table th,
            .shift-table td {
              padding: 12px 14px;
              border-bottom: 1px solid #e2e8f0;
            }
            .shift-table th {
              text-align: left;
              font-weight: 600;
              color: #0f172a;
            }
            .shift-table tr:last-child td {
              border-bottom: none;
            }
            .footer {
              color: #94a3b8;
              font-size: 12px;
              text-align: right;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="app-shell">
            <div class="report-header">
              <h1>${title}</h1>
              <p>${description}</p>
              ${periodBlock}
              ${noteBlock}
            </div>
            ${metadataSection}
            ${objectSection}
            <div class="section-divider"></div>
            <div class="panel">
              <div class="total-card">
                <span>${t('reportShiftSummary', {
                  count: shifts.length,
                  start: shifts[0]
                    ? new Date(shifts[0].start).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '-',
                })}</span>
                <span>${formatHourValue(totalHours)} ${t('reportMetadataHoursUnit')}</span>
              </div>
              <table class="shift-table">
                <thead>
                  <tr>
                    <th>${t('dayLabel')}</th>
                    <th>${t('shiftStartLabel')}</th>
                    <th>${t('shiftEndLabel')}</th>
                    ${showLocationColumn ? `<th>${t('locationTbd')}</th>` : ''}
                  </tr>
                </thead>
                <tbody>
                  ${shiftRows}
                </tbody>
              </table>
            </div>
            <div class="footer">${t('reportFooter')}</div>
          </div>
        </body>
      </html>
    `;
  };
  const handleGeneratePDF = async (reportType: 'monthly' | 'summary') => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    const title =
      reportType === 'monthly' ? t('reportGeneratePdf') : t('reportDownloadSummary');
    const description =
      reportType === 'monthly' ? t('reportMonthlyDescribe') : t('reportSummaryDescribe');

    try {
      const html = buildReportHtml(
        title,
        description,
        selectedShifts,
        reportOptions,
        userReportInfo,
        {
          note: reportNote.trim(),
          monthLabel: monthSelectorLabel,
          accentColors:
            reportThemeOptions[reportThemeSelection] ?? [theme.primary, theme.primaryAccent],
        }
      );
      const { uri } = await Print.printToFileAsync({ html });
      const savedUri = await saveReportToDevice(uri, reportType);
      if (savedUri) {
        const relative =
          FileSystem.documentDirectory && savedUri.startsWith(FileSystem.documentDirectory)
            ? savedUri.replace(FileSystem.documentDirectory, 'Files/')
            : savedUri;
        Alert.alert(
          t('reportDownloadedTitle'),
          t('reportDownloadedBody', { path: relative ?? savedUri })
        );
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: title,
        });
      } else {
        Alert.alert(t('reportFailedTitle'), t('reportFailedBody'));
      }
    } catch (error) {
      console.error('Failed to generate report', error);
      Alert.alert(t('reportFailedTitle'), t('reportFailedBody'));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  function getReportText(reportType: 'monthly' | 'summary') {
    return {
      title: reportType === 'monthly' ? t('reportGeneratePdf') : t('reportDownloadSummary'),
      description:
        reportType === 'monthly' ? t('reportMonthlyDescribe') : t('reportSummaryDescribe'),
    };
  }

  const openReportPreview = (reportType: 'monthly' | 'summary') => {
    setPreviewReportType(reportType);
    setIsPreviewVisible(true);
  };

  const closePreview = () => {
    setIsPreviewVisible(false);
    setPreviewReportType(null);
  };

  const handleDownloadFromPreview = () => {
    if (!previewReportType) return;
    const currentType = previewReportType;
    closePreview();
    handleGeneratePDF(currentType);
  };

  const toggleShiftInclusion = (shift: Shift) => {
    const key = formatShiftKey(shift);
    setIncludedShiftKeys((prev) =>
      prev.includes(key) ? prev.filter((existing) => existing !== key) : [...prev, key]
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: statusBarBgColor }]} edges={['top']}>
      <StatusBar
        translucent
        hidden={false}
        backgroundColor={statusBarBgColor}
        style={statusBarStyle}
      />
      <Modal
        visible={isPreviewVisible}
        transparent
        animationType="slide"
        onRequestClose={closePreview}
      >
        <View style={[styles.previewModalBackdrop, { backgroundColor: theme.overlay }]}>
          <LinearGradient
            colors={[theme.heroGradientStart, theme.heroGradientEnd]}
            style={styles.previewBackground}
          >
            <View
              style={[
                styles.previewModalContainer,
                {
                  paddingTop: insets.top + 28,
                  paddingBottom: insets.bottom + 32,
                },
              ]}
            >
              <View style={styles.previewActions}>
                <LinearGradient
                  colors={[theme.primary, theme.primaryAccent]}
                  style={styles.previewPrimaryAction}
                >
                  <TouchableOpacity
                    style={styles.previewButtonTouchable}
                    onPress={handleDownloadFromPreview}
                    disabled={!previewReportType || isGeneratingReport}
                  >
                    <Text style={[styles.previewButtonText, { color: '#fff' }]}>
                      {isGeneratingReport ? t('reportGenerating') : t('reportPreviewDownload')}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
                <TouchableOpacity
                  style={[styles.previewButtonSecondary, { backgroundColor: theme.surface }]}
                  onPress={closePreview}
                >
                  <Text style={[styles.previewButtonText, { color: theme.textPrimary }]}>
                    {t('reportPreviewClose')}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.previewGradientScroll}
                contentContainerStyle={styles.previewGradientContent}
                showsVerticalScrollIndicator
              >
                <View style={styles.previewHeader}>
                  <Text style={[styles.previewModalTitle, { color: '#fff' }]}>{previewTitle}</Text>
                  <TouchableOpacity onPress={closePreview}>
                    <Text style={[styles.previewToggleText, { color: '#fff' }]}>
                      {t('reportPreviewClose')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.previewDescription, { color: 'rgba(255,255,255,0.8)' }]}>
                  {previewDescription}
                </Text>
                <Text style={[styles.previewHint, { color: 'rgba(255,255,255,0.7)' }]}>
                  {t('reportPreviewHint')}
                </Text>
                <LinearGradient
                  colors={[`${theme.primary}25`, `${theme.surface}DD`]}
                  style={[styles.previewSection, styles.previewCard]}
                >
                  <Text style={[styles.previewSectionTitle, { color: theme.textPrimary }]}>
                    {t('reportPreviewSettingsTitle')}
                  </Text>
                  <View style={styles.monthSelector}>
                    <TouchableOpacity
                      style={[styles.monthButton, { borderColor: theme.border }]}
                      onPress={() => changeMonth(-1)}
                    >
                      <Ionicons name="chevron-back" size={16} color={theme.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.monthLabel, { color: theme.textPrimary }]}>
                      {monthSelectorLabel}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.monthButton,
                        { borderColor: theme.border },
                        !canAdvanceMonth && styles.monthButtonDisabled,
                      ]}
                      onPress={() => changeMonth(1)}
                      disabled={!canAdvanceMonth}
                    >
                      <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.previewInputRow}>
                    <Text style={[styles.previewInputLabel, { color: theme.textSecondary }]}>
                      {t('reportPreviewTitleLabel')}
                    </Text>
                    <TextInput
                      style={[
                        styles.previewTextInput,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      value={customReportTitle}
                      onChangeText={setCustomReportTitle}
                      placeholder={t('reportPreviewTitlePlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                  <View style={styles.previewInputRow}>
                    <Text style={[styles.previewInputLabel, { color: theme.textSecondary }]}>
                      {t('reportPreviewDescriptionLabel')}
                    </Text>
                    <TextInput
                      style={[
                        styles.previewTextInput,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      value={customReportDescription}
                      onChangeText={setCustomReportDescription}
                      placeholder={t('reportPreviewDescriptionPlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      multiline
                    />
                  </View>
                  <View style={styles.previewThemeRow}>
                    {[
                      { key: 'default', label: t('reportPreviewThemeDefault') },
                      { key: 'soft', label: t('reportPreviewThemeSoft') },
                    ].map((option, index, arr) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.previewThemeButton,
                          index === arr.length - 1 && styles.previewThemeButtonLast,
                          {
                            borderColor: theme.border,
                            backgroundColor:
                              reportThemeSelection === option.key ? theme.surfaceElevated : theme.surface,
                          },
                          reportThemeSelection === option.key && styles.previewThemeButtonActive,
                        ]}
                        onPress={() => setReportThemeSelection(option.key as 'default' | 'soft')}
                      >
                        <Text
                          style={[
                            styles.previewThemeButtonText,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.previewInputRow}>
                    <Text style={[styles.previewInputLabel, { color: theme.textSecondary }]}>
                      {t('reportPreviewNoteLabel')}
                    </Text>
                    <TextInput
                      style={[
                        styles.previewTextArea,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      value={reportNote}
                      onChangeText={setReportNote}
                      placeholder={t('reportPreviewNotePlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      textAlignVertical="top"
                      numberOfLines={3}
                    />
                  </View>
                </LinearGradient>
                <View
                  style={[
                    styles.previewOptionsCard,
                    { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                  ]}
                >
                  <Text style={[styles.previewSectionTitle, { color: theme.textPrimary }]}>
                    {t('reportPreviewFiltersTitle')}
                  </Text>
                  {reportOptionDefinitions.map(({ key, label }) => (
                    <View key={key} style={styles.previewToggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.previewOptionLabel, { color: theme.textPrimary }]}>
                          {label}
                        </Text>
                        <Text
                          style={[
                            styles.previewToggleStatusText,
                            { color: reportOptions[key] ? theme.primary : theme.textSecondary },
                          ]}
                        >
                          {reportOptions[key]
                            ? t('reportPreviewIncludedBadge')
                            : t('reportPreviewExcludedBadge')}
                        </Text>
                      </View>
                      <Switch
                        value={reportOptions[key]}
                        onValueChange={() => toggleReportOption(key)}
                        trackColor={{ true: theme.primary, false: theme.border }}
                        thumbColor={reportOptions[key] ? theme.primaryAccent : '#fff'}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.previewBody}>
                  <View style={styles.previewShiftList}>
                  {monthlyShifts.length === 0 && (
                      <Text style={[styles.previewEmptyText, { color: 'rgba(255,255,255,0.7)' }]}>
                        {t('reportNoShifts')}
                      </Text>
                    )}
                    {monthlyShifts.map((shift) => {
                      const key = formatShiftKey(shift);
                      const { dateLabel, startLabel, endLabel } = formatShiftTime(shift);
                      const isIncluded = includedShiftSet.has(key);
                      return (
                        <View
                          key={key}
                          style={[
                            styles.previewShiftCard,
                            {
                              borderColor: isIncluded ? theme.primary : theme.border,
                              backgroundColor: isIncluded ? theme.surfaceElevated : theme.surface,
                            },
                          ]}
                        >
                          <View style={styles.previewShiftDetails}>
                            <Text style={[styles.previewShiftDate, { color: theme.textPrimary }]}>
                              {dateLabel}
                            </Text>
                            <View style={styles.previewShiftMetaRow}>
                              <Text
                                style={[
                                  styles.previewShiftMetaChip,
                                  {
                                    backgroundColor: theme.surface,
                                    color: theme.textSecondary,
                                  },
                                ]}
                              >
                                {`${startLabel} · ${endLabel}`}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.previewToggleBadge,
                              {
                                borderColor: isIncluded ? theme.primary : theme.border,
                                backgroundColor: isIncluded ? `${theme.primary}20` : 'transparent',
                              },
                            ]}
                            onPress={() => toggleShiftInclusion(shift)}
                          >
                            <Text
                              style={[
                                styles.previewToggleText,
                                { color: isIncluded ? theme.primary : theme.textSecondary },
                              ]}
                            >
                              {isIncluded ? t('reportPreviewExclude') : t('reportPreviewInclude')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
          </LinearGradient>
        </View>
      </Modal>
        {shouldShowNotificationBell && (
          <View style={[styles.topActions, { top: insets.top + 10 }]}>
            <View style={styles.notificationWrapper}>
              <NotificationBell />
            </View>
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                {
                  backgroundColor: theme.surface,
                  shadowColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : '#0f172a',
                },
              ]}
              onPress={() => setQuickActionMenuOpen((prev) => !prev)}
            >
              <Ionicons name="flash-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}
        {quickActionMenuOpen && (
          <>
            <Pressable
              style={[
                StyleSheet.absoluteFillObject,
                styles.menuBackdrop,
                { backgroundColor: theme.overlay },
              ]}
              onPress={() => setQuickActionMenuOpen(false)}
            />
            <LinearGradient
              key={`quick-actions-gradient-${mode}`}
              colors={[theme.surfaceElevated, theme.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.quickActionMenu,
                {
                  top: insets.top + 60,
                  maxHeight: windowHeight - insets.top - 80,
                  borderColor: theme.border,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <ScrollView
                style={[styles.quickActionScroll, { maxHeight: windowHeight - insets.top - 120 }]}
                contentContainerStyle={styles.quickActionScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <Text
                  style={[
                    styles.quickActionMenuTitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t('quickActionsMenuTitle')}
                </Text>
                <View style={styles.quickActionCardStack}>
                  {[
                    {
                      key: 'calendar',
                      label: t('calendarMenuOpen'),
                      icon: 'calendar-outline',
                      onPress: () => {
                        setQuickActionMenuOpen(false);
                        router.push('/calendar');
                      },
                    },
                    {
                      key: 'sync',
                      label: t('calendarMenuSync'),
                      icon: 'sync-outline',
                      onPress: () => setQuickActionMenuOpen(false),
                    },
                    {
                      key: 'google',
                      label: t('calendarMenuImportGoogle'),
                      icon: 'logo-google',
                      onPress: () => {
                        setQuickActionMenuOpen(false);
                        Linking.openURL('https://calendar.google.com');
                      },
                    },
                    {
                      key: 'outlook',
                      label: t('calendarMenuImportOutlook'),
                      icon: 'logo-microsoft',
                      onPress: () => {
                        setQuickActionMenuOpen(false);
                        Linking.openURL('https://outlook.live.com/calendar/');
                      },
                    },
                  ].map((entry) => (
                    <TouchableOpacity
                      key={entry.key}
                      style={[
                        styles.quickActionCard,
                        {
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.borderSoft,
                          shadowColor: mode === 'dark' ? '#000' : '#0f172a',
                        },
                      ]}
                      onPress={entry.onPress}
                    >
                      <View
                        style={[
                          styles.quickActionCardIconWrapper,
                          { backgroundColor: theme.surface },
                        ]}
                      >
                        <Ionicons name={entry.icon} size={20} color={theme.primary} />
                      </View>
                      <View style={styles.quickActionCardContent}>
                        <Text
                          style={[
                            styles.quickActionCardTitle,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {entry.label}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  style={[
                    styles.sectionSeparator,
                    { backgroundColor: theme.borderSoft },
                  ]}
                />
                <Text
                  style={[
                    styles.quickActionListTitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t('reportsTitle')}
                </Text>
                <TouchableOpacity
                  style={styles.quickActionMenuItem}
                  onPress={() => {
                    setQuickActionMenuOpen(false);
                    openReportPreview('monthly');
                  }}
                >
                  <Text
                    style={[
                      styles.quickActionMenuItemText,
                      { color: theme.textPrimary },
                    ]}
                  >
                    {isGeneratingReport ? t('reportGenerating') : t('reportGeneratePdf')}
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.quickActionList,
                    { borderTopColor: theme.borderSoft },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickActionListTitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t('calendarMenuAvailable')}
                  </Text>
                  <Text
                    style={[
                      styles.quickActionSelectionHint,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {selectedCalendars.length
                      ? t('calendarMenuSelectionCount', { count: selectedCalendars.length })
                      : t('calendarMenuSelectionPrompt')}
                  </Text>
                  {calendars === null ? (
                    <Text
                      style={[
                        styles.quickActionListEmpty,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {t('calendarMenuLoading')}
                    </Text>
                  ) : calendars.length ? (
                    calendars.map((cal) => {
                      const isSelected = selectedCalendars.some((entry) => entry.id === cal.id);
                      return (
                        <TouchableOpacity
                          key={cal.id}
                          style={[
                            styles.quickActionListItem,
                            isSelected && styles.quickActionListItemSelected,
                            isSelected && {
                              backgroundColor: `${theme.primary}20`,
                            },
                          ]}
                          onPress={() =>
                            toggleCalendarSelection({
                              id: cal.id,
                              title: cal.title,
                              sourceName: cal.source?.name ?? cal.source?.type,
                            })
                          }
                        >
                          <View>
                            <Text
                              style={[
                                styles.quickActionListItemTitle,
                                { color: theme.textPrimary },
                              ]}
                            >
                              {cal.title}
                            </Text>
                            <Text
                              style={[
                                styles.quickActionListItemMeta,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {cal.source?.name ?? cal.source?.type}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text
                      style={[
                        styles.quickActionListEmpty,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {t('calendarMenuNoCalendars')}
                    </Text>
                  )}
                </View>
              </ScrollView>
            </LinearGradient>
          </>
        )}
        <View style={styles.content}>
          <Slot />
        </View>
      </SafeAreaView>
  );
}

function LayoutContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <LayoutContentInner />
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <SafeAreaProvider>
          <LanguageProvider>
            <ThemeProvider>
              <CalendarSelectionProvider>
                <LayoutContent />
              </CalendarSelectionProvider>
            </ThemeProvider>
          </LanguageProvider>
        </SafeAreaProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
  },
  topActions: {
    position: 'absolute',
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  quickActionButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  notificationWrapper: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBackdrop: {
    zIndex: 25,
  },
  quickActionMenu: {
    position: 'absolute',
    right: 8,
    width: 320,
    borderRadius: 24,
    padding: 16,
    zIndex: 30,
    shadowColor: '#0f172a',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
    borderWidth: 1,
  },
  quickActionScroll: {
    maxHeight: 320,
  },
  quickActionScrollContent: {
    paddingBottom: 12,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  quickActionList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  quickActionListTitle: {
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 6,
  },
  quickActionListItem: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionListItemTitle: {
    fontSize: 14,
    color: '#0f172a',
  },
  quickActionListItemMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  quickActionListEmpty: {
    fontSize: 12,
    color: '#6b7280',
  },
  quickActionSelectionHint: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },
  quickActionListItemSelected: {
    backgroundColor: '#2563eb10',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  quickActionCardStack: {
    marginBottom: 12,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    justifyContent: 'space-between',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  quickActionCardIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionCardContent: {
    flex: 1,
    marginHorizontal: 10,
  },
  quickActionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  quickActionMenuTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#1f2937',
    marginBottom: 8,
  },
  quickActionMenuItem: {
    paddingVertical: 10,
  },
  quickActionMenuItemText: {
    fontSize: 14,
    color: '#1f2937',
  },
  previewModalBackdrop: {
    flex: 1,
  },
  previewBackground: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  previewGradientScroll: {
    flex: 1,
  },
  previewGradientContent: {
    flexGrow: 1,
  },
  previewModalContainer: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  previewModalClose: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewDescription: {
    fontSize: 14,
    marginBottom: 6,
  },
  previewSection: {
    marginBottom: 12,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  previewSectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontWeight: '600',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: {
    opacity: 0.35,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewShiftList: {
    flexGrow: 0,
    width: '100%',
  },
  previewOptionsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  previewOptionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  previewOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewOptionLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  previewBody: {
    flex: 1,
  },
  previewHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  previewInputRow: {
    marginTop: 12,
  },
  previewInputLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  previewTextInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  previewTextArea: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
  },
  previewThemeRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  previewThemeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  previewThemeButtonLast: {
    marginRight: 0,
  },
  previewThemeButtonLast: {
    marginRight: 0,
  },
  previewThemeButtonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  previewThemeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewShiftCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  previewShiftDetails: {
    flex: 1,
  },
  previewShiftDate: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewShiftMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  previewShiftMetaChip: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    maxWidth: '85%',
  },
  previewToggleBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  previewToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewToggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  previewToggleStatusText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  previewPrimaryAction: {
    flex: 1,
    borderRadius: 16,
  },
  previewButtonTouchable: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewButtonSecondary: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
  },
  previewEmptyText: {
    textAlign: 'center',
    paddingVertical: 24,
  },
});
