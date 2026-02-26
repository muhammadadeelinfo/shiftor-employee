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
import { useLanguage } from '@shared/context/LanguageContext';
import {
  checkNotificationsTableHealth,
  getRuntimeConfigIssues,
  shouldRunNotificationsTableHealthCheck,
} from '@shared/utils/runtimeHealth';
import { openAddressInMaps } from '@shared/utils/maps';

type StartupJob = {
  id: string;
  companyId: string;
  companyName?: string | null;
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

const isLocalhostHost = (host: string): boolean => {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

const extractHostFromHostUri = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//i, '');
  const [host] = withoutProtocol.split('/');
  if (!host) return null;
  return host.split(':')[0] ?? null;
};

const resolveExpoDevHost = (): string | null => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra
      ?.expoGo?.debuggerHost,
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
  ];

  for (const candidate of candidates) {
    const host = extractHostFromHostUri(candidate);
    if (host && !isLocalhostHost(host)) {
      return host;
    }
  }

  return null;
};

const resolveApiOriginForDevice = (value: string): string => {
  if (Platform.OS === 'web') {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (!isLocalhostHost(parsed.hostname)) {
      return value;
    }

    const resolvedHost = resolveExpoDevHost();
    if (!resolvedHost) {
      return value;
    }

    parsed.hostname = resolvedHost;
    return parsed.origin;
  } catch {
    return value;
  }
};

const getApiOrigin = (): string | null => {
  const explicitBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  if (explicitBaseUrl) {
    return resolveApiOriginForDevice(explicitBaseUrl.replace(/\/+$/, ''));
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

const normalizeForSearch = (value?: string | null): string => {
  if (!value) return '';
  return value
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const tokenizeText = (value: string): string[] =>
  normalizeForSearch(value)
    .split(/[^a-z0-9]+/)
    .map((term) => term.trim())
    .filter(Boolean);

type SearchField = 'title' | 'location' | 'employmentType' | 'company' | 'salary' | 'content';

type ParsedSearch = {
  genericTerms: string[];
  fieldTerms: Record<SearchField, string[]>;
};

const SEARCH_FIELD_ALIASES: Record<string, SearchField> = {
  title: 'title',
  role: 'title',
  position: 'title',
  job: 'title',
  location: 'location',
  loc: 'location',
  city: 'location',
  where: 'location',
  type: 'employmentType',
  employment: 'employmentType',
  employmenttype: 'employmentType',
  company: 'company',
  employer: 'company',
  org: 'company',
  salary: 'salary',
  pay: 'salary',
  compensation: 'salary',
};

const parseSearchQuery = (query: string): ParsedSearch => {
  const parsed: ParsedSearch = {
    genericTerms: [],
    fieldTerms: {
      title: [],
      location: [],
      employmentType: [],
      company: [],
      salary: [],
      content: [],
    },
  };

  let remainingQuery = query;
  const quotedFieldRegex = /(\w+):"([^"]+)"/g;
  let quotedMatch: RegExpExecArray | null;
  while ((quotedMatch = quotedFieldRegex.exec(query)) !== null) {
    const key = normalizeForSearch(quotedMatch[1]);
    const value = normalizeForSearch(quotedMatch[2]);
    const field = SEARCH_FIELD_ALIASES[key];
    if (field && value) {
      parsed.fieldTerms[field].push(value);
    }
  }
  remainingQuery = remainingQuery.replace(quotedFieldRegex, ' ');

  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(remainingQuery)) !== null) {
    const token = (match[1] ?? match[2] ?? '').trim();
    if (!token) continue;

    const separatorIndex = token.indexOf(':');
    if (separatorIndex > 0) {
      const key = normalizeForSearch(token.slice(0, separatorIndex));
      const rawValue = token.slice(separatorIndex + 1);
      const value = normalizeForSearch(rawValue);
      const field = SEARCH_FIELD_ALIASES[key];
      if (field && value) {
        parsed.fieldTerms[field].push(value);
        continue;
      }
    }

    const normalized = normalizeForSearch(token);
    if (normalized) {
      parsed.genericTerms.push(normalized);
    }
  }

  return parsed;
};

const extractCompanyDomain = (value?: string | null): string => {
  if (!value) return '';
  const resolved = resolveCtaUrl(value);
  if (!resolved) return '';
  try {
    const hostname = new URL(resolved).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1).fill(0).map((_, index) => index);
  const curr = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
};

const typoThreshold = (term: string): number => {
  if (term.length >= 8) return 2;
  if (term.length >= 5) return 1;
  return 0;
};

