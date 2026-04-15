import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useTheme } from '@shared/themeContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { LinearGradient } from 'expo-linear-gradient';

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
  const heroStats = useMemo(
    () => [
      { key: 'inAppCount', label: t('calendarSettingsGroupInApp'), value: '2' },
      { key: 'externalCount', label: t('calendarSettingsGroupExternal'), value: '2' },
    ],
    [t]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <LinearGradient
        colors={[theme.heroGradientStart, theme.background]}
        start={[0, 0]}
        end={[1, 1]}
        style={styles.backgroundGradient}
      />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
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
        <View style={styles.summaryPillsRow}>
          {heroStats.map((stat) => (
            <View
              key={stat.key}
              style={[styles.summaryPill, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            >
              <Text style={[styles.summaryPillLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
              <Text style={[styles.summaryPillValue, { color: theme.textPrimary }]}>{stat.value}</Text>
            </View>
          ))}
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
            style={[
              styles.group,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderSoft,
              },
            ]}
          >
            <View style={styles.groupHeader}>
              <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{group.title}</Text>
              <View style={[styles.groupCountBadge, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
                <Text style={[styles.groupCountValue, { color: theme.textPrimary }]}>{group.actions.length}</Text>
              </View>
            </View>
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
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
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
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  header: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: layoutTokens.screenTop,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
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
    opacity: 0.88,
  },
  summaryPillsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  summaryPill: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryPillValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 8,
  },
  group: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  groupCountBadge: {
    borderWidth: 1,
    minWidth: 28,
    height: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCountValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 54,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  rowLast: {
    marginBottom: 0,
  },
});
