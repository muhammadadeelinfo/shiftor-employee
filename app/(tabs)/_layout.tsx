import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemeProvider } from '@shared/themeContext';

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
  'shift-details/[id]': {
    active: 'information-circle',
    inactive: 'information-circle-outline',
    label: 'Details',
  },
};

export default function TabsLayout() {
  return (
    <ThemeProvider>
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
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#6b7280',
            tabBarStyle: {
              backgroundColor: '#fff',
              borderTopColor: '#e5e7eb',
              paddingVertical: 2,
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
        <Tabs.Screen
          name="shift-details/[id]"
          options={{
            tabBarButton: () => null,
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </ThemeProvider>
  );
}
