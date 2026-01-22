import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const iconConfig: Record<string, { name: string; label: string }> = {
  'my-shifts': { name: 'calendar-outline', label: 'Shifts' },
  'qr-clock-in': { name: 'qr-code-outline', label: 'QR Clock-In' },
  profile: { name: 'person-circle-outline', label: 'Profile' },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const icon = iconConfig[route.name] ?? { name: 'stats-chart-outline', label: route.name };
        return {
          headerShown: false,
          tabBarLabel: icon.label,
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e5e7eb' },
          tabBarIcon: ({ color, size }) => <Ionicons name={icon.name as any} color={color} size={size} />,
        };
      }}
    >
      <Tabs.Screen name="my-shifts" />
      <Tabs.Screen name="qr-clock-in" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
