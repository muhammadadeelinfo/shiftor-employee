import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { BackButton } from '@shared/components/BackButton';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { layoutTokens } from '@shared/theme/layout';
import { getContentMaxWidth } from '@shared/utils/responsiveLayout';
import { getEmployeeApiBaseUrl } from '@features/account/monthlyHours';
import {
  fetchEmployeeOpenShifts,
  requestEmployeeOpenShift,
  type EmployeeOpenShiftRecord,
} from '@features/account/employeeSelfService';

const formatDate = (value: string | null, language: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 5);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getStatusTone = (status: EmployeeOpenShiftRecord['requestStatus'], theme: ReturnType<typeof useTheme>['theme']) => {
  if (status === 'approved') return theme.success;
  if (status === 'rejected' || status === 'cancelled') return theme.fail;
  if (status === 'pending') return theme.caution;
  return theme.primary;
};

export default function OpenShiftsScreen() {
  const { user, session } = useAuth();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const apiBaseUrl = getEmployeeApiBaseUrl();
  const [requestingShiftId, setRequestingShiftId] = useState<string | null>(null);
  const contentMaxWidth = getContentMaxWidth(width);

  const queryKey = ['employeeOpenShifts', user?.id, apiBaseUrl];
  const { data: shifts = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      fetchEmployeeOpenShifts({
        apiBaseUrl,
        accessToken: session?.access_token,
        t,
      }),
    enabled: Boolean(user?.id && session?.access_token && apiBaseUrl),
    staleTime: 30_000,
  });

  const totals = useMemo(
    () =>
      shifts.reduce(
        (sum, shift) => ({
          shifts: sum.shifts + 1,
          openSlots: sum.openSlots + shift.openSlots,
          requested: sum.requested + (shift.requestStatus === 'pending' ? 1 : 0),
        }),
        { shifts: 0, openSlots: 0, requested: 0 }
      ),
    [shifts]
  );

  const handleRequestShift = async (shift: EmployeeOpenShiftRecord) => {
    if (!apiBaseUrl || !session?.access_token) {
      Alert.alert(t('openShiftsTitle'), t('openShiftsUnavailable'));
      return;
    }
    try {
      setRequestingShiftId(shift.id);
      await requestEmployeeOpenShift({
        apiBaseUrl,
        accessToken: session.access_token,
        shiftId: shift.id,
        t,
      });
      await queryClient.invalidateQueries({ queryKey });
      Alert.alert(t('openShiftsTitle'), t('openShiftsRequested'));
    } catch (requestError) {
      Alert.alert(
        t('openShiftsTitle'),
        requestError instanceof Error ? requestError.message : t('openShiftsRequestFailed')
      );
    } finally {
      setRequestingShiftId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 28,
            maxWidth: contentMaxWidth,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />}
      >
        <View style={styles.header}>
          <BackButton fallbackHref="/account" />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('openShiftsTitle')}</Text>
            <Text style={[styles.headerHint, { color: theme.textSecondary }]}>{t('openShiftsHint')}</Text>
          </View>
        </View>

        <LinearGradient
          colors={['#12213f', '#0f2b3a', '#0b1326']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>{t('openShiftsHeroEyebrow')}</Text>
              <Text style={styles.heroTitle}>{t('openShiftsHeroTitle')}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{t('openShiftsOpenSlots', { count: totals.openSlots })}</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totals.shifts}</Text>
              <Text style={styles.metricLabel}>{t('openShiftsMetricShifts')}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totals.requested}</Text>
              <Text style={styles.metricLabel}>{t('openShiftsMetricRequested')}</Text>
            </View>
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t('openShiftsLoading')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Text style={[styles.stateText, { color: theme.fail }]}>
              {error instanceof Error ? error.message : t('openShiftsLoadFailed')}
            </Text>
            <PrimaryButton title={t('retry')} onPress={() => void refetch()} />
          </View>
        ) : null}

        {!isLoading && !error && shifts.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Ionicons name="checkmark-circle-outline" size={24} color={theme.success} />
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t('openShiftsEmpty')}</Text>
          </View>
        ) : null}

        <View style={styles.shiftList}>
          {shifts.map((shift) => {
            const statusTone = getStatusTone(shift.requestStatus, theme);
            const hasRequested = Boolean(shift.requestStatus);
            const isBusy = requestingShiftId === shift.id;
            return (
              <View
                key={shift.id}
                style={[styles.shiftCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
              >
                <View style={styles.shiftTopRow}>
                  <View style={styles.shiftTitleWrap}>
                    <Text style={[styles.shiftTitle, { color: theme.textPrimary }]}>
                      {shift.shiftDescription || t('openShiftsUntitled')}
                    </Text>
                    <Text style={[styles.shiftObject, { color: theme.primary }]}>{shift.objectTitle}</Text>
                  </View>
                  <View style={[styles.slotBadge, { borderColor: theme.primary, backgroundColor: `${theme.primary}18` }]}>
                    <Text style={[styles.slotBadgeText, { color: theme.primary }]}>
                      {t('openShiftsOpenSlots', { count: shift.openSlots })}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-clear-outline" size={15} color={theme.textSecondary} />
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                    {formatDate(shift.shiftStartingDate, language)} · {formatTime(shift.shiftStartingTime)} - {formatTime(shift.shiftEndingTime)}
                  </Text>
                </View>
                {shift.objectAddress ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={15} color={theme.textSecondary} />
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>{shift.objectAddress}</Text>
                  </View>
                ) : null}
                <View style={styles.capacityRow}>
                  <Text style={[styles.capacityText, { color: theme.textSecondary }]}>
                    {t('openShiftsCapacity', {
                      assigned: shift.assignedWorkers,
                      required: shift.requiredWorkers,
                    })}
                  </Text>
                  {hasRequested ? (
                    <View style={[styles.statusBadge, { borderColor: statusTone, backgroundColor: `${statusTone}18` }]}>
                      <Text style={[styles.statusBadgeText, { color: statusTone }]}>
                        {shift.requestStatus === 'approved'
                          ? t('openShiftsStatusApproved')
                          : shift.requestStatus === 'rejected'
                            ? t('openShiftsStatusRejected')
                            : shift.requestStatus === 'cancelled'
                              ? t('openShiftsStatusCancelled')
                              : t('openShiftsStatusPending')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <PrimaryButton
                  title={hasRequested ? t('openShiftsAlreadyRequested') : isBusy ? t('openShiftsRequesting') : t('openShiftsRequestAction')}
                  onPress={() => void handleRequestShift(shift)}
                  disabled={hasRequested || isBusy}
                  style={styles.requestButton}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  headerHint: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
  },
  heroBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(103,232,249,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  heroBadgeText: {
    color: '#cffafe',
    fontWeight: '900',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    padding: 12,
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#b8cbe0',
    marginTop: 2,
    fontWeight: '700',
  },
  stateCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  stateText: {
    textAlign: 'center',
    fontWeight: '700',
  },
  shiftList: {
    gap: 12,
  },
  shiftCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  shiftTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  shiftTitleWrap: {
    flex: 1,
  },
  shiftTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  shiftObject: {
    marginTop: 4,
    fontWeight: '800',
  },
  slotBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  slotBadgeText: {
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    flex: 1,
    fontWeight: '700',
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  capacityText: {
    flex: 1,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontWeight: '900',
  },
  requestButton: {
    marginTop: 2,
  },
});
