import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getShiftById } from '@features/shifts/shiftsService';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import type { Shift } from '@features/shifts/shiftsService';
import { useAuth } from '@hooks/useSupabaseAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getShiftPhase, phaseMeta, ShiftPhase } from '@shared/utils/shiftPhase';
import { useTheme } from '@shared/themeContext';
import { useLanguage, type TranslationKey } from '@shared/context/LanguageContext';
import { openAddressInMaps } from '@shared/utils/maps';

const statusStyles: Record<
  Shift['status'],
  {
    border: string;
    dot: string;
    text: string;
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
  }
> = {
  scheduled: {
    border: '#c7d2fe',
    dot: '#93c5fd',
    text: '#1d4ed8',
    labelKey: 'statusScheduled',
    descriptionKey: 'statusScheduledDescription',
  },
  'in-progress': {
    border: '#4ade80',
    dot: '#22c55e',
    text: '#059669',
    labelKey: 'statusInProgress',
    descriptionKey: 'statusInProgressDescription',
  },
  completed: {
    border: '#d1d5db',
    dot: '#6b7280',
    text: '#4b5563',
    labelKey: 'statusCompleted',
    descriptionKey: 'statusCompletedDescription',
  },
  blocked: {
    border: '#fca5a5',
    dot: '#dc2626',
    text: '#b91c1c',
    labelKey: 'statusBlocked',
    descriptionKey: 'statusBlockedDescription',
  },
};

const phaseTranslationKey: Record<ShiftPhase, TranslationKey> = {
  past: 'phasePast',
  live: 'phaseLive',
  upcoming: 'phaseUpcoming',
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const formatTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatDuration = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '—';
  }
  const minutes = Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const hoursText = hours ? `${hours}h ` : '';
  const minutesText = remainder ? `${remainder}m` : '';
  return `${hoursText}${minutesText}`.trim() || '—';
};

