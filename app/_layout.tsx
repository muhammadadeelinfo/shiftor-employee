import { useEffect } from 'react';
import { Slot, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { AuthProvider } from '@hooks/useSupabaseAuth';
import { queryClient } from '@lib/queryClient';
import { useExpoPushToken } from '@hooks/useExpoPushToken';
import { TopBar } from '@shared/components/TopBar';
import { NotificationProvider } from '@shared/context/NotificationContext';

const hiddenTopBarPaths = ['/login', '/signup'];

function LayoutContent() {
  const pushToken = useExpoPushToken();
  const pathname = usePathname();
  const shouldShowTopBar = pathname ? !hiddenTopBarPaths.some((path) => pathname.startsWith(path)) : true;
  const statusBarStyle = shouldShowTopBar ? 'light' : 'dark';
  const statusBarBgColor = shouldShowTopBar ? '#030712' : '#f8fafc';

  useEffect(() => {
    if (Constants.appOwnership === 'expo') {
      console.warn(
        'Remote push notifications are not available in Expo Go (SDK 53+). Use a dev build for push tokens.'
      );
      return;
    }

    let isMounted = true;

    (async () => {
      const { setNotificationHandler } = await import('expo-notifications');
      if (!isMounted) return;

      setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowAlert: true,
        }),
      });
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

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar
          translucent={false}
          backgroundColor={statusBarBgColor}
          style={statusBarStyle}
          hidden={false}
        />
        {shouldShowTopBar ? <TopBar /> : null}
        <View style={styles.content}>
          <Slot />
        </View>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <NotificationProvider>
      <SafeAreaProvider>
        <LayoutContent />
      </SafeAreaProvider>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
