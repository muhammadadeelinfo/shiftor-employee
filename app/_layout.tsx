import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
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
  Alert,
  ScrollView,
  Modal,
  Switch,
  TextInput,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { AuthProvider } from '@hooks/useSupabaseAuth';
import { queryClient } from '@lib/queryClient';
import { initializeMonitoring } from '@lib/monitoring';
import { useExpoPushToken } from '@hooks/useExpoPushToken';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppErrorBoundary } from '@shared/components/AppErrorBoundary';
import { NotificationProvider } from '@shared/context/NotificationContext';
import {
  LanguageProvider,
  useLanguage,
} from '@shared/context/LanguageContext';
import { CalendarSelectionProvider } from '@shared/context/CalendarSelectionContext';
import { ThemeProvider, useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useQuery } from '@tanstack/react-query';
import { getShifts, type Shift } from '@features/shifts/shiftsService';
import { useShiftNotifications } from '@shared/hooks/useShiftNotifications';

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
const BRAND_LAUNCH_MS = 2000;

const buildReportDestination = async (
  reportType: 'monthly' | 'summary',
  fileSystem: typeof import('expo-file-system/legacy')
) => {
  const baseDirectory = fileSystem.documentDirectory ?? fileSystem.cacheDirectory;
  if (!baseDirectory) {
    return null;
  }
  const directory = `${baseDirectory}${REPORT_FOLDER_NAME}/`;
  await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
  const slug = reportType === 'monthly' ? 'Monthly' : 'Summary';
  const fileName = `${slug}-Report-${timestamp}.pdf`;
  return { directory, fileName, destination: `${directory}${fileName}` };
};

const saveReportToDevice = async (
  uri: string,
  reportType: 'monthly' | 'summary',
  fileSystem: typeof import('expo-file-system/legacy')
) => {
  const info = await buildReportDestination(reportType, fileSystem);
  if (!info) return null;
  await fileSystem.copyAsync({
    from: uri,
    to: info.destination,
  });
  return info.destination;
};

function LayoutContentInner() {
  const pushToken = useExpoPushToken();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
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
  const [isBrandLaunchDone, setIsBrandLaunchDone] = useState(false);
  const brandFade = useRef(new Animated.Value(0)).current;
  const brandScale = useRef(new Animated.Value(0.94)).current;
  const brandGlowOpacity = useRef(new Animated.Value(0.55)).current;
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
  const quickShiftIds = useMemo(() => quickShifts.map((shift) => shift.id).filter(Boolean), [quickShifts]);
  useShiftNotifications(quickShiftIds);
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

    const authFreePaths = ['/welcome', '/login', '/signup', '/guest', '/startup'];
    const isAuthFree = pathname ? authFreePaths.some((path) => pathname.startsWith(path)) : false;

    if (!user && !isAuthFree) {
      router.replace('/welcome');
    }
  }, [loading, pathname, router, user]);

  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const reportThemeOptions = useMemo<Record<'default' | 'soft', [string, string]>>(
    () => ({
      default: [theme.primary, theme.primaryAccent],
      soft: [theme.primaryAccent, theme.surface],
    }),
    [theme]
  );
  const statusBarStyle = 'light';
  const statusBarBgColor = theme.surface;
  const previewTitle = customReportTitle;
  const previewDescription = customReportDescription;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBrandLaunchDone(true);
    }, BRAND_LAUNCH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(brandFade, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(brandScale, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(brandGlowOpacity, {
          toValue: 0.9,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(brandGlowOpacity, {
          toValue: 0.55,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => {
      pulse.stop();
    };
  }, [brandFade, brandGlowOpacity, brandScale]);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const { setNotificationHandler } = await import('expo-notifications');
        if (!isMounted) return;

        setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch (error) {
        console.warn('Failed to initialize notification handler.', error);
      }
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

  if (!isBrandLaunchDone) {
    return (
      <View style={styles.brandGateRoot}>
        <LinearGradient colors={['#050A14', '#0A1426', '#0F1F3A']} style={styles.brandGateBackground}>
          <View style={styles.brandBackdropOrbTop} />
          <View style={styles.brandBackdropOrbBottom} />
          <Animated.View style={[styles.brandIntro, { opacity: brandFade }]}>
            <Animated.View style={[styles.brandGlow, { opacity: brandGlowOpacity }]} />
            <Animated.View style={{ transform: [{ scale: brandScale }] }}>
              <View style={styles.brandLogoCard}>
                <Image source={require('../assets/icon.png')} style={styles.brandLogo} resizeMode="contain" />
              </View>
            </Animated.View>
            <Text style={styles.brandTitle}>Shiftor Employee</Text>
            <Text style={styles.brandSubtitle}>{t('rootCheckingSession')}</Text>
            <ActivityIndicator color="#93c5fd" style={styles.brandSpinner} />
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  const handleGeneratePDF = async (reportType: 'monthly' | 'summary') => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    const title =
      reportType === 'monthly' ? t('reportGeneratePdf') : t('reportDownloadSummary');
    const description =
      reportType === 'monthly' ? t('reportMonthlyDescribe') : t('reportSummaryDescribe');

    try {
      const [Print, Sharing, FileSystem] = await Promise.all([
        import('expo-print'),
        import('expo-sharing'),
        import('expo-file-system/legacy'),
      ]);
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
      const savedUri = await saveReportToDevice(uri, reportType, FileSystem);
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
        <View style={styles.content}>
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
            }}
          />
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
  useEffect(() => {
    try {
      initializeMonitoring();
    } catch (error) {
      console.warn('Monitoring initialization failed.', error);
    }
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <LanguageProvider>
          <AppErrorBoundary>
            <NotificationProvider>
              <ThemeProvider>
                <CalendarSelectionProvider>
                  <LayoutContent />
                </CalendarSelectionProvider>
              </ThemeProvider>
            </NotificationProvider>
          </AppErrorBoundary>
        </LanguageProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  brandGateRoot: {
    flex: 1,
  },
  brandGateBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    overflow: 'hidden',
  },
  brandIntro: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBackdropOrbTop: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
    top: -120,
    right: -120,
  },
  brandBackdropOrbBottom: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: 'rgba(45, 154, 86, 0.16)',
    bottom: -95,
    left: -80,
  },
  brandGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    top: -28,
  },
  brandLogoCard: {
    width: 132,
    height: 132,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    shadowColor: '#020617',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  brandLogo: {
    width: 104,
    height: 104,
  },
  brandTitle: {
    marginTop: 20,
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  brandSubtitle: {
    marginTop: 8,
    color: '#BFDBFE',
    fontSize: 14,
    textAlign: 'center',
  },
  brandSpinner: {
    marginTop: 14,
  },
  content: {
    flex: 1,
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
