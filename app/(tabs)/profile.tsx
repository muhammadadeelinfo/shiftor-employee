import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { getShifts } from '@features/shifts/shiftsService';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { languageDefinitions, useLanguage } from '@shared/context/LanguageContext';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDay = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTimeRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const startLabel = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endLabel = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${startLabel} · ${endLabel}`;
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
  const renderLanguageToggle = (
    <View style={[styles.languagePill, { backgroundColor: theme.surface }]}>
      {languageDefinitions.map((definition) => {
        const isActive = language === definition.code;
        return (
          <TouchableOpacity
            key={definition.code}
            onPress={() => setLanguage(definition.code)}
            style={[styles.languageOption, isActive && styles.languageOptionActive]}
          >
            <Text style={[styles.languageText, isActive && styles.languageTextActive]}>
              {definition.flag} {definition.shortLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  const router = useRouter();
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
  const nextShift = upcomingShifts[0];
  const nextShiftLabel = nextShift
    ? `${new Date(nextShift.start).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })} · ${new Date(nextShift.start).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : t('noUpcomingShifts');
  const nextShiftLocation = nextShift?.objectName ?? nextShift?.location;
  const handleSignOut = () => {
    signOut();
  };
  const handleViewSchedule = () => {
    router.push('/my-shifts');
  };
  const upcomingPreview = upcomingShifts.slice(0, 3);
  const quickActions = [
    {
      id: 'clock-in',
      label: t('quickActionClockIn'),
      subtitle: t('quickActionClockInSub'),
    },
    {
      id: 'hours',
      label: t('quickActionHours'),
      subtitle: t('quickActionHoursSub'),
    },
    {
      id: 'support',
      label: t('quickActionSupport'),
      subtitle: t('quickActionSupportSub'),
    },
  ];
  const heroGradientColors =
    mode === 'dark'
      ? ['#111827', '#0f172a', theme.primary]
      : [theme.primary, '#7c3aed', '#2563eb'];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <LinearGradient colors={heroGradientColors} style={styles.heroGradient}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>{t('profileGreeting', { name: profileName(user) })}</Text>
            <Text style={styles.heroSubtitle}>{t('profileSettingsSync')}</Text>
          </View>
          <View style={[styles.avatar, { shadowColor: '#1f2937', shadowOpacity: 0.4 }]}>
            <Text style={styles.avatarInitial}>{profileName(user).charAt(0)}</Text>
          </View>
        </View>
        <View style={styles.heroTagRow}>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagLabel}>{t('memberSince', { date: formatDate(user?.created_at) })}</Text>
          </View>
          <View style={[styles.heroTag, { backgroundColor: '#0f172a' }]}>
            <Text style={[styles.heroTagLabel, { color: '#f8fafc' }]}>{translatedStatus}</Text>
          </View>
        </View>
      </LinearGradient>

      {renderLanguageToggle}

      <View style={styles.statsGrid}>
        {[
          { label: t('providerLabel'), value: provider.toUpperCase() },
          {
            label: t('emailVerifiedLabel'),
            value: user?.email_confirmed_at ? t('yes') : t('pending'),
          },
          { label: t('memberSinceLabel'), value: formatDate(user?.created_at) },
        ].map((stat, index, list) => (
          <View
            key={stat.label}
            style={[
              styles.statCard,
              {
                backgroundColor: theme.surface,
                shadowColor: theme.shadowBlue,
              },
              index !== list.length - 1 && { marginRight: 12 },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadowBlue,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('quickActionsTitle')}</Text>
        <View style={styles.actionRow}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionButton,
                { borderColor: theme.border },
                index === quickActions.length - 1 && { marginRight: 0 },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.actionTitle}>{action.label}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadowBlue,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('shiftSnapshot')}</Text>
        <View style={styles.snapshotRow}>
          <View style={styles.snapshotMetric}>
            <Text style={[styles.snapshotValue, { color: theme.textPrimary }]}>
              {upcomingShifts.length}
            </Text>
            <Text style={[styles.snapshotLabel, { color: theme.textSecondary }]}>
              {t('upcomingShifts')}
            </Text>
          </View>
          <View style={styles.snapshotMetric}>
            <Text style={[styles.snapshotValue, { color: theme.textPrimary }]}>
              {upcomingHoursLabel}
            </Text>
            <Text style={[styles.snapshotLabel, { color: theme.textSecondary }]}>
              {t('shiftHoursLabel')}
            </Text>
          </View>
        </View>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>{t('nextShift')}</Text>
          <Text style={[styles.detailValue, { color: theme.textSecondary }]}>{nextShiftLabel}</Text>
          {nextShiftLocation ? (
            <Text style={[styles.miniValue, { color: theme.textSecondary }]}>
              {nextShiftLocation}
            </Text>
          ) : null}
        </View>
        <PrimaryButton title={t('viewSchedule')} onPress={handleViewSchedule} style={styles.button} />
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadowBlue,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('upcomingShiftListTitle')}</Text>
        <View style={styles.upcomingList}>
          {upcomingPreview.length ? (
            upcomingPreview.map((shift) => (
              <View key={shift.id} style={styles.upcomingItem}>
                <View>
                  <Text style={[styles.upcomingDay, { color: theme.textPrimary }]}>
                    {formatDay(shift.start)}
                  </Text>
                  <Text style={[styles.upcomingTime, { color: theme.textSecondary }]}>
                    {formatTimeRange(shift.start, shift.end)}
                  </Text>
                </View>
                {shift.objectName ?? shift.location ? (
                  <Text style={[styles.upcomingLocation, { color: theme.textSecondary }]}>
                    {shift.objectName ?? shift.location}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={[styles.miniValue, { color: theme.textSecondary }]}>
              {t('noUpcomingShifts')}
            </Text>
          )}
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadowBlue,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('security')}</Text>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>{t('providerLabel')}</Text>
          <Text style={[styles.detailValue, { color: theme.textSecondary }]}>{provider}</Text>
        </View>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>{t('emailVerifiedLabel')}</Text>
          <Text style={[styles.detailValue, { color: theme.textSecondary }]}>
            {user?.email_confirmed_at ? t('yes') : t('no')}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadowBlue,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('appearance')}</Text>
        <View style={styles.toggleRow}>
          {(['light', 'dark'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.toggleButton,
                mode === option && styles.toggleButtonActive,
                mode === option && { borderColor: theme.primary },
              ]}
              onPress={() => setMode(option)}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  mode === option && styles.toggleLabelActive,
                  mode === option && { color: theme.primary },
                ]}
              >
                {option === 'light' ? t('lightMode') : t('darkMode')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <PrimaryButton title={t('signOut')} onPress={handleSignOut} style={styles.button} />
      <TouchableOpacity onPress={handleSignOut}>
        <Text style={[styles.link, { color: theme.primary }]}>{t('switchAccount')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  content: {
    paddingBottom: 40,
  },
  heroGradient: {
    borderRadius: 26,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 6,
  },
  heroTagRow: {
    flexDirection: 'row',
    marginTop: 18,
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
    letterSpacing: 0.5,
    color: '#e0e7ff',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarInitial: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 22,
  },
  languagePill: {
    flexDirection: 'row',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 20,
    alignSelf: 'stretch',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  languageOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginHorizontal: 4,
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  languageOptionActive: {
    backgroundColor: '#2563eb',
  },
  languageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  languageTextActive: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
    color: '#94a3b8',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    color: '#111827',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  detailLabel: {
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  detailBlock: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  snapshotMetric: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  snapshotValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  snapshotLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniLabel: {
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  miniValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  button: {
    marginTop: 18,
  },
  link: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#eef2ff',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  toggleLabelActive: {
    color: '#2563eb',
  },
  upcomingList: {
    marginTop: 8,
  },
  upcomingItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  upcomingDay: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  upcomingTime: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  upcomingLocation: {
    fontSize: 13,
    marginTop: 6,
  },
});
