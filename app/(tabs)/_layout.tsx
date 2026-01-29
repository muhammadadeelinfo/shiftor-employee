import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@shared/themeContext';

const iconConfig: Record<string, { active: string; inactive: string; label: string }> = {
  'my-shifts': {
    active: 'list',
    inactive: 'list-outline',
    label: 'Shifts',
  },
  calendar: {
    active: 'calendar',
    inactive: 'calendar-outline',
    label: 'Calendar',
  },
  'qr-clock-in': {
    active: 'qr-code',
    inactive: 'qr-code-outline',
    label: 'QR Clock-In',
  },
  profile: {
    active: 'person-circle',
    inactive: 'person-circle-outline',
    label: 'Profile',
  },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <ThemeProvider>
      <ThemeAwareTabs insets={insets} />
    </ThemeProvider>
  );
}

function ThemeAwareTabs({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const { theme } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => {
        const icon = iconConfig[route.name] ?? {
          active: 'square',
          inactive: 'square-outline',
          label: route.name,
        };
        return {
          headerShown: false,
          tabBarLabel: icon.label,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.surfaceElevated,
            borderTopColor: theme.border,
            paddingVertical: 6,
            paddingBottom: Math.max(12, insets.bottom),
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowOffset: { width: 0, height: -2 },
            shadowRadius: 12,
            elevation: 8,
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            paddingTop: 2,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={(focused ? icon.active : icon.inactive) as any} color={color} size={size} />
          ),
        };
      }}
    >
      <Tabs.Screen name="my-shifts" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="qr-clock-in" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
