import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Camera, CameraView, BarcodeScanningResult, PermissionResponse } from 'expo-camera';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useLanguage } from '@shared/context/LanguageContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@shared/themeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { layoutTokens } from '@shared/theme/layout';
import { useAuth } from '@hooks/useSupabaseAuth';
import { supabase } from '@lib/supabaseClient';
import { parseQrClockInCode } from '@shared/utils/qrClockIn';
import { useShiftFeed } from '@features/shifts/useShiftFeed';

type EmployeePresence = {
  isLoggedIn: boolean;
  lastCheckInAt?: string | null;
  lastCheckInTag?: string | null;
};

const CLOCK_IN_REMINDER_WINDOW_MS = 60 * 60 * 1000;
const CLOCK_OUT_REMINDER_WINDOW_MS = 30 * 60 * 1000;

const getStringField = (source?: Record<string, unknown>, key?: string) => {
  if (!source || !key) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const isMissingColumnError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '42703';

const withUtcFallback = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/[zZ]$/.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }
  return `${normalized}Z`;
};

const parsePresenceDate = (value?: string | null) => {
  const normalized = withUtcFallback(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const formatShortTime = (value: Date) =>
  value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

const getShiftIdFromTag = (tag?: string | null) => {
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim();
  if (!trimmed.startsWith('shift:')) {
    return null;
  }
  const shiftId = trimmed.slice('shift:'.length).trim();
  return shiftId || null;
};

const fetchEmployeePresence = async (
  employeeId: string,
  email?: string | null,
  metadata?: Record<string, unknown>
): Promise<EmployeePresence | null> => {
  if (!supabase) {
    return null;
  }

  const candidateLookups: Array<{ column: string; value: string }> = [
    { column: 'id', value: employeeId },
    { column: 'employeeId', value: employeeId },
    { column: 'employee_id', value: employeeId },
    { column: 'userId', value: employeeId },
    { column: 'user_id', value: employeeId },
    { column: 'auth_user_id', value: employeeId },
    { column: 'authUserId', value: employeeId },
    { column: 'profile_id', value: employeeId },
    { column: 'profileId', value: employeeId },
  ];
  if (email) {
    candidateLookups.push({ column: 'email', value: email });
  }

  const metadataEmployeeIds = [
    getStringField(metadata, 'employee_id'),
    getStringField(metadata, 'employeeId'),
    getStringField(metadata, 'profile_id'),
    getStringField(metadata, 'profileId'),
  ].filter((value): value is string => Boolean(value));
  metadataEmployeeIds.forEach((value) => {
    candidateLookups.push({ column: 'id', value });
    candidateLookups.push({ column: 'employee_id', value });
    candidateLookups.push({ column: 'employeeId', value });
  });

  const seenLookups = new Set<string>();
  for (const lookup of candidateLookups) {
    const dedupeKey = `${lookup.column}:${lookup.value}`;
    if (seenLookups.has(dedupeKey)) {
      continue;
    }
    seenLookups.add(dedupeKey);

    const { data, error } = await supabase
      .from('employees')
      .select('isLoggedIn,lastCheckInAt,lastCheckInTag')
      .eq(lookup.column, lookup.value)
      .limit(1);

    if (error) {
      if (isMissingColumnError(error)) {
        continue;
      }
      console.warn('Failed to load QR presence state', error);
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      const row = data[0] as {
        isLoggedIn?: unknown;
        lastCheckInAt?: unknown;
        lastCheckInTag?: unknown;
      };
      return {
        isLoggedIn: row.isLoggedIn === true,
        lastCheckInAt: typeof row.lastCheckInAt === 'string' ? row.lastCheckInAt : null,
        lastCheckInTag: typeof row.lastCheckInTag === 'string' ? row.lastCheckInTag : null,
      };
    }
  }

  return null;
};

export default function QrClockInScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const isTabletLandscape = isLargeTablet && width > height;
  const horizontalPadding = isTablet ? 20 : layoutTokens.screenHorizontal;
  const previewStyle = isTabletLandscape
    ? { maxHeight: Math.min(height * 0.68, 760) }
    : null;
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeePresence, setEmployeePresence] = useState<EmployeePresence | null>(null);
  const [clockTickMs, setClockTickMs] = useState(() => Date.now());
  const { t } = useLanguage();
  const { user, session } = useAuth();
  const { orderedShifts } = useShiftFeed();
  const apiBaseUrlValue = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  const apiBaseUrl = apiBaseUrlValue ? apiBaseUrlValue.replace(/\/+$/, '') : '';
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const mergedMetadata = useMemo(() => {
    const next: Record<string, unknown> = {};
    if (user?.app_metadata && typeof user.app_metadata === 'object') {
      Object.assign(next, user.app_metadata);
    }
    if (user?.user_metadata && typeof user.user_metadata === 'object') {
      Object.assign(next, user.user_metadata);
    }
    return next;
  }, [user?.app_metadata, user?.user_metadata]);

  const resolveQrClockInErrorMessage = (status: number, errorMessage?: string) => {
    if (status === 401) {
      return t('qrClockInSessionRequired');
    }
    if (status === 403) {
      return typeof errorMessage === 'string' && errorMessage.trim()
        ? errorMessage.trim()
        : t('qrClockInNotEligible');
    }
    if (status >= 500) {
      return t('qrClockInSubmitFailed');
    }
    if (
      status === 400 &&
      typeof errorMessage === 'string' &&
      (errorMessage.startsWith('Invalid QR token') ||
        errorMessage.startsWith('Malformed QR token') ||
        errorMessage.startsWith('Missing QR token') ||
        errorMessage.startsWith('Unsupported QR token payload'))
    ) {
      return t('qrClockInInvalidCode');
    }
    return t('qrClockInInvalidCode');
  };

  const formatWorkedDuration = (workedMs?: number) => {
    if (typeof workedMs !== 'number' || !Number.isFinite(workedMs) || workedMs <= 0) {
      return null;
    }
    const totalMinutes = Math.max(1, Math.round(workedMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) {
      return t('qrClockOutWorkedMinutes', { minutes: totalMinutes });
    }
    if (minutes === 0) {
      return t('qrClockOutWorkedHours', { hours });
    }
    return t('qrClockOutWorkedHoursMinutes', { hours, minutes });
  };

  useEffect(() => {
    (async () => {
      const response = await Camera.requestCameraPermissionsAsync();
      setPermission(response);
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockTickMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadPresence = async () => {
      if (!user?.id) {
        if (isActive) {
          setEmployeePresence(null);
        }
        return;
      }
      const nextPresence = await fetchEmployeePresence(user.id, user.email, mergedMetadata);
      if (isActive) {
        setEmployeePresence(nextPresence);
      }
    };

    void loadPresence();
    const timer = setInterval(() => {
      void loadPresence();
    }, 60000);

    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, [mergedMetadata, user?.email, user?.id]);

  const checkedInAt = parsePresenceDate(employeePresence?.lastCheckInAt);
  const activeShiftId = getShiftIdFromTag(employeePresence?.lastCheckInTag);
  const activeShift = useMemo(
    () => orderedShifts.find((shift) => shift.id === activeShiftId) ?? null,
    [activeShiftId, orderedShifts]
  );
  const workedSoFar = useMemo(() => {
    if (!employeePresence?.isLoggedIn || !checkedInAt) {
      return null;
    }
    return formatWorkedDuration(Math.max(0, clockTickMs - checkedInAt.getTime()));
  }, [checkedInAt, clockTickMs, employeePresence?.isLoggedIn, t]);
  const reminderMessage = useMemo(() => {
    if (employeePresence?.isLoggedIn && activeShift) {
      const shiftEnd = new Date(activeShift.end);
      if (!Number.isNaN(shiftEnd.getTime())) {
        const remainingMs = shiftEnd.getTime() - clockTickMs;
        if (remainingMs <= CLOCK_OUT_REMINDER_WINDOW_MS) {
          return t('qrClockOutReminderSoon', {
            shift: activeShift.title,
            time: formatShortTime(shiftEnd),
          });
        }
      }
    }

    const nextShift = orderedShifts.find((shift) => {
      const shiftStart = new Date(shift.start);
      if (Number.isNaN(shiftStart.getTime())) {
        return false;
      }
      const untilStart = shiftStart.getTime() - clockTickMs;
      return untilStart >= 0 && untilStart <= CLOCK_IN_REMINDER_WINDOW_MS;
    });
    if (!nextShift || employeePresence?.isLoggedIn) {
      return null;
    }

    return t('qrClockInReminderSoon', {
      shift: nextShift.title,
      time: formatShortTime(new Date(nextShift.start)),
    });
  }, [activeShift, clockTickMs, employeePresence?.isLoggedIn, orderedShifts, t]);

  const refreshPresence = async () => {
    if (!user?.id) {
      setEmployeePresence(null);
      return;
    }
    const nextPresence = await fetchEmployeePresence(user.id, user.email, mergedMetadata);
    setEmployeePresence(nextPresence);
  };

  const submitQrScan = async (normalizedData: string, rawData: string) => {
    setScannedData(rawData);
    setIsScanning(false);
    setIsSubmitting(true);

    if (!apiBaseUrl) {
      const message = t('qrClockInMissingApiBaseUrl');
      setScanFeedback(message);
      Alert.alert(t('qrClockInInvalidTitle'), message);
      setIsSubmitting(false);
      return;
    }

    if (!session?.access_token) {
      const message = t('qrClockInSessionRequired');
      setScanFeedback(message);
      Alert.alert(t('qrClockInInvalidTitle'), message);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/objects/qr-clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          qrCode: normalizedData,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        clockIn?: {
          shiftId?: string;
          action?: 'clock_in' | 'clock_out';
          workedMs?: number;
        };
        error?: string;
      };

      if (!response.ok || !payload.clockIn?.shiftId) {
        const message = resolveQrClockInErrorMessage(response.status, payload.error);
        setScanFeedback(message);
        Alert.alert(t('qrClockInInvalidTitle'), message);
        return;
      }

      const workedDuration = formatWorkedDuration(payload.clockIn?.workedMs);
      const isClockOut = payload.clockIn?.action === 'clock_out';
      const message = isClockOut
        ? t('qrClockOutSuccessMessage', {
            duration: workedDuration ?? t('qrClockOutWorkedUnknown'),
          })
        : t('qrClockInSuccessMessage');
      setScanFeedback(message);
      Alert.alert(isClockOut ? t('qrClockOutSuccessTitle') : t('qrClockInSuccessTitle'), message, [
        {
          text: t('commonContinue'),
          onPress: () => router.push(`/shift-details/${payload.clockIn?.shiftId}`),
        },
      ]);
    } catch {
      const message = t('qrClockInSubmitFailed');
      setScanFeedback(message);
      Alert.alert(t('qrClockInInvalidTitle'), message);
    } finally {
      setIsSubmitting(false);
      void refreshPresence();
    }
  };

  const handleRequestPermission = async () => {
    const response = await Camera.requestCameraPermissionsAsync();
    setPermission(response);
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert(t('qrClockInInvalidTitle'), t('openSystemSettingsFailed'));
    });
  };

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    const normalizedData = data.trim();
    if (!normalizedData || isSubmitting) {
      return;
    }
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.value === normalizedData &&
      now - lastScanRef.current.at < 2500
    ) {
      return;
    }
    lastScanRef.current = {
      value: normalizedData,
      at: now,
    };

    const parsedCode = parseQrClockInCode(normalizedData);
    const scannedShiftId = parsedCode.shiftId ?? null;
    const currentShiftId = getShiftIdFromTag(employeePresence?.lastCheckInTag);
    const shouldConfirmClockOut =
      employeePresence?.isLoggedIn === true &&
      Boolean(scannedShiftId) &&
      scannedShiftId === currentShiftId;

    if (shouldConfirmClockOut) {
      const message = t('qrClockOutConfirmMessage', {
        duration: workedSoFar ?? t('qrClockOutWorkedUnknown'),
      });
      setScannedData(data);
      setIsScanning(false);
      setScanFeedback(message);
      Alert.alert(t('qrClockOutConfirmTitle'), message, [
        { text: t('commonCancel'), style: 'cancel' },
        {
          text: t('qrClockOutConfirmAction'),
          onPress: () => {
            void submitQrScan(normalizedData, data);
          },
        },
      ]);
      return;
    }

    await submitQrScan(normalizedData, data);
  };

  if (!permission) {
    return (
    <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <Text style={{ color: theme.textSecondary }}>{t('requestingCameraPermission')}</Text>
    </SafeAreaView>
  );
  }

  if (!permission?.granted) {
    return (
    <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <Text style={[styles.error, { color: theme.fail }]}>{t('cameraPermissionRequired')}</Text>
      <PrimaryButton title={t('grantCameraAccess')} onPress={handleRequestPermission} />
      {!permission.canAskAgain ? (
        <PrimaryButton title={t('openSystemSettings')} onPress={handleOpenSettings} style={styles.button} />
      ) : null}
    </SafeAreaView>
  );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]} edges={['left', 'right']}>
        <Text style={[styles.error, { color: theme.fail }]}>{t('qrClockInSignInRequired')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background, paddingHorizontal: horizontalPadding }]}
      edges={['left', 'right']}
    >
      <View
        style={[
          styles.contentFrame,
          isLargeTablet && styles.contentFrameTablet,
        ]}
      >
        <LinearGradient
          colors={[theme.heroGradientStart, theme.heroGradientEnd]}
          style={[styles.hero, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSoft }]}
        >
          <View style={[styles.heroIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name="qr-code-outline" size={18} color={theme.primary} />
          </View>
          <Text style={[styles.instructions, { color: theme.textSecondary }]}>{t('qrInstructions')}</Text>
        </LinearGradient>
        {employeePresence?.isLoggedIn && checkedInAt ? (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Text style={[styles.statusTitle, { color: theme.textPrimary }]}>
              {t('qrClockedInStatusTitle')}
            </Text>
            <Text style={[styles.statusBody, { color: theme.textSecondary }]}>
              {t('qrClockedInStatusMessage', { time: formatShortTime(checkedInAt) })}
            </Text>
            {workedSoFar ? (
              <Text style={[styles.statusWorked, { color: theme.textPrimary }]}>
                {t('qrClockedInWorkedSoFar', { duration: workedSoFar })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {reminderMessage ? (
          <View style={[styles.reminderCard, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.reminderText, { color: theme.textSecondary }]}>{reminderMessage}</Text>
          </View>
        ) : null}
        <View style={[styles.preview, previewStyle, { borderColor: theme.borderSoft }]}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={!isSubmitting && isScanning ? handleBarCodeScanned : undefined}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'code128', 'code39'],
            }}
          />
          <View pointerEvents="none" style={styles.scanOverlay}>
            <View style={[styles.scanFrame, { borderColor: `${theme.primary}88` }]}>
              <View style={[styles.scanCorner, styles.scanCornerTopLeft, { borderColor: theme.primary }]} />
              <View style={[styles.scanCorner, styles.scanCornerTopRight, { borderColor: theme.primary }]} />
              <View style={[styles.scanCorner, styles.scanCornerBottomLeft, { borderColor: theme.primary }]} />
              <View style={[styles.scanCorner, styles.scanCornerBottomRight, { borderColor: theme.primary }]} />
            </View>
            <Text style={[styles.scanHint, { color: theme.textSecondary }]}>{t('qrInstructions')}</Text>
          </View>
        </View>
        {scannedData ? (
          <View style={[styles.scanResult, { backgroundColor: theme.surface }]}>
            <Text style={[styles.scanLabel, { color: theme.textSecondary }]}>{t('lastScanLabel')}</Text>
            <Text style={[styles.scanValue, { color: theme.textPrimary }]}>{scannedData}</Text>
            {scanFeedback ? (
              <Text style={[styles.scanFeedback, { color: theme.textSecondary }]}>{scanFeedback}</Text>
            ) : null}
          </View>
        ) : null}
        {isSubmitting ? (
          <View style={[styles.scanResult, { backgroundColor: theme.surface }]}>
            <Text style={[styles.scanLabel, { color: theme.textSecondary }]}>{t('qrClockInSubmitting')}</Text>
          </View>
        ) : null}
        {!isScanning ? (
          <PrimaryButton
            title={t('scanAnotherBadge')}
            onPress={() => {
              setScannedData(null);
              setScanFeedback(null);
              lastScanRef.current = null;
              setIsScanning(true);
            }}
            style={styles.button}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: layoutTokens.screenTop,
    paddingBottom: layoutTokens.screenTop,
    alignItems: 'center',
  },
  contentFrame: {
    flex: 1,
    width: '100%',
  },
  contentFrameTablet: {
    paddingBottom: 8,
  },
  hero: {
    borderRadius: layoutTokens.cardRadiusMd,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructions: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  statusCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBody: {
    marginTop: 4,
    fontSize: 12,
  },
  statusWorked: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  reminderCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(30, 64, 175, 0.14)',
  },
  reminderText: {
    fontSize: 12,
    lineHeight: 18,
  },
  preview: {
    flex: 1,
    borderRadius: layoutTokens.cardRadiusMd,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scanFrame: {
    width: '82%',
    maxWidth: 290,
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'rgba(3, 8, 25, 0.08)',
  },
  scanCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#818cf8',
  },
  scanCornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  scanCornerTopRight: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  scanCornerBottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  scanCornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },
  scanHint: {
    marginTop: 14,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  camera: {
    flex: 1,
  },
  scanResult: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  scanLabel: {
    textTransform: 'uppercase',
    fontSize: 10,
  },
  scanValue: {
    marginTop: 4,
    fontWeight: '600',
  },
  scanFeedback: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    marginTop: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  error: {
    marginBottom: 12,
    color: '#dc2626',
    textAlign: 'center',
  },
});