const matchTermQuality = (term: string, fieldText: string, fieldTokens: string[]): number => {
  if (!term) return 0;
  if (fieldText.includes(term)) {
    return term.includes(' ') ? 3 : 4;
  }

  if (term.includes(' ')) return 0;

  for (const token of fieldTokens) {
    if (!token) continue;
    if (token.startsWith(term)) return 3;
    if (token.includes(term)) return 2;
    const threshold = typoThreshold(term);
    if (
      threshold > 0 &&
      Math.abs(token.length - term.length) <= threshold &&
      token[0] === term[0] &&
      levenshteinDistance(token, term) <= threshold
    ) {
      return 1;
    }
  }

  return 0;
};

const buildSearchFields = (job: StartupJob): Record<SearchField, string> => {
  const companyDomain = extractCompanyDomain(job.ctaUrl);
  return {
    title: normalizeForSearch(job.title),
    location: normalizeForSearch(job.location),
    employmentType: normalizeForSearch(job.employmentType),
    company: normalizeForSearch([job.companyName, job.companyId, companyDomain].filter(Boolean).join(' ')),
    salary: normalizeForSearch(job.salaryText),
    content: normalizeForSearch([job.summary, job.description, job.ctaLabel].filter(Boolean).join(' ')),
  };
};

const calculateAdvancedSearchScore = (job: StartupJob, parsed: ParsedSearch): number => {
  const fields = buildSearchFields(job);
  const tokensByField: Record<SearchField, string[]> = {
    title: tokenizeText(fields.title),
    location: tokenizeText(fields.location),
    employmentType: tokenizeText(fields.employmentType),
    company: tokenizeText(fields.company),
    salary: tokenizeText(fields.salary),
    content: tokenizeText(fields.content),
  };

  const weightByField: Record<SearchField, number> = {
    title: 6,
    location: 5,
    employmentType: 5,
    company: 4,
    salary: 3,
    content: 2,
  };

  let score = 0;

  for (const [field, terms] of Object.entries(parsed.fieldTerms) as [SearchField, string[]][]) {
    for (const term of terms) {
      const quality = matchTermQuality(term, fields[field], tokensByField[field]);
      if (quality <= 0) return -1;
      score += quality * (weightByField[field] + 2);
    }
  }

  for (const term of parsed.genericTerms) {
    let bestQuality = 0;
    let bestWeight = 0;
    for (const field of Object.keys(fields) as SearchField[]) {
      const quality = matchTermQuality(term, fields[field], tokensByField[field]);
      if (quality > bestQuality) {
        bestQuality = quality;
        bestWeight = weightByField[field];
      }
    }
    if (bestQuality <= 0) return -1;
    score += bestQuality * bestWeight;
  }

  return score;
};

const resolveCtaUrl = (rawUrl?: string | null): string | null => {
  if (!rawUrl) return null;
  const value = rawUrl.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  const origin = getApiOrigin();
  if (value.startsWith('/')) {
    if (!origin) return null;
    return `${origin}${value}`;
  }

  // If backend sends a host/path without scheme, default to https.
  return `https://${value}`;
};

