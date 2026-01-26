import { useEffect } from 'react';
import { Slot, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { AuthProvider } from '@hooks/useSupabaseAuth';
import { queryClient } from '@lib/queryClient';
import { useExpoPushToken } from '@hooks/useExpoPushToken';
import { NotificationBell } from '@shared/components/NotificationBell';
import { NotificationProvider } from '@shared/context/NotificationContext';
import { LanguageProvider } from '@shared/context/LanguageContext';

const hiddenTopBarPaths = ['/login', '/signup'];

function LayoutContent() {
  const pushToken = useExpoPushToken();
  const pathname = usePathname();
  const shouldShowNotificationBell = pathname
    ? !hiddenTopBarPaths.some((path) => pathname.startsWith(path))
    : true;
  const insets = useSafeAreaInsets();
  const statusBarStyle = 'dark';
  const statusBarBgColor = '#f8fafc';

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
    <QueryClientProvider client={queryClient}>
        <SafeAreaView style={[styles.root, { backgroundColor: statusBarBgColor }]} edges={['top']}>
        <StatusBar
          translucent
          hidden={false}
          backgroundColor={statusBarBgColor}
          style={statusBarStyle}
        />
        {shouldShowNotificationBell && (
          <View style={[styles.notificationOverlay, { top: insets.top + 8 }]}>
            <NotificationBell />
          </View>
        )}
        <View style={styles.content}>
          <Slot />
        </View>
      </SafeAreaView>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <SafeAreaProvider>
          <LanguageProvider>
            <LayoutContent />
          </LanguageProvider>
        </SafeAreaProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
  },
  notificationOverlay: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 10,
  },
});
