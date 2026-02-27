import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@shared/themeContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { useWindowDimensions } from 'react-native';

const iconConfig: Record<
  string,
  { active: string; inactive: string; labelKey: string }
> = {
  'my-shifts': {
    active: 'list',
    inactive: 'list-outline',
    labelKey: 'shiftsTabTitle',
  },
  calendar: {
    active: 'calendar',
    inactive: 'calendar-outline',
    labelKey: 'tabCalendar',
  },
  'qr-clock-in': {
    active: 'qr-code',
    inactive: 'qr-code-outline',
    labelKey: 'tabQrClockIn',
  },
  jobs: {
    active: 'briefcase',
    inactive: 'briefcase-outline',
    labelKey: 'startupJobsTitle',
  },
  account: {
    active: 'person-circle',
    inactive: 'person-circle-outline',
    labelKey: 'tabAccount',
  },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return <ThemeAwareTabs insets={insets} />;
}

function ThemeAwareTabs({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  return (
    <Tabs
      screenOptions={({ route }) => {
        const icon = iconConfig[route.name] ?? {
          active: 'square',
          inactive: 'square-outline',
          labelKey: 'shiftsTabTitle',
        };
        return {
          headerShown: false,
          tabBarLabel: t(icon.labelKey),
          tabBarLabelStyle: { fontSize: isTablet ? 12 : 11, fontWeight: '600', lineHeight: isTablet ? 14 : 13 },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.surfaceElevated,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            paddingVertical: 6,
            paddingBottom: Math.max(isTablet ? 10 : 12, insets.bottom),
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowOffset: { width: 0, height: -2 },
            shadowRadius: 12,
            elevation: 8,
            width: '100%',
            alignSelf: 'stretch',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            paddingTop: isTablet ? 1 : 2,
            paddingHorizontal: isTablet ? 4 : 0,
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
      <Tabs.Screen name="jobs" />
      <Tabs.Screen name="account" />
      <Tabs.Screen name="calendar-settings" options={{ href: null }} />
    </Tabs>
  );
}
