import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { getShifts } from '@features/shifts/shiftsService';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { languageDefinitions, useLanguage } from '@shared/context/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const profileName = (user: ReturnType<typeof useAuth>['user'] | null) => {
  if (!user) return 'Guest';
  const metadataName = user.user_metadata?.full_name;
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName;
  }
  return user.email?.split('@')[0] ?? 'Employee';
};

const shiftStatus = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return 'Active';
  const customStatus = metadata?.status;
  if (typeof customStatus === 'string' && customStatus.trim()) {
    return customStatus;
  }
  return 'Active';
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { mode, setMode, theme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const userId = user?.id;
  const provider = user?.identities?.[0]?.provider ?? 'email';
  const status = shiftStatus(user?.user_metadata);
  const translatedStatus = status === 'Active' ? t('statusActive') : status;
  const { data: profileShifts } = useQuery({
    queryKey: ['profile', 'shifts', userId],
    queryFn: () => getShifts(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });
  const now = useMemo(() => new Date(), []);
  const upcomingShifts = useMemo(() => {
    if (!profileShifts) return [];
    return profileShifts.filter((shift) => {
      const startDate = new Date(shift.start);
      return !Number.isNaN(startDate.getTime()) && startDate > now;
    });
  }, [profileShifts, now]);
  const upcomingHoursMs = useMemo(
    () =>
      upcomingShifts.reduce((total, shift) => {
        const startDate = new Date(shift.start);
        const endDate = new Date(shift.end);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
          return total;
        }
        return total + Math.max(0, endDate.getTime() - startDate.getTime());
      }, 0),
    [upcomingShifts]
  );
  const upcomingHoursLabel = `${Math.round((upcomingHoursMs / 3_600_000) * 10) / 10}h`;
  const stats = [
    {
      id: 'shifts',
      label: t('upcomingShifts'),
      value: `${upcomingShifts.length}`,
      detail: t('shiftPlanningSubtitle'),
    },
    {
      id: 'hours',
      label: t('shiftHoursLabel'),
      value: upcomingHoursLabel,
      detail: t('shiftSnapshot'),
    },
  ];
  const handleSignOut = () => {
    signOut();
  };
  const heroGradientColors = mode === 'dark' ? ['#0f172a', '#111827'] : ['#eef2ff', '#e0e7ff'];
  const heroTextColor = mode === 'dark' ? '#fff' : '#0f172a';
  const heroTagTextColor = mode === 'dark' ? '#f8fafc' : '#1e293b';
  const heroTagBorderColor = mode === 'dark' ? 'rgba(255,255,255,0.6)' : '#cbd5f5';
  const heroStatBackground = mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#fff';
  const heroStatLabelColor = mode === 'dark' ? 'rgba(255,255,255,0.75)' : '#94a3b8';
  const heroStatTextColor = mode === 'dark' ? '#fff' : '#0f172a';

  const safeAreaStyle = { paddingTop: 12 + insets.top };
  const contentContainerStyle = [styles.content, { paddingBottom: 40 + insets.bottom }];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background, ...safeAreaStyle }]}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={contentContainerStyle}
      >
        <LinearGradient colors={heroGradientColors} style={styles.heroGradient}>
          <View style={styles.heroRow}>
            <View>
              <Text style={[styles.heroTitle, { color: heroTextColor }]}>
                {t('profileGreeting', { name: profileName(user) })}
              </Text>
              <Text style={[styles.heroSubtitle, { color: heroTextColor }]}>{t('profileSettingsSync')}</Text>
            </View>
            <View style={[styles.avatar, { shadowColor: '#1f2937', shadowOpacity: 0.4 }]}>
              <Text style={styles.avatarInitial}>{profileName(user).charAt(0)}</Text>
            </View>
          </View>
          <View style={styles.heroTagRow}>
            <View style={[styles.heroTag, { borderColor: heroTagBorderColor }]}>
              <Text style={[styles.heroTagLabel, { color: heroTagTextColor }]}>
                {t('memberSince', { date: formatDate(user?.created_at) })}
              </Text>
            </View>
            <View style={[styles.heroTag, styles.heroTagActive, { borderColor: heroTagBorderColor }]}>
              <Text style={[styles.heroTagLabel, styles.heroTagActiveText]}>{translatedStatus}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.memberBadge,
              mode === 'dark' ? styles.memberBadgeDark : styles.memberBadgeLight,
            ]}
          >
            <Text
              style={[
                styles.memberBadgeText,
                { color: mode === 'dark' ? 'rgba(255,255,255,0.8)' : '#1f2937' },
              ]}
            >
              {t('memberSinceLabel')}
            </Text>
            <Text
              style={[
                styles.memberBadgeDetail,
                { color: mode === 'dark' ? '#fff' : '#0f172a' },
              ]}
            >
              {formatDate(user?.created_at)}
            </Text>
          </TouchableOpacity>
          <View style={styles.heroStatRow}>
            {stats.map((stat) => (
              <View key={stat.id} style={[styles.heroStatCard, { backgroundColor: heroStatBackground }]}>
                <Text style={[styles.heroStatLabel, { color: heroStatLabelColor }]}>{stat.label}</Text>
                <Text style={[styles.heroStatValue, { color: heroStatTextColor }]}>{stat.value}</Text>
                <Text style={[styles.heroStatDetail, { color: heroStatLabelColor }]} numberOfLines={1}>
                  {stat.detail}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>{t('accountSnapshot')}</Text>
          <View style={styles.infoGrid}>
            {[
              { label: t('providerLabel'), value: provider.toUpperCase() },
              {
                label: t('emailVerifiedLabel'),
                value: user?.email_confirmed_at ? t('yes') : t('pending'),
              },
              { label: t('statusActive'), value: translatedStatus },
            ].map((stat) => (
              <View key={stat.label} style={[styles.infoCard, { backgroundColor: theme.surface }]}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>{t('preferencesTitle')}</Text>
          <View style={styles.optionGroup}>
            <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>{t('appearance')}</Text>
            <View style={styles.toggleSwitch}>
              {(['light', 'dark'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setMode(option)}
                  style={styles.toggleOption}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleLabel, mode === option && styles.toggleLabelActive]}>
                    {option === 'light' ? t('lightMode') : t('darkMode')}
                  </Text>
                </TouchableOpacity>
              ))}
              <View
                style={[
                  styles.toggleThumb,
                  mode === 'dark' ? styles.toggleThumbRight : styles.toggleThumbLeft,
                  { borderColor: theme.primary },
                ]}
              />
            </View>
          </View>
          <View style={styles.optionGroup}>
            <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>{t('languageLabel')}</Text>
            <View style={styles.languageToggle}>
              {languageDefinitions.map((definition) => {
                const isActive = language === definition.code;
                return (
                  <TouchableOpacity
                    key={definition.code}
                    onPress={() => setLanguage(definition.code)}
                    style={[
                      styles.languageToggleButton,
                      isActive && styles.languageToggleButtonActive,
                    ]}
                  >
                    <Text style={[styles.languageIcon, isActive && styles.languageIconActive]}>
                      {definition.flag}
                    </Text>
                    <Text style={[styles.languageTextSmall, isActive && styles.languageTextSmallActive]}>
                      {definition.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>{t('security')}</Text>
          <PrimaryButton title={t('signOut')} onPress={handleSignOut} style={styles.button} />
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={[styles.link, { color: theme.primary }]}>{t('switchAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 40,
  },
  safeArea: {
    flex: 1,
  },
  heroGradient: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 6,
  },
  heroTagRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  heroTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  heroTagLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#f8fafc',
  },
  heroTagActive: {
    backgroundColor: '#111827',
    borderColor: 'transparent',
  },
  heroTagActiveText: {
    color: '#f8fafc',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1f2937',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarInitial: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 26,
  },
  memberBadge: {
    marginTop: 18,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  memberBadgeDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  memberBadgeLight: {
    backgroundColor: '#f8fafc',
  },
  memberBadgeText: {
    fontSize: 10,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.8)',
  },
  memberBadgeDetail: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  heroStatRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    padding: 10,
    marginHorizontal: 4,
  },
  heroStatLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.75)',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  heroStatDetail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  optionGroup: {
    marginBottom: 16,
  },
  optionLabel: {
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  toggleSwitch: {
    position: 'relative',
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    padding: 4,
    height: 38,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  toggleLabelActive: {
    color: '#111827',
  },
  toggleThumb: {
    position: 'absolute',
    width: '50%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    top: 0,
  },
  toggleThumbLeft: {
    left: 4,
  },
  toggleThumbRight: {
    right: 4,
  },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    padding: 4,
  },
  languageToggleButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  languageToggleButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
  },
  languageIcon: {
    fontSize: 14,
  },
  languageIconActive: {
    transform: [{ translateY: -1 }],
  },
  languageTextSmall: {
    fontSize: 10,
    letterSpacing: 0.3,
    color: '#475569',
  },
  languageTextSmallActive: {
    color: '#111827',
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  infoLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  button: {
    marginTop: 12,
  },
  link: {
    marginTop: 10,
    textAlign: 'center',
  },
});
