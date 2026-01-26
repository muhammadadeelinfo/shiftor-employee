import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Camera, CameraView, BarCodeScanningResult, CameraPermissionResponse } from 'expo-camera';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useLanguage } from '@shared/context/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function QrClockInScreen() {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<CameraPermissionResponse | null>(null);
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

  const handleBarCodeScanned = ({ data }: BarCodeScanningResult) => {
    setScannedData(data);
    setIsScanning(false);
    Alert.alert(t('qrDetectedTitle'), t('qrDetectedMessage', { code: data }));
  };

  const safeAreaPadding = {
    paddingTop: 12 + insets.top,
    paddingBottom: 12 + insets.bottom,
  };

  if (!permission) {
    return (
      <SafeAreaView style={[styles.center, safeAreaPadding]}>
        <Text>{t('requestingCameraPermission')}</Text>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.center, safeAreaPadding]}>
        <Text style={styles.error}>{t('cameraPermissionRequired')}</Text>
        <PrimaryButton title={t('grantCameraAccess')} onPress={handleRequestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, safeAreaPadding]} edges={['top']}>
      <Text style={styles.instructions}>{t('qrInstructions')}</Text>
      <View style={styles.preview}>
        <CameraView
          style={styles.camera}
          onBarCodeScanned={isScanning ? handleBarCodeScanned : undefined}
          barCodeScannerSettings={{
            barCodeTypes: ['qr', 'code128', 'code39'],
          }}
        />
      </View>
      {scannedData ? (
        <View style={styles.scanResult}>
          <Text style={styles.scanLabel}>{t('lastScanLabel')}</Text>
          <Text style={styles.scanValue}>{scannedData}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  instructions: {
    textAlign: 'center',
    color: '#475569',
    marginBottom: 12,
  },
  preview: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scanResult: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  scanLabel: {
    textTransform: 'uppercase',
    fontSize: 10,
    color: '#94a3b8',
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
