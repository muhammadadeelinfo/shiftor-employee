import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useShiftFeed } from '@features/shifts/useShiftFeed';
import { getShiftPhase } from '@shared/utils/shiftPhase';
import { useNotifications } from '@shared/context/NotificationContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { layoutTokens } from '@shared/theme/layout';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import {
  fetchVacationRequestContext,
  fetchVacationRequests,
} from '@features/account/vacationRequests';
import {
  fetchEmployeeDocuments,
} from '@features/account/employeeDocuments';

const formatShiftTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatRelativeDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const normalizeNamePart = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

const titleCaseName = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const getDashboardDisplayName = ({
  context,
  metadata,
  email,
}: {
  context?: { firstName: string | null; lastName: string | null } | null;
  metadata?: Record<string, unknown>;
  email?: string | null;
}) => {
  const contextName = [context?.firstName, context?.lastName]
    .map(normalizeNamePart)
    .filter(Boolean)
    .join(' ');
  if (contextName) return titleCaseName(contextName);

  const metadataFullName =
    normalizeNamePart(metadata?.full_name) ||
    normalizeNamePart(metadata?.fullName) ||
    normalizeNamePart(metadata?.name);
  if (metadataFullName) return titleCaseName(metadataFullName);

  const metadataName = [
    metadata?.firstName ?? metadata?.first_name,
    metadata?.lastName ?? metadata?.last_name,
  ]
    .map(normalizeNamePart)
    .filter(Boolean)
    .join(' ');
  if (metadataName) return titleCaseName(metadataName);

  const emailName = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return emailName ? titleCaseName(emailName) : 'Employee';
};

export default function HomeDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user, session } = useAuth();
  const { orderedShifts, isLoading, isUsingCachedShifts, cachedShiftsAt } = useShiftFeed();
  const { unreadCount } = useNotifications();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const employeeId = user?.id ?? '';
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
    ? (user.user_metadata as Record<string, unknown>)
    : undefined;
  const nextShift = useMemo(() => {
    const now = Date.now();
    return (
      orderedShifts.find((shift) => {
        const end = new Date(shift.end).getTime();
        return Number.isFinite(end) && end >= now;
      }) ?? orderedShifts[0]
    );
  }, [orderedShifts]);
  const activeShift = useMemo(
    () => orderedShifts.find((shift) => getShiftPhase(shift.start, shift.end) === 'live') ?? null,
    [orderedShifts]
  );

  const { data: vacationContext } = useQuery({
    queryKey: ['homeVacationContext', employeeId],
    queryFn: () => fetchVacationRequestContext(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['homeVacationRequests', employeeId],
    queryFn: () => fetchVacationRequests(employeeId),
    enabled: Boolean(employeeId && vacationContext?.companyId),
    staleTime: 60 * 1000,
  });

  const { data: employeeDocuments = [] } = useQuery({
    queryKey: ['homeEmployeeDocuments', employeeId, session?.access_token],
    queryFn: () =>
      fetchEmployeeDocuments({
        employeeId,
        accessToken: session?.access_token ?? '',
      }),
    enabled: Boolean(employeeId && session?.access_token),
    staleTime: 60 * 1000,
  });

  const pendingVacationCount = vacationRequests.filter((request) => request.status === 'pending').length;
  const latestDocument = employeeDocuments[0] ?? null;
  const displayName = getDashboardDisplayName({
    context: vacationContext,
    metadata,
    email: user?.email,
  });
  const quickActions = [
    {
      key: 'clock',
      title: activeShift ? t('dashboardClockOutAction') : t('dashboardClockInAction'),
      icon: 'qr-code-outline',
      path: '/qr-clock-in',
    },
    { key: 'shifts', title: t('dashboardViewShiftsAction'), icon: 'list-outline', path: '/my-shifts' },
    { key: 'calendar', title: t('dashboardOpenCalendarAction'), icon: 'calendar-outline', path: '/calendar' },
    { key: 'documents', title: t('dashboardUploadDocumentAction'), icon: 'document-attach-outline', path: '/employee-documents' },
    { key: 'vacation', title: t('dashboardRequestVacationAction'), icon: 'airplane-outline', path: '/vacation-requests' },
    { key: 'support', title: t('dashboardContactSupportAction'), icon: 'help-circle-outline', path: '/support' },
  ] as const;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: layoutTokens.screenTop,
            paddingBottom: insets.bottom + 28,
            paddingHorizontal: isTablet ? 28 : layoutTokens.screenHorizontal,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { borderColor: theme.borderSoft }]}>
          <LinearGradient
            colors={[theme.heroGradientStart, theme.heroGradientEnd]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.eyebrow}>{t('dashboardEyebrow')}</Text>
          <Text style={styles.title}>{t('dashboardTitle', { name: displayName })}</Text>
          <Text style={styles.subtitle}>{t('dashboardSubtitle')}</Text>
        </View>

        {isUsingCachedShifts ? (
          <View style={[styles.notice, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
            <Ionicons name="cloud-offline-outline" size={15} color={theme.caution} />
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
              {t('shiftCacheShowingCached', {
                time: cachedShiftsAt
                  ? new Date(cachedShiftsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : t('notProvided'),
              })}
            </Text>
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('dashboardNextShiftTitle')}</Text>
            {isLoading ? <ActivityIndicator color={theme.primary} /> : null}
          </View>
          {nextShift ? (
            <Pressable
              style={[styles.nextShiftRow, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
              onPress={() => router.push(`/shift-details/${nextShift.id}`)}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surface }]}>
                <Ionicons name="calendar-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {nextShift.title}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {formatShiftTime(nextShift.start)}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {nextShift.objectName ?? nextShift.location}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{t('dashboardNoShiftTitle')}</Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{t('dashboardNoShiftBody')}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Ionicons name={activeShift ? 'radio-button-on' : 'radio-button-off'} size={18} color={activeShift ? theme.success : theme.textSecondary} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              {activeShift ? t('dashboardClockedIn') : t('dashboardClockedOut')}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('dashboardClockStatus')}</Text>
          </View>
          <Pressable
            style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={18} color={theme.primary} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{unreadCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('dashboardUnreadNotifications')}</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={() => router.push('/vacation-requests')}
          >
            <Ionicons name="airplane-outline" size={18} color={theme.primary} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{pendingVacationCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('dashboardPendingVacation')}</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={() => router.push('/employee-documents')}
          >
            <Ionicons name="document-text-outline" size={18} color={theme.primary} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]} numberOfLines={1}>
              {latestDocument ? formatRelativeDate(latestDocument.createdAt) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('dashboardLatestDocument')}</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('dashboardQuickActionsTitle')}</Text>
          <View style={styles.actionGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                style={[styles.actionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
                onPress={() => router.push(action.path)}
              >
                <Ionicons name={action.icon as any} size={18} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.textPrimary }]}>{action.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <PrimaryButton
          title={activeShift ? t('dashboardClockOutAction') : t('dashboardClockInAction')}
          onPress={() => router.push('/qr-clock-in')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    gap: 14,
  },
  hero: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: '#fff',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    marginTop: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  nextShiftRow: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  itemMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyState: {
    paddingVertical: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48.5%',
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  actionButton: {
    width: '48.5%',
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    gap: 7,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
