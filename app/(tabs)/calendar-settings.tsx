import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { BackButton } from '@shared/components/BackButton';
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
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  type CalendarSettingGroup = {
    key: string;
    title: string;
    description: string;
    actions: CalendarSettingAction[];
  };

  const groups = useMemo<CalendarSettingGroup[]>(
    () => [
      {
        key: 'inApp',
        title: t('calendarSettingsGroupInApp'),
        description: t('calendarSettingsGroupInAppDesc'),
        actions: [
          {
            key: 'calendar',
            label: t('calendarMenuOpen'),
            description: t('calendarMenuOpenDesc'),
            icon: 'calendar-outline' as const,
            onPress: () => {
              router.push('/calendar');
            },
          },
          {
            key: 'sync',
            label: t('calendarMenuSync'),
            description: t('calendarMenuSyncDesc'),
            icon: 'sync-outline' as const,
            onPress: () => {
              router.push('/calendar');
            },
          },
        ],
      },
      {
        key: 'external',
        title: t('calendarSettingsGroupExternal'),
        description: t('calendarSettingsGroupExternalDesc'),
        actions: [
          {
            key: 'google',
            label: t('calendarMenuImportGoogle'),
            description: t('calendarMenuImportGoogleDesc'),
            icon: 'logo-google' as const,
            onPress: () => {
              void Linking.openURL('https://calendar.google.com');
            },
          },
          {
            key: 'outlook',
            label: t('calendarMenuImportOutlook'),
            description: t('calendarMenuImportOutlookDesc'),
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <LinearGradient
        colors={[theme.heroGradientStart, theme.background]}
        start={[0, 0]}
        end={[1, 1]}
        style={styles.backgroundGradient}
      />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <BackButton fallbackHref="/account" />
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
            style={[
              styles.group,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderSoft,
              },
            ]}
          >
            <View style={styles.groupHeader}>
              <View style={styles.groupTitleWrap}>
                <Text style={[styles.groupTitle, { color: theme.textPrimary }]}>{group.title}</Text>
                <Text style={[styles.groupDescription, { color: theme.textSecondary }]}>
                  {group.description}
                </Text>
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
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{action.label}</Text>
                  <Text style={[styles.rowDescription, { color: theme.textSecondary }]}>
                    {action.description}
                  </Text>
                </View>
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
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 4,
  },
  group: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupTitleWrap: {
    flex: 1,
    gap: 3,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  groupDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  row: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  rowLast: {
    marginBottom: 0,
  },
});
