import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Camera, CameraView, BarcodeScanningResult, PermissionResponse } from 'expo-camera';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useLanguage } from '@shared/context/LanguageContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@shared/themeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { layoutTokens } from '@shared/theme/layout';
import { getContentMaxWidth } from '@shared/utils/responsiveLayout';

export default function QrClockInScreen() {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLargeTablet = width >= 1024;
  const isTabletLandscape = isLargeTablet && width > height;
  const contentMaxWidth =
    width >= 1366 ? 980 : width >= 1024 ? 920 : getContentMaxWidth(width);
  const previewStyle = isTabletLandscape
    ? { maxHeight: Math.min(height * 0.68, 760) }
    : null;
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const { t } = useLanguage();

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

  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    setScannedData(data);
    setIsScanning(false);
    Alert.alert(t('qrDetectedTitle'), t('qrDetectedMessage', { code: data }));
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
    </SafeAreaView>
  );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['left', 'right']}
    >
      <View
        style={[
          styles.contentFrame,
          isLargeTablet && styles.contentFrameTablet,
          contentMaxWidth ? { maxWidth: contentMaxWidth } : null,
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
            onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
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
          </View>
        ) : null}
        {!isScanning ? (
          <PrimaryButton
            title={t('scanAnotherBadge')}
            onPress={() => {
              setScannedData(null);
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
