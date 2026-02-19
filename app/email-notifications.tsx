import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
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
  const trendIntensity = Math.min(1, recentNotificationCount / 12);
  const trendPercent = Math.max(12, Math.round(trendIntensity * 100));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <View style={styles.backgroundOrbs} pointerEvents="none">
        <View style={[styles.orb, styles.orbTop, { backgroundColor: `${theme.primary}20` }]} />
        <View style={[styles.orb, styles.orbBottom, { backgroundColor: `${theme.primaryAccent}18` }]} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(24, insets.bottom + 20) },
        ]}
      >
        <View style={[styles.sectionCard, styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <LinearGradient
            colors={[`${theme.primary}12`, `${theme.primaryAccent}08`]}
            style={styles.heroGradient}
            start={[0, 0]}
            end={[1, 1]}
          />
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('emailNotificationsTitle')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('emailNotificationsSubtitle')}</Text>
          <View style={styles.heroStatsRow}>
            <View style={[styles.heroStatChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>7D</Text>
              <Text style={[styles.heroStatValue, { color: theme.textPrimary }]}>{recentNotificationCount}</Text>
            </View>
            <View style={[styles.heroStatChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>RECOMMENDED</Text>
              <Text style={[styles.heroStatValue, { color: theme.textPrimary }]}>
                {t(frequencyLabelKey[recommendedFrequency])}
              </Text>
            </View>
          </View>

          <View style={[styles.row, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('emailNotificationsEnable')}</Text>
            <Switch
              value={settings.enabled}
              onValueChange={(enabled) => setSettings((prev) => ({ ...prev, enabled }))}
              trackColor={{ false: theme.borderSoft, true: `${theme.primary}99` }}
              thumbColor={settings.enabled ? theme.primary : theme.surface}
            />
          </View>
          <Text style={[styles.autoSaveHint, { color: theme.textSecondary }]}>{t('emailNotificationsAutoSave')}</Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{t('emailNotificationsFrequency')}</Text>
          <View
            style={[
              styles.frequencyRow,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
            ]}
          >
            {frequencyOptions.map((option) => {
              const active = settings.frequency === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSettings((prev) => ({ ...prev, frequency: option }))}
                  style={[
                    styles.frequencyChip,
                    {
                      backgroundColor: active ? theme.surface : 'transparent',
                      borderColor: active ? theme.primary : 'transparent',
                    },
                  ]}
                >
                  {active ? (
                    <LinearGradient
                      colors={[`${theme.primary}20`, `${theme.primaryAccent}22`]}
                      style={styles.frequencyChipGradient}
                      start={[0, 0]}
                      end={[1, 1]}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.frequencyChipLabel,
                      { color: active ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    {t(frequencyLabelKey[option])}
                  </Text>
                </Pressable>
              );
            })}
          </View>

        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.groupLabel, styles.groupLabelNoTop, { color: theme.textSecondary }]}>
            {t('emailNotificationsCategories')}
          </Text>
          <View style={[styles.categoryRow, { borderColor: theme.borderSoft }]}>
            <View style={[styles.categoryIconWrap, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="calendar-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('emailNotificationsCategoryShift')}</Text>
            <Switch
              value={settings.includeShift}
              onValueChange={(includeShift) => setSettings((prev) => ({ ...prev, includeShift }))}
              trackColor={{ false: theme.borderSoft, true: `${theme.primary}99` }}
              thumbColor={settings.includeShift ? theme.primary : theme.surface}
            />
          </View>
          <View style={[styles.categoryRow, { borderColor: theme.borderSoft }]}>
            <View style={[styles.categoryIconWrap, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="briefcase-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('emailNotificationsCategoryAdmin')}</Text>
            <Switch
              value={settings.includeAdmin}
              onValueChange={(includeAdmin) => setSettings((prev) => ({ ...prev, includeAdmin }))}
              trackColor={{ false: theme.borderSoft, true: `${theme.primary}99` }}
              thumbColor={settings.includeAdmin ? theme.primary : theme.surface}
            />
          </View>
          <View style={[styles.categoryRow, { borderColor: theme.borderSoft }]}>
            <View style={[styles.categoryIconWrap, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="megaphone-outline" size={16} color={theme.primary} />
            </View>
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
          <View style={[styles.trendBar, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
            <LinearGradient
              colors={[theme.primary, theme.primaryAccent]}
              style={[styles.trendFill, { width: `${trendPercent}%` }]}
              start={[0, 0]}
              end={[1, 0]}
            />
          </View>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  backgroundOrbs: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -90,
    right: -70,
  },
  orbBottom: {
    width: 270,
    height: 270,
    bottom: -140,
    left: -90,
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
    overflow: 'hidden',
  },
  heroCard: {
    position: 'relative',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
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
  heroStatsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 10,
    marginBottom: 2,
  },
  heroStatChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroStatValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
  },
  groupLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  groupLabelNoTop: {
    marginTop: 0,
  },
  row: {
    minHeight: 46,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryRow: {
    minHeight: 56,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
    borderRadius: 14,
    borderWidth: 1,
    padding: 6,
  },
  frequencyChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  frequencyChipGradient: {
    ...StyleSheet.absoluteFillObject,
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
  trendBar: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trendFill: {
    height: '100%',
    borderRadius: 999,
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
    marginTop: 12,
    fontSize: 12,
  },
});