export default function StartupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { session, loading: authLoading } = useAuth();

  const [jobs, setJobs] = useState<StartupJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [refreshingJobs, setRefreshingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [runtimeIssues, setRuntimeIssues] = useState<string[]>([]);
  const [runningHealthChecks, setRunningHealthChecks] = useState(true);

  const fetchStartupJobs = useCallback(
    async ({ asRefresh = false }: { asRefresh?: boolean } = {}) => {
      if (authLoading) {
        return;
      }

      const accessToken = session?.access_token;

      const url = jobsEndpointUrl();
      if (!url) {
        setJobs([]);
        setJobsError(t('startupJobsMissingApiBaseUrl'));
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
          if (
            response.status === 401 ||
            responseText.toLowerCase().includes('missing access token')
          ) {
            throw new Error(t('startupJobsMissingAccessToken'));
          }
          throw new Error(t('startupJobsLoadFailed'));
        }

        const payload = (await response.json()) as StartupJobsResponse;
        setJobs(normalizeStartupJobs(payload));
        setJobsError(null);
      } catch (error) {
        setJobs([]);
        setJobsError(error instanceof Error ? error.message : t('startupJobsLoadFailed'));
      } finally {
        setLoadingJobs(false);
        setRefreshingJobs(false);
      }
    },
    [authLoading, session?.access_token, t]
  );

  useEffect(() => {
    fetchStartupJobs();
  }, [fetchStartupJobs]);

  useEffect(() => {
    let mounted = true;
    setRunningHealthChecks(true);

    (async () => {
      const configIssues = getRuntimeConfigIssues();
      const issues = [...configIssues];

      if (configIssues.length === 0 && shouldRunNotificationsTableHealthCheck()) {
        const notificationsCheck = await checkNotificationsTableHealth();
        if (!notificationsCheck.ok && notificationsCheck.issue) {
          issues.push(notificationsCheck.issue);
        }
      }

      if (mounted) {
        setRuntimeIssues(issues);
        setRunningHealthChecks(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
    const parsed = parseSearchQuery(searchQuery);
    const hasTerms =
      parsed.genericTerms.length ||
      Object.values(parsed.fieldTerms).some((terms) => terms.length > 0);
    if (!hasTerms) return jobs;

    return jobs
      .map((job, index) => ({ job, index, score: calculateAdvancedSearchScore(job, parsed) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.job);
  }, [jobs, searchQuery]);

  const shownCount = filteredJobs.length;

  const openJobLink = async (url?: string | null) => {
    const resolvedUrl = resolveCtaUrl(url);
    if (!resolvedUrl) {
      setJobsError(t('startupJobsOpenLinkFailed'));
      return;
    }

    try {
      const supported = await Linking.canOpenURL(resolvedUrl);
      if (!supported) {
        throw new Error('Unsupported URL');
      }
      await Linking.openURL(resolvedUrl);
    } catch {
      setJobsError(t('startupJobsOpenLinkFailed'));
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
        <View style={[styles.orb, styles.orbBottom, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]} />
      </View>

      <View style={styles.content}>
        <LinearGradient
          colors={[theme.heroGradientStart, theme.heroGradientEnd]}
          start={[0, 0]}
          end={[1, 1]}
          style={[styles.heroCard, { borderColor: theme.border }]}
        >
          <View style={styles.heroTopActions}>
            <View style={styles.heroTitleWrap}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>{t('startupJobsTitle')}</Text>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>{t('welcomePublicNote')}</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Ionicons name="briefcase-outline" size={14} color={theme.primary} />
              <Text style={[styles.statText, { color: theme.textPrimary }]}>
                {t('startupJobsCount', { count: jobs.length })}
              </Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Ionicons name="eye-outline" size={14} color={theme.primaryAccent} />
              <Text style={[styles.statText, { color: theme.textPrimary }]}>
                {t('startupJobsShownCount', { count: shownCount })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {runningHealthChecks ? (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>
              {t('startupHealthChecksRunning')}
            </Text>
          </View>
        ) : null}

        {!runningHealthChecks && runtimeIssues.length > 0 ? (
          <View
            style={[
              styles.statusCard,
              styles.healthCard,
              { backgroundColor: theme.surface, borderColor: theme.fail },
            ]}
          >
            <View style={styles.healthHeaderRow}>
              <Ionicons name="warning-outline" size={18} color={theme.fail} />
              <Text style={[styles.errorText, { color: theme.fail }]}>{t('startupHealthChecksIssues')}</Text>
            </View>
            {runtimeIssues.map((issue) => (
              <Text key={issue} style={[styles.healthIssueText, { color: theme.fail }]}>
                - {issue}
              </Text>
            ))}
          </View>
        ) : null}

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
                placeholder={t('startupJobsSearchPlaceholder')}
                placeholderTextColor={theme.textPlaceholder}
                style={[styles.searchInput, { color: theme.textPrimary }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.trim() ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel={t('startupJobsClearSearch')}
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
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>{t('startupJobsLoading')}</Text>
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
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>{t('startupJobsNoMatches')}</Text>
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
                        <TouchableOpacity
                          onPress={() => openAddressInMaps(job.location)}
                          accessibilityRole="button"
                          accessibilityLabel={t('openInMaps')}
                          style={[
                            styles.metaMapButton,
                            {
                              backgroundColor: theme.surface,
                              borderColor: theme.borderSoft,
                            },
                          ]}
                        >
                          <Ionicons name="map-outline" size={14} color={theme.info} />
                        </TouchableOpacity>
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
                      <Text style={styles.applyButtonText}>{job.ctaLabel?.trim() || t('startupJobsApplyNow')}</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          : null}

        {shouldShowJobsSection ? (
          <LinearGradient
            colors={[theme.heroGradientEnd, theme.heroGradientStart]}
            start={[0, 0]}
            end={[1, 1]}
            style={[styles.authNextStepCard, { borderColor: theme.border }]}
          >
            <Text style={[styles.authNextStepTitle, { color: theme.textPrimary }]}>
              {t('startupJobsReadyTitle')}
            </Text>
            <Text style={[styles.authNextStepSubtitle, { color: theme.textSecondary }]}>
              {t('startupJobsReadySubtitle')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/login')}
              activeOpacity={0.85}
              style={[
                styles.authNextStepButton,
                { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            >
              <Text style={styles.authNextStepButtonText}>{t('welcomeAuthCta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/login?mode=signup')} activeOpacity={0.72}>
              <Text style={[styles.authNextStepLink, { color: theme.textSecondary }]}>
                {t('startupJobsGoToSignup')}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        ) : null}
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
    alignItems: 'center',
  },
  heroTitleWrap: {
    flexShrink: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
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
  healthCard: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  healthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  healthIssueText: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 6,
    marginBottom: 2,
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
  metaMapButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
  authNextStepCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  authNextStepTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  authNextStepSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  authNextStepButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authNextStepButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  authNextStepLink: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
});
