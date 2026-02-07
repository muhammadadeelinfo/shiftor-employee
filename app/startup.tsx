import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@shared/themeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useAuth } from '@hooks/useSupabaseAuth';

type StartupJob = {
  id: string;
  companyId: string;
  title: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  employmentType: string | null;
  salaryText: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

type StartupJobsResponse = {
  jobs?: StartupJob[];
};

const STARTUP_JOBS_LIMIT = 3;
const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

const getApiOrigin = (): string | null => {
  const explicitBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  const redirectUrl = (Constants.expoConfig?.extra?.authRedirectUrl as string | undefined)?.trim();
  if (!redirectUrl) {
    return Platform.OS === 'web' ? '' : null;
  }

  try {
    const parsed = new URL(redirectUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // Ignore malformed URL and fallback below.
  }

  return Platform.OS === 'web' ? '' : null;
};

const jobsEndpointUrl = () => {
  const origin = getApiOrigin();
  if (origin === null) {
    return null;
  }
  return `${origin}/api/jobs/list?startup=true&limit=${STARTUP_JOBS_LIMIT}`;
};

const normalizeStartupJobs = (payload: StartupJobsResponse): StartupJob[] => {
  if (!Array.isArray(payload.jobs)) {
    return [];
  }
  return payload.jobs;
};

export default function StartupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { session, loading: authLoading } = useAuth();

  const [jobs, setJobs] = useState<StartupJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [refreshingJobs, setRefreshingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStartupJobs = useCallback(
    async ({ asRefresh = false }: { asRefresh?: boolean } = {}) => {
      if (authLoading) {
        return;
      }

      const accessToken = session?.access_token;

      const url = jobsEndpointUrl();
      if (!url) {
        setJobs([]);
        setJobsError('Missing API base URL. Set API_BASE_URL in environment.');
        setLoadingJobs(false);
        setRefreshingJobs(false);
        return;
      }

      if (asRefresh) {
        setRefreshingJobs(true);
      } else {
        setLoadingJobs(true);
      }

      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(responseText || `Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as StartupJobsResponse;
        setJobs(normalizeStartupJobs(payload));
        setJobsError(null);
      } catch (error) {
        setJobs([]);
        setJobsError(error instanceof Error ? error.message : 'Failed to load startup jobs.');
      } finally {
        setLoadingJobs(false);
        setRefreshingJobs(false);
      }
    },
    [authLoading, session?.access_token]
  );

  useEffect(() => {
    fetchStartupJobs();
  }, [fetchStartupJobs]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchStartupJobs({ asRefresh: true });
      }
    });

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        fetchStartupJobs({ asRefresh: true });
      }
    }, BACKGROUND_REFRESH_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [fetchStartupJobs]);

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return jobs;

    return jobs.filter((job) => {
      const fields = [job.title, job.summary, job.location, job.employmentType, job.salaryText];
      return fields.some((value) => (value ?? '').toLowerCase().includes(query));
    });
  }, [jobs, searchQuery]);

  const shownCount = filteredJobs.length;

  const openJobLink = async (url?: string | null) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      setJobsError('Unable to open the job link.');
    }
  };

  const shouldShowJobsSection = !loadingJobs && !jobsError && jobs.length > 0;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: 24 + insets.bottom, backgroundColor: theme.background },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshingJobs}
          onRefresh={() => fetchStartupJobs({ asRefresh: true })}
          tintColor={theme.primary}
        />
      }
    >
      <View pointerEvents="none" style={styles.bgOrbs}>
        <View style={[styles.orb, styles.orbTop, { backgroundColor: 'rgba(129, 140, 248, 0.16)' }]} />
        <View style={[styles.orb, styles.orbBottom, { backgroundColor: 'rgba(168, 85, 247, 0.14)' }]} />
      </View>

      <View style={styles.content}>
        <LinearGradient
          colors={[theme.heroGradientStart, theme.heroGradientEnd]}
          start={[0, 0]}
          end={[1, 1]}
          style={[styles.heroCard, { borderColor: theme.border }]}
        >
          <View style={styles.heroTopActions}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Jobs</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/login')}
              activeOpacity={0.85}
              style={[styles.loginIconButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              accessibilityRole="button"
              accessibilityLabel="Go to login"
            >
              <Ionicons name="log-in-outline" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Ionicons name="briefcase-outline" size={14} color={theme.primary} />
              <Text style={[styles.statText, { color: theme.textPrimary }]}>{jobs.length} jobs</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Ionicons name="eye-outline" size={14} color={theme.primaryAccent} />
              <Text style={[styles.statText, { color: theme.textPrimary }]}>{shownCount} shown</Text>
            </View>
          </View>
        </LinearGradient>

        {shouldShowJobsSection ? (
          <View style={[styles.searchPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View
              style={[
                styles.searchInputWrap,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSoft },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search jobs"
                placeholderTextColor={theme.textPlaceholder}
                style={[styles.searchInput, { color: theme.textPrimary }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.trim() ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {loadingJobs ? (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>Loading startup jobs...</Text>
          </View>
        ) : null}

        {!loadingJobs && jobsError ? (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Ionicons name="alert-circle-outline" size={18} color={theme.fail} />
            <Text style={[styles.errorText, { color: theme.fail }]}>{jobsError}</Text>
          </View>
        ) : null}

        {shouldShowJobsSection && filteredJobs.length === 0 ? (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>No matching jobs.</Text>
          </View>
        ) : null}

        {shouldShowJobsSection
          ? filteredJobs.map((job) => (
              <View key={job.id} style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={[styles.cardAccent, { backgroundColor: theme.primary }]} />
                <View style={styles.cardBodyWrap}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{job.title}</Text>
                  {job.summary ? (
                    <Text numberOfLines={2} style={[styles.cardSummary, { color: theme.textSecondary }]}>
                      {job.summary}
                    </Text>
                  ) : null}

                  <View style={styles.metaWrap}>
                    {job.location ? (
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{job.location}</Text>
                      </View>
                    ) : null}
                    {job.employmentType ? (
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{job.employmentType}</Text>
                      </View>
                    ) : null}
                    {job.salaryText ? (
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="cash-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{job.salaryText}</Text>
                      </View>
                    ) : null}
                  </View>

                  {job.ctaUrl ? (
                    <TouchableOpacity
                      onPress={() => openJobLink(job.ctaUrl)}
                      activeOpacity={0.85}
                      style={[styles.applyButton, { backgroundColor: theme.primary }]}
                    >
                      <Text style={styles.applyButtonText}>{job.ctaLabel?.trim() || 'Apply now'}</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    minHeight: '100%',
    position: 'relative',
  },
  content: {
    marginTop: 8,
  },
  bgOrbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -80,
    right: -40,
  },
  orbBottom: {
    width: 260,
    height: 260,
    bottom: -140,
    left: -80,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  heroTopActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loginIconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  statPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  searchInputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    fontSize: 14,
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 0,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  helperText: {
    fontSize: 14,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 0,
    marginBottom: 10,
    shadowColor: '#030819',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardBodyWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSummary: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  metaWrap: {
    gap: 6,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardBody: {
    fontSize: 14,
    flex: 1,
  },
  applyButton: {
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
