import { useEffect, useState } from 'react';
import Constants from 'expo-constants';

export const useExpoPushToken = () => {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const registerForPushNotifications = async () => {
      if (!Constants.isDevice || Constants.appOwnership === 'expo') {
        console.warn(
          'Expo Go cannot obtain push tokens (SDK 53+). Use a development build for Expo push notifications.'
        );
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

      const { data: pushToken } = await Notifications.getExpoPushTokenAsync();

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

  return token;
};
