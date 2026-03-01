import { useEffect, useRef, useState } from 'react';
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
  const { t } = useLanguage();
  const { user, session } = useAuth();
  const apiBaseUrlValue = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  const apiBaseUrl = apiBaseUrlValue ? apiBaseUrlValue.replace(/\/+$/, '') : '';
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

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

  useEffect(() => {
    (async () => {
      const response = await Camera.requestCameraPermissionsAsync();
      setPermission(response);
    })();
  }, []);

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

    setScannedData(data);
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
        clockIn?: { shiftId?: string };
        error?: string;
      };

      if (!response.ok || !payload.clockIn?.shiftId) {
        const message = resolveQrClockInErrorMessage(response.status, payload.error);
        setScanFeedback(message);
        Alert.alert(t('qrClockInInvalidTitle'), message);
        return;
      }

      const message = t('qrClockInSuccessMessage');
      setScanFeedback(message);
      Alert.alert(t('qrClockInSuccessTitle'), message, [
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
    }
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
          style={[styles.hero, { borderColor: theme.borderSoft }]}
        >
          <View style={[styles.heroIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name="qr-code-outline" size={18} color={theme.primary} />
          </View>
          <Text style={[styles.instructions, { color: theme.textSecondary }]}>{t('qrInstructions')}</Text>
        </LinearGradient>
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
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
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
