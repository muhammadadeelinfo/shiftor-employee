import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Camera, CameraView, BarCodeScanningResult, CameraPermissionResponse } from 'expo-camera';
import { PrimaryButton } from '../../components/PrimaryButton';

export default function QrClockInScreen() {
  const [permission, setPermission] = useState<CameraPermissionResponse | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);

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
    Alert.alert('QR detected', data);
  };

  if (!permission) {
    return (
    <View style={styles.center}>
      <Text>Requesting camera permission...</Text>
    </View>
  );
}

if (!permission?.granted) {
  return (
    <View style={styles.center}>
      <Text style={styles.error}>Camera permission is required to scan a QR.</Text>
      <PrimaryButton title="Grant camera access" onPress={handleRequestPermission} />
    </View>
  );
}

  return (
    <View style={styles.container}>
      <Text style={styles.instructions}>Point the camera at the QR / barcode provided by your manager.</Text>
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
          <Text style={styles.scanLabel}>Last scan</Text>
          <Text style={styles.scanValue}>{scannedData}</Text>
        </View>
      ) : null}
      {!isScanning ? (
        <PrimaryButton
          title="Scan another badge"
          onPress={() => {
            setScannedData(null);
            setIsScanning(true);
          }}
          style={styles.button}
        />
      ) : null}
    </View>
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
