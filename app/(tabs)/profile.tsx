import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { languageDefinitions, useLanguage } from '@shared/context/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const provider = user?.identities?.[0]?.provider ?? 'email';
  const status = shiftStatus(user?.user_metadata);
  const translatedStatus = status === 'Active' ? t('statusActive') : status;
  const handleSignOut = () => {
    signOut();
  };
  const safeAreaStyle = { paddingTop: 12 + insets.top };
  const contentContainerStyle = [styles.content, { paddingBottom: 40 + insets.bottom }];
  const appearanceOptions = [
    { key: 'light' as const, label: t('lightMode') },
    { key: 'dark' as const, label: t('darkMode') },
  ];

  const heroGradientColors = [theme.heroGradientStart, theme.heroGradientEnd, theme.surfaceMuted];
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background, ...safeAreaStyle }]}>
      <LinearGradient
        colors={heroGradientColors}
        style={[styles.headerGradient, styles.headerGlass]}
        start={[0, 0]}
        end={[1, 1]}
      >
        <View style={styles.heroGlow} />
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.profileGreeting, { color: theme.textPrimary }]}>
                {t('profileGreeting', { name: profileName(user) })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: theme.primaryAccent }]}>
              <Text style={styles.statusBadgeText}>{translatedStatus}</Text>
            </View>
          </View>
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetricBlock}>
              <Text style={[styles.profileMetricLabel, { color: theme.textSecondary }]}>{t('memberSince')}</Text>
              <Text style={[styles.profileMetricValue, { color: theme.textPrimary }]}>{formatDate(user?.created_at)}</Text>
            </View>
            <View style={styles.heroMetricBlock}>
              <Text style={[styles.profileMetricLabel, { color: theme.textSecondary }]}>{t('providerLabel')}</Text>
              <Text style={[styles.profileMetricValue, { color: theme.textPrimary }]}>{provider.toUpperCase()}</Text>
            </View>
          </View>
        <View style={styles.heroActions} />
        </View>
      </LinearGradient>

      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>{t('accountSnapshot')}</Text>
          <View style={styles.infoGrid}>
            {[
              { label: t('emailVerifiedLabel'), value: user?.email_confirmed_at ? t('yes') : t('pending') },
              { label: t('statusActive'), value: translatedStatus },
            ].map((stat) => (
              <View key={stat.label} style={[styles.infoCard, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>{t('security')}</Text>
          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: theme.textSecondary }]}>{t('preferencesTitle')}</Text>
            <View style={styles.toggleRow}>
              {appearanceOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setMode(option.key)}
                  style={[
                    styles.togglePill,
                    mode === option.key && styles.togglePillActive,
                    { borderColor: theme.borderSoft, backgroundColor: mode === option.key ? theme.primary : 'transparent' },
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleLabel,
                      mode === option.key ? styles.toggleLabelActive : { color: theme.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: theme.textSecondary }]}>{t('languageLabel')}</Text>
            <View style={styles.languageToggleList}>
              {languageDefinitions.map((definition) => {
                const isActive = language === definition.code;
                return (
                  <TouchableOpacity
                    key={definition.code}
                    onPress={() => setLanguage(definition.code)}
                    style={[
                      styles.languageToggleItem,
                      isActive && styles.languageToggleItemActive,
                      { backgroundColor: isActive ? theme.primary : theme.surfaceMuted },
                    ]}
                  >
                    <Text style={styles.languageFlag}>{definition.flag}</Text>
                    <Text
                      style={[
                        styles.languageShortLabel,
                        isActive ? styles.languageShortLabelActive : { color: theme.textPrimary },
                      ]}
                    >
                      {definition.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
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
  safeArea: {
    flex: 1,
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
  },
  headerGlass: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    bottom: -20,
    left: 28,
    right: 28,
    height: 90,
    borderRadius: 50,
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
    opacity: 0.4,
    shadowColor: '#818cf8',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 24 },
    shadowRadius: 30,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileGreeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 10,
    flexWrap: 'wrap',
  },
  heroCard: {
    padding: 14,
    borderRadius: 26,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroMetrics: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroMetricBlock: {
    flex: 1,
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  profileInfo: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileInfoLeft: {
    flex: 1,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  profileInfoRight: {
    flex: 1,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  profileMetricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  profileMetricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  heroActions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroMeta: {
    flex: 1,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 26,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1c2342',
    shadowColor: '#050914',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 18,
    padding: 14,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  preferenceGroup: {
    marginBottom: 16,
  },
  preferenceLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePillActive: {
    borderWidth: 0,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: '#fff',
  },
  languageToggleList: {
    flexDirection: 'row',
    gap: 12,
  },
  languageToggleItem: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  languageToggleItemActive: {
    borderWidth: 0,
  },
  languageFlag: {
    fontSize: 14,
  },
  languageShortLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  languageShortLabelActive: {
    color: '#fff',
  },
  button: {
    marginTop: 16,
  },
  link: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
});
