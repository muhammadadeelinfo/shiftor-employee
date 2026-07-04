import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@lib/supabaseClient';
import { useAuth } from '@hooks/useSupabaseAuth';
import { loadNotificationPreferences } from '@shared/utils/notificationPreferences';

const isMissingPushTableError = (error: unknown) => {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  return code === 'PGRST205' || /employee_push_tokens|schema cache|could not find the table/i.test(message);
};

const getProjectId = () => {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string }; easProjectId?: string }
    | undefined;
  return extra?.eas?.projectId || extra?.easProjectId || undefined;
};

const registerPushToken = async ({
  employeeId,
  token,
}: {
  employeeId: string;
  token: string;
}) => {
  if (!supabase) return;

  const preferences = await loadNotificationPreferences(employeeId);
  const { error } = await supabase.from('employee_push_tokens').upsert(
    {
      employee_id: employeeId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Constants.deviceName ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      preferences,
      disabled_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'employee_id,expo_push_token' }
  );

  if (error) {
    if (isMissingPushTableError(error)) {
      console.warn('Push token table is missing. Apply supabase/push-notifications.sql.');
      return;
    }
    throw error;
  }
};

export const useExpoPushToken = () => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const registerForPushNotifications = async () => {
      if (!Constants.isDevice || Constants.appOwnership === 'expo') {
        return;
      }

      const Notifications = await import('expo-notifications');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return;
      }

      const projectId = getProjectId();
      const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      if (!cancelled) {
        setToken(pushToken);
      }
    };

    registerForPushNotifications().catch((error) => {
      console.warn('Failed to register for push notifications', error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !token) return;
    registerPushToken({ employeeId: user.id, token }).catch((error) => {
      console.warn('Failed to register push token', error);
    });
  }, [token, user?.id]);

  return token;
};
