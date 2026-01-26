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
import { TopBar, type TopBarVariant } from '@shared/components/TopBar';
import { NotificationProvider } from '@shared/context/NotificationContext';
import { LanguageProvider } from '@shared/context/LanguageContext';

const hiddenTopBarPaths = ['/login', '/signup'];

function LayoutContent() {
  const pushToken = useExpoPushToken();
  const pathname = usePathname();
  const shouldShowTopBar = pathname ? !hiddenTopBarPaths.some((path) => pathname.startsWith(path)) : true;
  const statusBarStyle = 'dark';
  const statusBarBgColor = '#f8fafc';
  const floatingRoutes = ['/my-shifts'];
  const compactRoutes = ['/shift-details'];
  let topBarVariant: TopBarVariant = 'regular';
  if (pathname) {
    if (floatingRoutes.some((route) => pathname.startsWith(route))) {
      topBarVariant = 'floating';
    } else if (compactRoutes.some((route) => pathname.startsWith(route))) {
      topBarVariant = 'compact';
    }
  }

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
      <View style={[styles.root, { backgroundColor: statusBarBgColor }]}>
        <StatusBar
          translucent
          hidden={false}
          backgroundColor={statusBarBgColor}
          style={statusBarStyle}
        />
        {shouldShowTopBar && <TopBar variant={topBarVariant} />}
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
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
});
