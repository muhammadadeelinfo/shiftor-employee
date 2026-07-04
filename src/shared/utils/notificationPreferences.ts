import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPreferenceKey =
  | 'shiftUpdates'
  | 'shiftReminders'
  | 'vacationDocuments';

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const defaultNotificationPreferences: NotificationPreferences = {
  shiftUpdates: true,
  shiftReminders: true,
  vacationDocuments: true,
};

export const notificationPreferenceKeys: NotificationPreferenceKey[] = [
  'shiftUpdates',
  'shiftReminders',
  'vacationDocuments',
];

const storageKey = (userId?: string | null) =>
  userId ? `shiftor:notification-preferences:${userId}` : 'shiftor:notification-preferences:guest';

export const normalizeNotificationPreferences = (
  value: unknown
): NotificationPreferences => {
  const source = value && typeof value === 'object' ? (value as Partial<NotificationPreferences>) : {};
  return {
    shiftUpdates:
      typeof source.shiftUpdates === 'boolean'
        ? source.shiftUpdates
        : defaultNotificationPreferences.shiftUpdates,
    shiftReminders:
      typeof source.shiftReminders === 'boolean'
        ? source.shiftReminders
        : defaultNotificationPreferences.shiftReminders,
    vacationDocuments:
      typeof source.vacationDocuments === 'boolean'
        ? source.vacationDocuments
        : defaultNotificationPreferences.vacationDocuments,
  };
};

export const loadNotificationPreferences = async (userId?: string | null) => {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return defaultNotificationPreferences;
  try {
    return normalizeNotificationPreferences(JSON.parse(raw));
  } catch {
    return defaultNotificationPreferences;
  }
};

export const saveNotificationPreferences = async (
  preferences: NotificationPreferences,
  userId?: string | null
) => {
  const normalized = normalizeNotificationPreferences(preferences);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  return normalized;
};
