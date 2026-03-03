import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { openAddressInMaps } from '@shared/utils/maps';
import { useAuth } from '@hooks/useSupabaseAuth';
import {
  buildStartupJobsEndpoint,
  deserializeStartupJob,
  normalizeStartupJobs,
  resolveStartupJobCtaUrl,
  type StartupJob,
  type StartupJobsResponse,
} from '@features/jobs/startupJobs';

const JOB_DETAILS_FETCH_LIMIT = 50;

export default function JobDetailsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ jobId?: string; payload?: string }>();
  const initialJob = useMemo(() => deserializeStartupJob(params.payload), [params.payload]);
  const requestedJobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const [job, setJob] = useState<StartupJob | null>(initialJob);
  const [isLoading, setIsLoading] = useState(!initialJob && !!requestedJobId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadJob = useCallback(
    async ({ asRefresh = false }: { asRefresh?: boolean } = {}) => {
      if (!requestedJobId) {
        setJob(initialJob);
        setIsLoading(false);
        setLoadError(t('startupJobDetailsMissingBody'));
        return;
      }

      const url = buildStartupJobsEndpoint({
        jobId: requestedJobId,
        limit: JOB_DETAILS_FETCH_LIMIT,
      });

      if (!url) {
        setJob(initialJob);
        setLoadError(t('startupJobsMissingApiBaseUrl'));
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (asRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          throw new Error(t('startupJobsLoadFailed'));
        }

        const payload = (await response.json()) as StartupJobsResponse;
        const nextJob =
          normalizeStartupJobs(payload).find((item) => item.id === requestedJobId) ?? null;

        setJob(nextJob ?? initialJob);
        setLoadError(nextJob ? null : t('startupJobDetailsMissingBody'));
      } catch (error) {
        setJob(initialJob);
        setLoadError(error instanceof Error ? error.message : t('startupJobsLoadFailed'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [initialJob, requestedJobId, session?.access_token, t]
  );

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const openJobLink = async () => {
    const resolvedUrl = resolveStartupJobCtaUrl(job?.ctaUrl);
    if (!resolvedUrl) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(resolvedUrl);
      if (!supported) {
        throw new Error('Unsupported URL');
      }
      await Linking.openURL(resolvedUrl);
    } catch {
      // Leave the user on the details page if the system cannot open the link.
      }
  };

  if (isLoading) {
    return (
      <View style={[styles.emptyRoot, { backgroundColor: theme.background, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity
          onPress={() => router.replace('/jobs')}
          activeOpacity={0.8}
          style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
          <Text style={[styles.backButtonText, { color: theme.textPrimary }]}>{t('startupJobDetailsBack')}</Text>
        </TouchableOpacity>
        <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.messageBody, { color: theme.textSecondary }]}>{t('startupJobDetailsLoading')}</Text>
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.emptyRoot, { backgroundColor: theme.background, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity
          onPress={() => router.replace('/jobs')}
          activeOpacity={0.8}
          style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
          <Text style={[styles.backButtonText, { color: theme.textPrimary }]}>{t('startupJobDetailsBack')}</Text>
        </TouchableOpacity>
        <View style={[styles.messageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.messageTitle, { color: theme.textPrimary }]}>{t('startupJobDetailsMissingTitle')}</Text>
          <Text style={[styles.messageBody, { color: theme.textSecondary }]}>
            {loadError || t('startupJobDetailsMissingBody')}
          </Text>
          <TouchableOpacity
            onPress={() => loadJob()}
            activeOpacity={0.85}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.retryButtonText}>{t('startupJobDetailsRetry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadJob({ asRefresh: true })}
          tintColor={theme.primary}
        />
      }
    >
      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.8}
        style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
        <Text style={[styles.backButtonText, { color: theme.textPrimary }]}>{t('startupJobDetailsBack')}</Text>
      </TouchableOpacity>

      <LinearGradient
        colors={[theme.heroGradientStart, theme.heroGradientEnd]}
        start={[0, 0]}
        end={[1, 1]}
        style={[styles.heroCard, { borderColor: theme.border }]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{job.title}</Text>
        {job.companyName ? (
          <Text style={[styles.companyName, { color: theme.textSecondary }]}>{job.companyName}</Text>
        ) : null}
        {job.summary ? (
          <Text style={[styles.summary, { color: theme.textPrimary }]}>{job.summary}</Text>
        ) : null}

        <View style={styles.metaWrap}>
          {job.location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>{job.location}</Text>
              <TouchableOpacity
                onPress={() => openAddressInMaps(job.location)}
                accessibilityRole="button"
                accessibilityLabel={t('openInMaps')}
                style={[styles.metaMapButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
              >
                <Ionicons name="map-outline" size={14} color={theme.info} />
              </TouchableOpacity>
            </View>
          ) : null}
          {job.employmentType ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>{job.employmentType}</Text>
            </View>
          ) : null}
          {job.salaryText ? (
            <View style={styles.metaRow}>
              <Ionicons name="cash-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>{job.salaryText}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('startupJobDetailsOverview')}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {job.description?.trim() || job.summary?.trim() || t('startupJobDetailsNoDescription')}
        </Text>
      </View>

      {loadError ? (
        <View style={[styles.inlineNotice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={[styles.inlineNoticeText, { color: theme.textSecondary }]}>
            {t('startupJobDetailsShowingCached')}
          </Text>
        </View>
      ) : null}

      {job.ctaUrl ? (
        <TouchableOpacity
          onPress={openJobLink}
          activeOpacity={0.85}
          style={[styles.applyButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.applyButtonText}>{job.ctaLabel?.trim() || t('startupJobsApplyNow')}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyRoot: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  companyName: {
    fontSize: 14,
    fontWeight: '700',
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  metaWrap: {
    gap: 8,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    flex: 1,
  },
  metaMapButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  loadingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  inlineNotice: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineNoticeText: {
    fontSize: 13,
    flex: 1,
  },
  applyButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
