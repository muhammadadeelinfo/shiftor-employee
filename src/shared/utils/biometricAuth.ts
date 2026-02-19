import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIC_UNLOCK_STORAGE_KEY_BASE = 'shiftor-employee-biometric-unlock';

export const getBiometricUnlockStorageKey = (userId?: string | null) =>
  userId ? `${BIOMETRIC_UNLOCK_STORAGE_KEY_BASE}:${userId}` : null;

export const loadBiometricUnlockPreference = async (userId?: string | null) => {
  const key = getBiometricUnlockStorageKey(userId);
  if (!key) return false;
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored === 'true';
  } catch {
    return false;
  }
};

export const saveBiometricUnlockPreference = async (
  enabled: boolean,
  userId?: string | null
) => {
  const key = getBiometricUnlockStorageKey(userId);
  if (!key) return;
  if (enabled) {
    await AsyncStorage.setItem(key, 'true');
    return;
  }
  await AsyncStorage.removeItem(key);
};

export const isBiometricAvailable = async () => {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
};

export const requestBiometricUnlock = async (
  promptMessage: string,
  fallbackLabel: string
) =>
  LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
