import { useCallback, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ActivityIndicator,
  Alert,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NativeModulesProxy } from 'expo-modules-core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { openAddressInMaps } from '@shared/utils/maps';
import { useAuth } from '@hooks/useSupabaseAuth';
import {
  buildStartupJobApplyEndpoint,
  buildStartupJobsEndpoint,
  deserializeStartupJob,
  normalizeStartupJobs,
  resolveStartupJobCtaUrl,
  type StartupJob,
  type StartupJobsResponse,
} from '@features/jobs/startupJobs';

const JOB_DETAILS_FETCH_LIMIT = 50;

const extractDomainLabel = (value?: string | null): string | null => {
  const resolvedUrl = resolveStartupJobCtaUrl(value);
  if (!resolvedUrl) return null;

  try {
    return new URL(resolvedUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

const buildDescriptionSections = (job: StartupJob | null, fallbackText: string): string[] => {
  const source = job?.description?.trim() || job?.summary?.trim() || fallbackText;
  return source
    .split(/\n\s*\n/g)
    .map((section) => section.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const buildJobTranslationUrl = (job: StartupJob | null, targetLanguage: 'en' | 'de'): string | null => {
  if (!job) return null;

  const text = [job.title, job.summary, job.description]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)
    .join('\n\n')
    .trim();

  if (!text) {
    return null;
  }

  const url = new URL('https://translate.google.com/');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', targetLanguage);
  url.searchParams.set('text', text);
  url.searchParams.set('op', 'translate');
  return url.toString();
};

const getDocumentPickerModule = (): typeof import('expo-document-picker') | null => {
  if (!NativeModulesProxy.ExpoDocumentPicker) {
    return null;
  }

  try {
    return require('expo-document-picker') as typeof import('expo-document-picker');
  } catch {
    return null;
  }
};

export default function JobDetailsScreen() {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const router = useRouter();
  const isIOS = Platform.OS === 'ios';
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ jobId?: string; payload?: string }>();
  const topContentPadding = 12;
  const initialJob = useMemo(() => deserializeStartupJob(params.payload), [params.payload]);
  const requestedJobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const [job, setJob] = useState<StartupJob | null>(initialJob);
  const [isLoading, setIsLoading] = useState(!initialJob && !!requestedJobId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [selectedCv, setSelectedCv] = useState<{
    fileName: string;
    contentType: string;
    sizeBytes: number;
    base64Content: string;
  } | null>(null);
  const companyDomain = useMemo(() => extractDomainLabel(job?.ctaUrl), [job?.ctaUrl]);
  const publishedLabel = useMemo(
    () =>
      job?.publishAt
        ? new Date(job.publishAt).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : null,
    [job?.publishAt]
  );
  const expiresLabel = useMemo(
    () =>
      job?.expiresAt
        ? new Date(job.expiresAt).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : null,
    [job?.expiresAt]
  );
  const detailSections = useMemo(
    () => buildDescriptionSections(job, t('startupJobDetailsNoDescription')),
    [job, t]
  );
  const factRows = useMemo(
    () =>
      [
        job?.location
          ? {
              icon: 'location-outline' as const,
              label: t('startupJobDetailsLocation'),
              value: job.location,
            }
          : null,
        job?.employmentType
          ? {
              icon: 'time-outline' as const,
              label: t('startupJobDetailsEmploymentType'),
              value: job.employmentType,
            }
          : null,
        job?.salaryText
          ? {
              icon: 'cash-outline' as const,
              label: t('startupJobDetailsSalary'),
              value: job.salaryText,
            }
          : null,
      ].filter(Boolean) as Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }>,
    [job?.employmentType, job?.location, job?.salaryText, t]
  );

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

  useEffect(() => {
    const metadata = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const first =
      (typeof metadata.firstName === 'string' && metadata.firstName) ||
      (typeof metadata.first_name === 'string' && metadata.first_name) ||
      '';
    const last =
      (typeof metadata.lastName === 'string' && metadata.lastName) ||
      (typeof metadata.last_name === 'string' && metadata.last_name) ||
      '';

    setFirstName((prev) => prev || first);
    setLastName((prev) => prev || last);
    setEmail((prev) => prev || session?.user?.email || '');
  }, [session?.user?.email, session?.user?.user_metadata]);

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

  const openTranslatedJob = useCallback(async () => {
    const translationUrl = buildJobTranslationUrl(job, language);
    if (!translationUrl) {
      Alert.alert(t('startupJobDetailsTranslate'), t('startupJobDetailsTranslateFailed'));
      return;
    }

    try {
      const supported = await Linking.canOpenURL(translationUrl);
      if (!supported) {
        throw new Error('Unsupported URL');
      }
      await Linking.openURL(translationUrl);
    } catch {
      Alert.alert(t('startupJobDetailsTranslate'), t('startupJobDetailsTranslateFailed'));
    }
  }, [job, language, t]);

  const pickCv = useCallback(async () => {
    try {
      const documentPicker = getDocumentPickerModule();
      if (!documentPicker) {
        Alert.alert(t('startupJobDetailsApplication'), t('startupJobDetailsApplyFailed'));
        return;
      }

      const result = await documentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const base64Content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const sizeBytes = asset.size || Math.floor((base64Content.length * 3) / 4);

      if (sizeBytes > 5 * 1024 * 1024) {
        Alert.alert(t('startupJobDetailsApplication'), t('startupJobDetailsCvTooLarge'));
        return;
      }

      setSelectedCv({
        fileName: asset.name || 'cv',
        contentType: asset.mimeType || 'application/octet-stream',
        sizeBytes,
        base64Content,
      });
    } catch {
      Alert.alert(t('startupJobDetailsApplication'), t('startupJobDetailsApplyFailed'));
    }
  }, [t]);

  const submitApplication = useCallback(async () => {
    if (!job) {
      return;
    }

    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();
    const nextEmail = email.trim().toLowerCase();

    if (!nextFirstName || !nextLastName || !nextEmail) {
      Alert.alert(t('startupJobDetailsApplication'), t('startupJobDetailsApplyMissingFields'));
      return;
    }

    const endpoint = buildStartupJobApplyEndpoint();
    if (!endpoint) {
      Alert.alert(t('startupJobDetailsApplication'), t('startupJobsMissingApiBaseUrl'));
      return;
    }

    setIsSubmittingApplication(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jobId: job.id,
          firstName: nextFirstName,
          lastName: nextLastName,
          email: nextEmail,
          mobile: mobile.trim() || undefined,
          message: message.trim() || undefined,
          cv: selectedCv || undefined,
        }),
      });

      const responseText = await response.text();
      let payload: { message?: string; error?: string } = {};

      if (responseText.trim()) {
        try {
          payload = JSON.parse(responseText) as { message?: string; error?: string };
        } catch {
          payload = {};
        }
      }

      if (!response.ok) {
        const normalizedResponseText = responseText.trim();
        const fallbackDetail = normalizedResponseText
          ? normalizedResponseText.replace(/\s+/g, ' ').slice(0, 180)
          : null;

        console.warn('Job application request failed.', {
          endpoint,
          status: response.status,
          body: fallbackDetail,
        });

        if (response.status === 405 && !isIOS) {
          const fallbackUrl = resolveStartupJobCtaUrl(job.ctaUrl);

          if (fallbackUrl) {
            Alert.alert(
              t('startupJobDetailsApplication'),
              t('startupJobDetailsApplyFallbackExternal'),
              [
                { text: t('commonCancel'), style: 'cancel' },
                {
                  text: t('startupJobDetailsOpenExternalApply'),
                  onPress: () => {
                    void openJobLink();
                  },
                },
              ]
            );
            return;
          }
        }

        throw new Error(
          payload.error ||
            (fallbackDetail
              ? `${t('startupJobDetailsApplyFailed')} (${response.status}): ${fallbackDetail}`
              : `${t('startupJobDetailsApplyFailed')} (${response.status})`)
        );
      }

      Alert.alert(t('startupJobDetailsApplication'), payload.message || t('startupJobDetailsApplySuccess'));
      setMessage('');
      setSelectedCv(null);
    } catch (error) {
      Alert.alert(
        t('startupJobDetailsApplication'),
        error instanceof Error ? error.message : t('startupJobDetailsApplyFailed')
      );
    } finally {
      setIsSubmittingApplication(false);
    }
  }, [email, firstName, job, message, mobile, selectedCv, session?.access_token, t, lastName, isIOS]);

  if (isLoading) {
    return (
      <View style={[styles.emptyRoot, { backgroundColor: theme.background, paddingTop: topContentPadding }]}>
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
      <View style={[styles.emptyRoot, { backgroundColor: theme.background, paddingTop: topContentPadding }]}>
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
        {
          backgroundColor: theme.background,
          paddingTop: topContentPadding,
          paddingBottom: insets.bottom + 32,
        },
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
        <View style={styles.heroBadgeRow}>
          {job.companyName ? (
            <View style={[styles.heroBadge, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Text style={[styles.heroBadgeText, { color: theme.textSecondary }]}>{job.companyName}</Text>
            </View>
          ) : null}
          {job.isActive ? (
            <View style={[styles.heroBadge, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Text style={[styles.heroBadgeText, { color: theme.textSecondary }]}>{t('startupJobDetailsActive')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{job.title}</Text>
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

      {factRows.length ? (
        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('startupJobDetailsAtGlance')}</Text>
          <View style={styles.factGrid}>
            {factRows.map((item) => (
              <View
                key={`${item.label}-${item.value}`}
                style={[styles.factCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
              >
                <View style={styles.factHeader}>
                  <Ionicons name={item.icon} size={16} color={theme.textSecondary} />
                  <Text style={[styles.factLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
                <Text style={[styles.factValue, { color: theme.textPrimary }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {publishedLabel || expiresLabel ? (
        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('startupJobDetailsTimeline')}</Text>
          {publishedLabel ? (
            <View style={styles.timelineRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                {t('startupJobDetailsPublished')}
              </Text>
              <Text style={[styles.timelineValue, { color: theme.textPrimary }]}>{publishedLabel}</Text>
            </View>
          ) : null}
          {expiresLabel ? (
            <View style={styles.timelineRow}>
              <Ionicons name="hourglass-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                {t('startupJobDetailsCloses')}
              </Text>
              <Text style={[styles.timelineValue, { color: theme.textPrimary }]}>{expiresLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {job.companyName || companyDomain ? (
        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('startupJobDetailsCompany')}</Text>
          {job.companyName ? (
            <Text style={[styles.companyName, { color: theme.textPrimary }]}>{job.companyName}</Text>
          ) : null}
          {companyDomain ? (
            <View style={styles.companyMetaRow}>
              <Ionicons name="globe-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.companyMetaText, { color: theme.textSecondary }]}>{companyDomain}</Text>
            </View>
          ) : null}
          {!isIOS && job.ctaUrl ? (
            <TouchableOpacity
              onPress={openJobLink}
              activeOpacity={0.85}
              style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>
                {t('startupJobDetailsVisitCompany')}
              </Text>
              <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('startupJobDetailsOverview')}</Text>
        <View style={styles.descriptionWrap}>
          {detailSections.map((section, index) => (
            <Text key={`${index}-${section.slice(0, 24)}`} style={[styles.description, { color: theme.textSecondary }]}>
              {section}
            </Text>
          ))}
        </View>
        <Text style={[styles.translateHint, { color: theme.textSecondary }]}>
          {t('startupJobDetailsTranslateHint')}
        </Text>
        <TouchableOpacity
          onPress={openTranslatedJob}
          activeOpacity={0.85}
          style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>
            {t('startupJobDetailsTranslate')}
          </Text>
          <Ionicons name="language-outline" size={16} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {loadError ? (
        <View style={[styles.inlineNotice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={[styles.inlineNoticeText, { color: theme.textSecondary }]}>
            {t('startupJobDetailsShowingCached')}
          </Text>
        </View>
      ) : null}

      <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('startupJobDetailsApplication')}</Text>
        <Text style={[styles.applyHint, { color: theme.textSecondary }]}>{t('startupJobDetailsApplyHint')}</Text>
        <Text style={[styles.translateHint, { color: theme.textSecondary }]}>{t('startupJobDetailsApplyIntro')}</Text>

        <View style={styles.applyForm}>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('startupJobDetailsFirstName')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          />
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('startupJobDetailsLastName')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('startupJobDetailsEmail')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          />
          <TextInput
            value={mobile}
            onChangeText={setMobile}
            placeholder={t('startupJobDetailsMobile')}
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('startupJobDetailsMessage')}
            placeholderTextColor={theme.textSecondary}
            multiline
            textAlignVertical="top"
            style={[
              styles.input,
              styles.messageInput,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary },
            ]}
          />
          <TouchableOpacity
            onPress={pickCv}
            activeOpacity={0.85}
            style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>
              {selectedCv
                ? t('startupJobDetailsCvAttached', { fileName: selectedCv.fileName })
                : t('startupJobDetailsAttachCv')}
            </Text>
            <Ionicons name="attach-outline" size={16} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={submitApplication}
            disabled={isSubmittingApplication}
            activeOpacity={0.85}
            style={[styles.applyButton, { backgroundColor: theme.primary, opacity: isSubmittingApplication ? 0.7 : 1 }]}
          >
            <Text style={styles.applyButtonText}>
              {isSubmittingApplication ? t('startupJobDetailsApplying') : t('startupJobDetailsSubmit')}
            </Text>
            <Ionicons name="send-outline" size={16} color="#fff" />
          </TouchableOpacity>
          {!isIOS && job.ctaUrl ? (
            <TouchableOpacity
              onPress={openJobLink}
              activeOpacity={0.85}
              style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>
                {t('startupJobDetailsVisitCompany')}
              </Text>
              <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
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
    marginBottom: 6,
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
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
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
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineLabel: {
    fontSize: 13,
    minWidth: 68,
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  factCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  factHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  factLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  factValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  companyName: {
    fontSize: 20,
    fontWeight: '900',
  },
  companyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyMetaText: {
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  descriptionWrap: {
    gap: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  translateHint: {
    fontSize: 13,
    lineHeight: 20,
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
    marginTop: 4,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyHint: {
    fontSize: 14,
    lineHeight: 21,
  },
  applyForm: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  messageInput: {
    minHeight: 110,
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
