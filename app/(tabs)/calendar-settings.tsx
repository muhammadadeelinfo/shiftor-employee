import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useTheme } from '@shared/themeContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';

export default function CalendarSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  type CalendarSettingAction = {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  type CalendarSettingGroup = {
    key: string;
    title: string;
    actions: CalendarSettingAction[];
  };

  const groups = useMemo<CalendarSettingGroup[]>(
    () => [
      {
        key: 'inApp',
        title: t('calendarSettingsGroupInApp'),
        actions: [
          {
            key: 'calendar',
            label: t('calendarMenuOpen'),
            icon: 'calendar-outline' as const,
            onPress: () => {
              router.push('/calendar');
            },
          },
          {
            key: 'sync',
            label: t('calendarMenuSync'),
            icon: 'sync-outline' as const,
            onPress: () => undefined,
          },
        ],
      },
      {
        key: 'external',
        title: t('calendarSettingsGroupExternal'),
        actions: [
          {
            key: 'google',
            label: t('calendarMenuImportGoogle'),
            icon: 'logo-google' as const,
            onPress: () => {
              void Linking.openURL('https://calendar.google.com');
            },
          },
          {
            key: 'outlook',
            label: t('calendarMenuImportOutlook'),
            icon: 'logo-microsoft' as const,
            onPress: () => {
              void Linking.openURL('https://outlook.live.com/calendar/');
            },
          },
        ],
      },
    ],
    [router, t]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderColor: theme.borderSoft }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.surfaceMuted }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{t('calendarSettingsTitle')}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('calendarSettingsSubtitle')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(20, tabBarHeight + insets.bottom + 8) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View
            key={group.key}
            style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
          >
            <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{group.title}</Text>
            {group.actions.map((action, index) => (
              <TouchableOpacity
                key={action.key}
                style={[
                  styles.row,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSoft,
                  },
                  index === group.actions.length - 1 && styles.rowLast,
                ]}
                onPress={action.onPress}
              >
                <View style={[styles.iconWrap, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Ionicons name={action.icon} size={16} color={theme.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{action.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 12,
  },
  group: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLast: {
    marginBottom: 0,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