const formatCountdownLabel = (
  minutes: number,
  liveNowLabel: string,
  lessThanMinuteLabel: string
) => {
  if (minutes <= 0) {
    return liveNowLabel;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  return parts.length ? parts.join(' ') : lessThanMinuteLabel;
};

export default function ShiftDetailsScreen() {
  const { id } = useLocalSearchParams();
  const shiftId = Array.isArray(id) ? id[0] : id;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const { data: shift, isLoading, refetch } = useQuery({
    queryKey: ['shift', shiftId],
    queryFn: () => (shiftId ? getShiftById(shiftId) : Promise.resolve(undefined)),
    enabled: Boolean(shiftId),
  });
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { theme } = useTheme();

  if (!shiftId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{t('shiftDetailsMissingId')}</Text>
      </View>
    );
  }

  const cachedShift = shiftId
    ? queryClient
        .getQueryData<Shift[]>(['shifts', userId])
        ?.find((item) => item.id === shiftId)
    : undefined;
  const shiftToShow = shift ?? cachedShift;

  if (isLoading && !shiftToShow) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!shiftToShow) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{t('shiftNotFound')}</Text>
        <PrimaryButton title={t('retry')} onPress={() => refetch()} />
      </View>
    );
  }

  const status = statusStyles[shiftToShow.status] ?? statusStyles.scheduled;
  const locationLabel = shiftToShow.objectName ?? shiftToShow.location ?? t('locationTbd');
  const locationSubtext = shiftToShow.objectAddress ?? shiftToShow.location;
  const duration = formatDuration(shiftToShow.start, shiftToShow.end);
  const startLabel = formatTime(shiftToShow.start);
  const endLabel = formatTime(shiftToShow.end);
  const dateLabel = formatDate(shiftToShow.start);
  const description = shiftToShow.description?.trim();
  const statusLabel = t(status.labelKey);
  const statusDescription = t(status.descriptionKey);
  const now = new Date();
  const shiftStart = new Date(shiftToShow.start);
  const minutesUntilStart = Math.max(
    0,
    Math.round((shiftStart.getTime() - now.getTime()) / 60000)
  );
  const countdownLabel =
    minutesUntilStart <= 0
      ? t('liveNow')
      : formatCountdownLabel(minutesUntilStart, t('liveNow'), t('shiftCountdownLessThanMinute'));
  const opsContact = shiftToShow.objectContactName ?? shiftToShow.objectName ?? t('shiftOpsTeam');
  const contactEmail = shiftToShow.objectContactEmail;
  const contactPhone = shiftToShow.objectContactPhone;
  const handleOpenMaps = () => {
    openAddressInMaps(locationSubtext);
  };

  const shiftEnd = new Date(shiftToShow.end);
  const shiftTempo =
    minutesUntilStart <= 0
      ? t('liveNow')
      : minutesUntilStart <= 30
      ? t('startingSoon')
      : t('upcoming');
  const shiftPhase: ShiftPhase = getShiftPhase(shiftToShow.start, shiftToShow.end, now);
  const phaseLabel = t(phaseTranslationKey[shiftPhase]);
  const checklist = [t('arriveTip'), t('badgeTip'), t('reviewTip')];
  const prepValue = minutesUntilStart <= 30 ? t('headToLocation') : t('prepGear');
  const heroStats = [
    { label: t('heroStatsStart'), value: startLabel },
    { label: t('heroStatsEnd'), value: endLabel },
    { label: t('heroStatsDuration'), value: duration },
  ];
  const reachOutCopy = t('reachOutCopy', { contact: opsContact });
  const heroGradientColors: [string, string] = [theme.heroGradientStart, theme.heroGradientEnd];
  const sectionShadowColor = '#000';
  const sectionBackground = theme.surface;
  const heroChipBackground = theme.surfaceMuted;
  const heroStatBackground = theme.surface;
  const nextStepBackground = theme.surfaceMuted;
  const bulletColor = theme.primary;
  const mapLinkColor = theme.info;
  const heroTempoLabelColor = theme.textSecondary;
  const heroTempoValueColor = theme.textPrimary;
  const textPrimaryColor = theme.textPrimary;
  const textSecondaryColor = theme.textSecondary;
  const sectionBackgroundStyle = {
    backgroundColor: sectionBackground,
    shadowColor: sectionShadowColor,
  };

  const contentStyle = [
    styles.container,
    { paddingBottom: 40 + insets.bottom, backgroundColor: theme.background },
  ];

  return (
    <ScrollView contentContainerStyle={contentStyle}>
      <View style={styles.headerContainer}>
        <Text style={styles.tabLabel}>{t('shiftOverview')}</Text>
      </View>
      <LinearGradient
        colors={heroGradientColors}
        style={[styles.hero, { borderColor: status.border }]}
      >
        <View style={styles.heroTop}>
          <View
            style={[
              styles.statusBadge,
              { borderColor: status.border, backgroundColor: theme.surface },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
            <Text style={[styles.statusText, { color: status.text }]}>{statusLabel}</Text>
          </View>
          <View>
            <Text style={[styles.heroTempoLabel, { color: heroTempoLabelColor }]}>{shiftTempo}</Text>
            <Text style={[styles.heroTempoValue, { color: heroTempoValueColor }]}>
              {countdownLabel}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: textPrimaryColor }]}>{shiftToShow.title}</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>{locationLabel}</Text>
        <Text style={[styles.statusDescription, { color: textSecondaryColor }]}>
          {statusDescription}
        </Text>

          <View style={styles.heroStats}>
            {heroStats.map((stat, index) => (
              <View
                key={stat.label}
                style={[
                  styles.heroStatCard,
                  { backgroundColor: heroStatBackground },
                  index === heroStats.length - 1 ? styles.heroStatCardLast : undefined,
                ]}
              >
                <Text style={[styles.heroStatLabel, { color: textSecondaryColor }]}>{stat.label}</Text>
              <Text style={[styles.heroStatValue, { color: textPrimaryColor }]}>{stat.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.heroChips}>
          <View style={[styles.heroChip, { backgroundColor: heroChipBackground }]}>
            <Text style={[styles.heroChipLabel, { color: textSecondaryColor }]}>
              {t('stageLabel')}
            </Text>
            <Text style={[styles.heroChipValue, { color: textPrimaryColor }]}>{shiftTempo}</Text>
          </View>
          <View
            style={[
              styles.heroChip,
              styles.heroChipLast,
              { backgroundColor: heroChipBackground },
            ]}
          >
            <Text style={[styles.heroChipLabel, { color: textSecondaryColor }]}>
              {t('countdownLabel')}
            </Text>
            <Text style={[styles.heroChipValue, { color: textPrimaryColor }]}>{countdownLabel}</Text>
          </View>
        </View>
        <View style={[styles.heroPhase, { backgroundColor: phaseMeta[shiftPhase].background }]}>
          <Ionicons
            name={phaseMeta[shiftPhase].icon as ComponentProps<typeof Ionicons>['name']}
            size={16}
            color={phaseMeta[shiftPhase].color}
          />
          <Text style={[styles.heroPhaseLabel, { color: phaseMeta[shiftPhase].color }]}>
            {phaseLabel}
          </Text>
        </View>
      </LinearGradient>

      <View style={[styles.section, sectionBackgroundStyle]}>
        <Text style={[styles.sectionHeading, { color: textSecondaryColor }]}>
          {t('timingSnapshot')}
        </Text>
        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: textSecondaryColor }]}>{t('dayLabel')}</Text>
            <Text style={[styles.gridValue, { color: textPrimaryColor }]}>{dateLabel}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: textSecondaryColor }]}>{t('stageLabel')}</Text>
            <Text style={[styles.gridValue, { color: textPrimaryColor }]}>{shiftTempo}</Text>
          </View>
        </View>
        <View style={styles.nextStepsRow}>
          <View style={[styles.nextStep, { backgroundColor: nextStepBackground }]}>
            <Text style={[styles.nextStepLabel, { color: textSecondaryColor }]}>
              {t('countdownLabel')}
            </Text>
            <Text style={[styles.nextStepValue, { color: textPrimaryColor }]}>
              {countdownLabel}
            </Text>
          </View>
          <View style={[styles.nextStep, styles.nextStepLast, { backgroundColor: nextStepBackground }]}>
            <Text style={[styles.nextStepLabel, { color: textSecondaryColor }]}>
              {t('prepLabel')}
            </Text>
            <Text style={[styles.nextStepValue, { color: textPrimaryColor }]}>{prepValue}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, sectionBackgroundStyle]}>
        <Text style={[styles.sectionHeading, { color: textSecondaryColor }]}>
          {t('focusPointsLabel')}
        </Text>
        <View style={styles.splitRow}>
          {checklist.map((point) => (
            <View key={point} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: bulletColor }]} />
              <Text style={[styles.bulletText, { color: textPrimaryColor }]}>{point}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, sectionBackgroundStyle]}>
        <Text style={[styles.sectionHeading, { color: textSecondaryColor }]}>{t('whereLabel')}</Text>
        <Text style={[styles.sectionTitle, { color: textPrimaryColor }]}>{locationLabel}</Text>
        {locationSubtext ? (
          <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
            {locationSubtext}
          </Text>
        ) : null}
        {locationSubtext ? (
          <Pressable
            style={({ pressed }) => [
              styles.mapActionButton,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSoft,
              },
              pressed && styles.mapActionButtonPressed,
            ]}
            onPress={handleOpenMaps}
            accessibilityRole="button"
            accessibilityLabel={t('openInMaps')}
          >
            <Ionicons name="map-outline" size={16} color={mapLinkColor} />
            <Text style={[styles.mapActionLabel, { color: mapLinkColor }]}>{t('openInMaps')}</Text>
          </Pressable>
        ) : null}
      </View>

      {description ? (
        <View style={[styles.section, sectionBackgroundStyle]}>
          <Text style={[styles.sectionHeading, { color: textSecondaryColor }]}>
            {t('whatYoullDoLabel')}
          </Text>
          <Text style={[styles.sectionBody, { color: textPrimaryColor }]}>{description}</Text>
        </View>
      ) : null}

      {!description && (
        <View style={[styles.section, sectionBackgroundStyle]}>
          <Text style={[styles.sectionHeading, { color: textSecondaryColor }]}>
            {t('whatYoullDoLabel')}
          </Text>
          <Text style={[styles.sectionBody, { color: textPrimaryColor }]}>{t('noDescription')}</Text>
        </View>
      )}

      <View style={[styles.section, sectionBackgroundStyle]}>
        <Text style={[styles.sectionHeading, { color: textSecondaryColor }]}>{t('needAHand')}</Text>
        <Text style={[styles.sectionBody, { color: textPrimaryColor }]}>{reachOutCopy}</Text>
        <Text style={[styles.sectionBody, { color: textPrimaryColor }]}>
          {t('callLabel')}: {contactPhone ?? t('notProvided')}
        </Text>
        <Text style={[styles.sectionBody, { color: textPrimaryColor }]}>
          {t('emailLabel')}: {contactEmail ?? t('notProvided')}
        </Text>
      </View>

      <View style={styles.cta}>
        <PrimaryButton title={t('cta')} onPress={() => router.push('/qr-clock-in')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 22,
    marginBottom: 24,
    padding: 20,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 6,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTempoLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  heroTempoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    marginBottom: 6,
  },
  statusDescription: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  heroStatCardLast: {
    marginRight: 0,
  },
  heroStatLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  heroChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroChip: {
    flex: 1,
    backgroundColor: '#edf2ff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    alignItems: 'center',
  },
  heroChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroChipValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  heroChipLast: {
    marginRight: 0,
  },
  heroPhase: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  heroPhaseLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionHeading: {
    color: '#475569',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: '#475569',
    fontSize: 14,
  },
  sectionBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  splitRow: {
    marginTop: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    marginRight: 8,
  },
  bulletText: {
    fontSize: 14,
    color: '#0f172a',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: 1,
    paddingVertical: 6,
  },
  gridLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  nextStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  nextStep: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    marginRight: 8,
  },
  nextStepLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  nextStepValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  nextStepLast: {
    marginRight: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
    fontWeight: '600',
  },
  cta: {
    marginTop: 24,
    marginBottom: 16,
  },
  mapActionButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapActionButtonPressed: {
    opacity: 0.75,
  },
  mapActionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
});
