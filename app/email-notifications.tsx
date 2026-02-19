import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@shared/themeContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { useNotifications } from '@shared/context/NotificationContext';
import { layoutTokens } from '@shared/theme/layout';

type Frequency = 'instant' | 'daily' | 'weekly';

type EmailNotificationSettings = {
  enabled: boolean;
  frequency: Frequency;
  includeShift: boolean;
  includeAdmin: boolean;
  includeGeneral: boolean;
};

const SETTINGS_STORAGE_KEY = 'employee-portal-email-notification-settings';

const defaultSettings: EmailNotificationSettings = {
  enabled: true,
  frequency: 'daily',
  includeShift: true,
  includeAdmin: true,
  includeGeneral: true,
};

const parseNotificationTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const frequencyLabelKey: Record<Frequency, 'emailFrequencyInstant' | 'emailFrequencyDaily' | 'emailFrequencyWeekly'> =
  {
    instant: 'emailFrequencyInstant',
    daily: 'emailFrequencyDaily',
    weekly: 'emailFrequencyWeekly',
  };

export default function EmailNotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { notifications } = useNotifications();
  const [settings, setSettings] = useState<EmailNotificationSettings>(defaultSettings);

  const recentNotificationCount = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    return notifications.filter((item) => parseNotificationTimestamp(item.createdAt) >= sevenDaysAgo).length;
  }, [notifications]);

  const recommendedFrequency: Frequency = useMemo(() => {
    if (recentNotificationCount >= 12) return 'instant';
    if (recentNotificationCount >= 4) return 'daily';
    return 'weekly';
  }, [recentNotificationCount]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw) as Partial<EmailNotificationSettings>;
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          frequency:
            parsed.frequency === 'instant' || parsed.frequency === 'daily' || parsed.frequency === 'weekly'
              ? parsed.frequency
              : prev.frequency,
        }));
      } catch {
        // Keep defaults if storage data is unavailable.
      }
    };
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch(() => {
      // Ignore local persistence failures.
    });
  }, [settings]);

  const frequencyOptions: Frequency[] = ['instant', 'daily', 'weekly'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(24, insets.bottom + 20) },
        ]}
      >
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('emailNotificationsTitle')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('emailNotificationsSubtitle')}</Text>

          <View style={[styles.row, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('emailNotificationsEnable')}</Text>
            <Switch
              value={settings.enabled}
              onValueChange={(enabled) => setSettings((prev) => ({ ...prev, enabled }))}
              trackColor={{ false: theme.borderSoft, true: `${theme.primary}99` }}
              thumbColor={settings.enabled ? theme.primary : theme.surface}
            />
          </View>

          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{t('emailNotificationsFrequency')}</Text>
          <View style={styles.frequencyRow}>
            {frequencyOptions.map((option) => {
              const active = settings.frequency === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSettings((prev) => ({ ...prev, frequency: option }))}
                  style={[
                    styles.frequencyChip,
                    {
                      backgroundColor: active ? theme.primary : theme.surfaceMuted,
                      borderColor: active ? theme.primary : theme.borderSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.frequencyChipLabel,
                      { color: active ? '#fff' : theme.textPrimary },
                    ]}
                  >
                    {t(frequencyLabelKey[option])}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{t('emailNotificationsCategories')}</Text>
          <View style={[styles.row, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('emailNotificationsCategoryShift')}</Text>
            <Switch
              value={settings.includeShift}
              onValueChange={(includeShift) => setSettings((prev) => ({ ...prev, includeShift }))}
              trackColor={{ false: theme.borderSoft, true: `${theme.primary}99` }}
              thumbColor={settings.includeShift ? theme.primary : theme.surface}
            />
          </View>
          <View style={[styles.row, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('emailNotificationsCategoryAdmin')}</Text>
            <Switch
              value={settings.includeAdmin}
              onValueChange={(includeAdmin) => setSettings((prev) => ({ ...prev, includeAdmin }))}
              trackColor={{ false: theme.borderSoft, true: `${theme.primary}99` }}
              thumbColor={settings.includeAdmin ? theme.primary : theme.surface}
            />
          </View>
          <View style={[styles.row, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('emailNotificationsCategoryGeneral')}</Text>
            <Switch
              value={settings.includeGeneral}
              onValueChange={(includeGeneral) => setSettings((prev) => ({ ...prev, includeGeneral }))}
              trackColor={{ false: theme.borderSoft, true: `${theme.primary}99` }}
              thumbColor={settings.includeGeneral ? theme.primary : theme.surface}
            />
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.trendTitle, { color: theme.textPrimary }]}>{t('emailNotificationsTrendTitle')}</Text>
          <Text style={[styles.trendHint, { color: theme.textSecondary }]}>
            {t('emailNotificationsTrendHint', {
              count: recentNotificationCount,
              frequency: t(frequencyLabelKey[recommendedFrequency]).toLowerCase(),
            })}
          </Text>
          <Pressable
            onPress={() =>
              setSettings((prev) => ({
                ...prev,
                enabled: true,
                frequency: recommendedFrequency,
              }))
            }
            style={[styles.applyButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.applyButtonLabel}>{t('emailNotificationsApplyTrend')}</Text>
          </Pressable>
          <Text style={[styles.autoSaveHint, { color: theme.textSecondary }]}>{t('emailNotificationsAutoSave')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 14,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  groupLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  row: {
    minHeight: 46,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingRight: 12,
  },
  frequencyRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  frequencyChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  frequencyChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  applyButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  autoSaveHint: {
    marginTop: 10,
    fontSize: 12,
  },
});
