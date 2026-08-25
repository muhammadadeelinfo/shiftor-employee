import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BackButton } from '@shared/components/BackButton';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage, type TranslationKey } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { getContentMaxWidth, shouldStackForCompactWidth } from '@shared/utils/responsiveLayout';
import { downloadRemoteDocument } from '@shared/utils/nativeDocumentOpen';
import { recordPositiveRatingMoment } from '@shared/utils/ratingPrompt';
import { getUserFacingErrorMessage } from '@shared/utils/userFacingError';
import { trackAppEvent } from '@shared/utils/analytics';
import {
  buildVacationApprovalDocumentFileName,
  cancelVacationRequest,
  fetchVacationApprovalLetterUrl,
  fetchVacationRequestContext,
  fetchVacationRequests,
  formatVacationDate,
  formatVacationRange,
  submitVacationRequest,
  toDateOnlyString,
  type VacationRequestRecord,
  type VacationRequestStatus,
} from '@features/account/vacationRequests';

const statusTone = (status: VacationRequestStatus, colors: ReturnType<typeof useTheme>['theme']) => {
  if (status === 'approved') return colors.success;
  if (status === 'rejected') return colors.fail;
  if (status === 'cancelled') return colors.textSecondary;
  return colors.caution;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getCalendarWeeks = (date: Date) => {
  const weeks: Date[][] = [];
  const monthStart = startOfMonth(date);
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  while (weeks.length < 6) {
    const week: Date[] = [];
    for (let index = 0; index < 7; index += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
};

const getDateBoundsFromKeys = (dateKeys: Set<string>) => {
  const sortedKeys = Array.from(dateKeys).sort();
  if (sortedKeys.length === 0) return null;
  return {
    start: new Date(`${sortedKeys[0]}T00:00:00`),
    end: new Date(`${sortedKeys[sortedKeys.length - 1]}T00:00:00`),
  };
};

const SELECTED_DAYS_NOTE_LABELS = ['Selected vacation days', 'Ausgewählte Urlaubstage'];
type RequestFilter = 'all' | VacationRequestStatus;

const parseVacationRequestNote = (note: string | null) => {
  const trimmedNote = note?.trim();
  if (!trimmedNote) {
    return { userNote: null, selectedDays: null };
  }

  const noteLines = trimmedNote.split(/\r?\n/);
  const selectedDayLine = noteLines.find((line) =>
    SELECTED_DAYS_NOTE_LABELS.some((label) => line.trim().startsWith(`${label}:`))
  );
  const selectedDays = selectedDayLine?.split(':').slice(1).join(':').trim() || null;
  const userNote = noteLines
    .filter((line) => line !== selectedDayLine)
    .join('\n')
    .trim();

  return {
    userNote: userNote || null,
    selectedDays,
  };
};

export default function VacationRequestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const employeeId = user?.id ?? '';
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openingRequestId, setOpeningRequestId] = useState<string | null>(null);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'new' | 'requests'>('new');
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all');
  const [isVacationCalendarOpen, setVacationCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKeys, setSelectedDateKeys] = useState<Set<string>>(() => new Set());
  const [draftDateKeys, setDraftDateKeys] = useState<Set<string>>(() => new Set());

  const { data: requestContext } = useQuery({
    queryKey: ['vacationRequestContext', employeeId],
    queryFn: () => fetchVacationRequestContext(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 60_000,
  });

  const { data: requests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['vacationRequests', employeeId],
    queryFn: () => fetchVacationRequests(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 15_000,
  });

  const openVacationCalendar = () => {
    setCalendarMonth(startOfMonth(startDate));
    setDraftDateKeys(new Set(selectedDateKeys));
    setVacationCalendarOpen(true);
  };

  const closeVacationCalendar = () => setVacationCalendarOpen(false);

  const applyVacationSelection = () => {
    const dateBounds = getDateBoundsFromKeys(draftDateKeys);
    if (!dateBounds) {
      Alert.alert(t('vacationRequestsTitle'), t('vacationRequestsNoDaysSelected'));
      return;
    }

    setStartDate(dateBounds.start);
    setEndDate(dateBounds.end);
    setSelectedDateKeys(new Set(draftDateKeys));
    setCalendarMonth(startOfMonth(dateBounds.start));
    closeVacationCalendar();
  };

  const handleCalendarDayPress = (day: Date) => {
    const dayKey = toDateOnlyString(day);

    setDraftDateKeys((current) => {
      const next = new Set(current);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  const latestRequest = requests[0] ?? null;
  const approvedRequests = useMemo(
    () => requests.filter((request) => request.status === 'approved'),
    [requests]
  );
  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests]
  );
  const filteredRequests = useMemo(
    () => (requestFilter === 'all' ? requests : requests.filter((request) => request.status === requestFilter)),
    [requestFilter, requests]
  );
  const selectedVacationDays = useMemo(
    () => selectedDateKeys.size,
    [selectedDateKeys]
  );
  const selectedVacationDurationLabel = selectedVacationDays === 1
    ? t('vacationRequestsDurationOne')
    : t('vacationRequestsDurationMany', { count: selectedVacationDays });
  const draftVacationDays = useMemo(
    () => draftDateKeys.size,
    [draftDateKeys]
  );
  const draftVacationDurationLabel = draftVacationDays === 1
    ? t('vacationRequestsDurationOne')
    : t('vacationRequestsDurationMany', { count: draftVacationDays });
  const selectedVacationDateLabels = useMemo(
    () =>
      Array.from(selectedDateKeys)
        .sort()
        .map((key) => formatVacationDate(key, language)),
    [language, selectedDateKeys]
  );
  const selectedVacationPreviewLabel = useMemo(() => {
    if (selectedVacationDateLabels.length === 0) return t('vacationRequestsCalendarTitle');
    if (selectedVacationDateLabels.length <= 2) return selectedVacationDateLabels.join(', ');
    return `${selectedVacationDateLabels.slice(0, 2).join(', ')} ${t('vacationRequestsMoreSelectedDates', {
      count: selectedVacationDateLabels.length - 2,
    })}`;
  }, [selectedVacationDateLabels, t]);
  const calendarWeeks = useMemo(() => getCalendarWeeks(calendarMonth), [calendarMonth]);
  const calendarMonthLabel = useMemo(
    () => calendarMonth.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' }),
    [calendarMonth, language]
  );
  const requestSummaryLabel = useMemo(() => {
    if (!latestRequest) return t('vacationRequestsNoRecentRequest');
    return `${t('vacationRequestsLatestSubmitted')} ${formatVacationDate(latestRequest.createdAt, language)}`;
  }, [language, latestRequest, t]);
  const latestApprovedRequest = approvedRequests[0] ?? null;
  const isCompact = shouldStackForCompactWidth(width);
  const contentMaxWidth = getContentMaxWidth(width);

  const getStatusLabel = (status: VacationRequestStatus) => {
    if (status === 'approved') return t('vacationRequestsStatusApproved');
    if (status === 'rejected') return t('vacationRequestsStatusRejected');
    if (status === 'cancelled') return t('vacationRequestsStatusCancelled');
    return t('vacationRequestsStatusPending');
  };

  const getRequestFilterLabel = (filter: RequestFilter) =>
    filter === 'all' ? t('vacationRequestsFilterAll') : getStatusLabel(filter);

  const handleSubmit = async () => {
    if (!employeeId || !requestContext?.companyId) {
      Alert.alert(t('vacationRequestsTitle'), t('vacationRequestsEmployeeUnavailable'));
      return;
    }
    const startValue = toDateOnlyString(startDate);
    const endValue = toDateOnlyString(endDate);
    if (endValue < startValue) {
      Alert.alert(t('vacationRequestsTitle'), t('vacationRequestsInvalidRange'));
      return;
    }
    if (selectedVacationDays === 0) {
      Alert.alert(t('vacationRequestsTitle'), t('vacationRequestsNoDaysSelected'));
      return;
    }

    const trimmedNote = note.trim();
    const selectionNote = `${t('vacationRequestsSelectedDaysNote')}: ${selectedVacationDateLabels.join(', ')}`;
    const requestNote = trimmedNote ? `${trimmedNote}\n\n${selectionNote}` : selectionNote;

    try {
      setSubmitting(true);
      await submitVacationRequest({
        companyId: requestContext.companyId,
        employeeId,
        startDate: startValue,
        endDate: endValue,
        selectedDates: Array.from(selectedDateKeys).sort(),
        note: requestNote,
      });
      void trackAppEvent('vacation_submitted');
      setNote('');
      setStartDate(new Date());
      setEndDate(new Date());
      setSelectedDateKeys(new Set());
      setDraftDateKeys(new Set());
      setCalendarMonth(startOfMonth(new Date()));
      setActiveView('requests');
      await queryClient.invalidateQueries({ queryKey: ['vacationRequests', employeeId] });
      Alert.alert(t('vacationRequestsTitle'), t('vacationRequestsSubmitted'), [
        {
          text: t('commonContinue'),
          onPress: () => {
            void recordPositiveRatingMoment({
              moment: 'vacation-submitted',
              copy: {
                title: t('ratingPromptTitle'),
                body: t('ratingPromptBody'),
                rateAction: t('ratingPromptRateAction'),
                feedbackAction: t('ratingPromptFeedbackAction'),
                laterAction: t('ratingPromptLaterAction'),
              },
              onFeedback: () => router.push('/support'),
            });
          },
        },
      ]);
    } catch (submitError) {
      const fallbackMessage =
        submitError instanceof Error && submitError.message === 'Vacation requests are not available yet.'
          ? t('vacationRequestsUnavailable')
          : t('vacationRequestsSubmitFailed');
      Alert.alert(
        t('vacationRequestsTitle'),
        getUserFacingErrorMessage(submitError, { fallback: fallbackMessage })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenApprovalLetter = async (request: VacationRequestRecord) => {
    if (!employeeId || request.status !== 'approved') {
      return;
    }

    try {
      setOpeningRequestId(request.id);
      const signedUrl = await fetchVacationApprovalLetterUrl({
        companyId: request.companyId,
        employeeId,
        requestId: request.id,
      });

      if (!signedUrl) {
        Alert.alert(t('vacationRequestsTitle'), t('vacationRequestsApprovalLetterUnavailable'));
        return;
      }

      await downloadRemoteDocument({
        url: signedUrl,
        fileName: buildVacationApprovalDocumentFileName(request.id),
      });
    } catch (openError) {
      Alert.alert(
        t('vacationRequestsTitle'),
        getUserFacingErrorMessage(openError, {
          fallback: t('vacationRequestsApprovalLetterOpenFailed'),
        })
      );
    } finally {
      setOpeningRequestId((current) => (current === request.id ? null : current));
    }
  };

  const handleCancelVacationRequest = async (request: VacationRequestRecord) => {
    if (!employeeId || request.status !== 'pending') {
      return;
    }

    try {
      setCancellingRequestId(request.id);
      await cancelVacationRequest({ employeeId, requestId: request.id });
      await queryClient.invalidateQueries({ queryKey: ['vacationRequests', employeeId] });
      Alert.alert(t('vacationRequestsCancelTitle'), t('vacationRequestsCancelled'));
    } catch (cancelError) {
      Alert.alert(
        t('vacationRequestsCancelTitle'),
        getUserFacingErrorMessage(cancelError, { fallback: t('vacationRequestsCancelFailed') })
      );
    } finally {
      setCancellingRequestId((current) => (current === request.id ? null : current));
    }
  };

  const confirmCancelVacationRequest = (request: VacationRequestRecord) => {
    Alert.alert(t('vacationRequestsCancelTitle'), t('vacationRequestsCancelBody'), [
      { text: t('commonBack'), style: 'cancel' },
      {
        text: t('vacationRequestsCancelAction'),
        style: 'destructive',
        onPress: () => {
          void handleCancelVacationRequest(request);
        },
      },
    ]);
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
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BackButton fallbackHref="/account" />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('vacationRequestsTitle')}</Text>
            <Text style={[styles.headerHint, { color: theme.textSecondary }]}>
              {t('vacationRequestsHint')}
            </Text>
          </View>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <View style={[styles.overviewHeader, isCompact && styles.overviewHeaderStack]}>
            <View style={styles.overviewHeadingCopy}>
              <Text style={[styles.overviewEyebrow, { color: theme.primaryAccent }]}>
                {t('vacationRequestsOverviewLabel')}
              </Text>
              <Text style={[styles.overviewTitle, { color: theme.textPrimary }]}>
                {requestSummaryLabel}
              </Text>
            </View>
            {latestRequest ? (
              <View
                style={[
                  styles.overviewBadge,
                  {
                    backgroundColor: `${statusTone(latestRequest.status, theme)}18`,
                    borderColor: `${statusTone(latestRequest.status, theme)}38`,
                  },
                ]}
              >
                <Text style={[styles.overviewBadgeText, { color: statusTone(latestRequest.status, theme) }]}>
                  {getStatusLabel(latestRequest.status)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.metricsGrid, isCompact && styles.metricsGridStack]}>
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                {t('vacationRequestsMetricApproved')}
              </Text>
              <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{approvedRequests.length}</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                {t('vacationRequestsMetricPending')}
              </Text>
              <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{pendingRequests.length}</Text>
            </View>
          </View>

          {latestApprovedRequest ? (
            <View style={[styles.highlightCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Text style={[styles.highlightLabel, { color: theme.textSecondary }]}>
                {t('vacationRequestsLatestApproval')}
              </Text>
              <Text style={[styles.highlightValue, { color: theme.textPrimary }]}>
                {formatVacationRange(latestApprovedRequest.startDate, latestApprovedRequest.endDate, language)}
              </Text>
              <Text style={[styles.highlightMeta, { color: theme.textSecondary }]}>
                {formatVacationDate(latestApprovedRequest.reviewedAt ?? latestApprovedRequest.createdAt, language)}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.segmentedControl,
            isCompact && styles.segmentedControlCompact,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
          ]}
        >
          {[
            { key: 'new', label: t('vacationRequestsSegmentNew') },
            { key: 'requests', label: t('vacationRequestsSegmentRequests') },
          ].map((segment) => {
            const isActive = activeView === segment.key;
            return (
              <TouchableOpacity
                key={segment.key}
                style={[
                  styles.segmentButton,
                  isCompact && styles.segmentButtonCompact,
                  isActive && { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                ]}
                onPress={() => setActiveView(segment.key as 'new' | 'requests')}
                activeOpacity={0.88}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    { color: isActive ? theme.textPrimary : theme.textSecondary },
                  ]}
                >
                  {segment.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeView === 'new' ? (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <View style={styles.sectionHeadingRow}>
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('vacationRequestsNewRequest')}
              </Text>
              <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
                {pendingRequests.length > 0
                  ? t('vacationRequestsPendingSupport')
                  : t('vacationRequestsReadySupport')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.dateRangeField, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
              onPress={openVacationCalendar}
              activeOpacity={0.86}
            >
              <View style={styles.dateRangeIconWrap}>
                <Ionicons name="calendar-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.dateRangeCopy}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {t('vacationRequestsDateRange')}
                </Text>
                <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                  {selectedVacationPreviewLabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.durationPill, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Ionicons name="calendar-outline" size={14} color={theme.primary} />
              <Text style={[styles.durationPillText, { color: theme.textPrimary }]}>
                {selectedVacationDurationLabel}
              </Text>
            </View>
            <Text style={[styles.selectionHint, { color: theme.textSecondary }]}>
              {t('vacationRequestsCalendarSelectionHint', {
                vacationDays: selectedVacationDays,
              })}
            </Text>

            <Text style={[styles.fieldLabel, styles.noteLabel, { color: theme.textSecondary }]}>
              {t('vacationRequestsNote')}
            </Text>
            <View style={[styles.noteWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('vacationRequestsNotePlaceholder')}
                placeholderTextColor={theme.textPlaceholder}
                multiline
                textAlignVertical="top"
                style={[styles.noteInput, { color: theme.textPrimary }]}
              />
            </View>

            <PrimaryButton
              title={t('vacationRequestsSubmitAction')}
              onPress={() => void handleSubmit()}
              loading={submitting}
              disabled={selectedVacationDays === 0}
            />
          </View>
        ) : (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <View style={styles.sectionHeadingRow}>
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('vacationRequestsYourRequests')}
              </Text>
              <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
                {filteredRequests.length} {t('vacationRequestsCountLabel')}
              </Text>
            </View>

            <View style={styles.requestFilterBar}>
              {(['all', 'pending', 'approved', 'rejected'] as RequestFilter[]).map((filter) => {
                const isActive = requestFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.requestFilterChip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                      isActive && { backgroundColor: theme.surface, borderColor: theme.primary },
                    ]}
                    onPress={() => setRequestFilter(filter)}
                    activeOpacity={0.84}
                  >
                    <Text
                      style={[
                        styles.requestFilterText,
                        { color: isActive ? theme.textPrimary : theme.textSecondary },
                      ]}
                    >
                      {getRequestFilterLabel(filter)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isLoading ? (
              <View style={styles.stateBlock}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                  {t('vacationRequestsLoading')}
                </Text>
              </View>
            ) : error ? (
              <View style={styles.stateBlock}>
                <Text style={[styles.stateText, { color: theme.fail }]}> 
                  {getUserFacingErrorMessage(error, { fallback: t('vacationRequestsLoadFailed') })}
                </Text>
                <PrimaryButton title={t('retry')} onPress={() => void refetch()} />
              </View>
            ) : requests.length === 0 ? (
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('vacationRequestsEmpty')}
              </Text>
            ) : filteredRequests.length === 0 ? (
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('vacationRequestsFilteredEmpty')}
              </Text>
            ) : (
              <View style={styles.requestList}>
                {filteredRequests.map((request) => (
                  <VacationRequestCard
                    key={request.id}
                    request={request}
                    language={language}
                    theme={theme}
                    getStatusLabel={getStatusLabel}
                    onOpenApprovalLetter={handleOpenApprovalLetter}
                    isOpeningApprovalLetter={openingRequestId === request.id}
                    onCancelVacationRequest={confirmCancelVacationRequest}
                    isCancellingRequest={cancellingRequestId === request.id}
                    t={t}
                    isCompact={isCompact}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={isVacationCalendarOpen}
        animationType="slide"
        onRequestClose={closeVacationCalendar}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeVacationCalendar}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.borderSoft }]} />
            <View style={styles.calendarModalHeader}>
              <View style={styles.calendarTitleCopy}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  {t('vacationRequestsCalendarTitle')}
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {t('vacationRequestsCalendarHint')}
                </Text>
              </View>
              <View style={styles.calendarSelectionTools}>
                <View style={[styles.modalCountPill, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={theme.primary} />
                  <Text style={[styles.modalCountText, { color: theme.textPrimary }]}>
                    {draftVacationDurationLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.clearSelectionButton,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                    draftVacationDays === 0 && styles.clearSelectionButtonDisabled,
                  ]}
                  onPress={() => setDraftDateKeys(new Set())}
                  disabled={draftVacationDays === 0}
                  activeOpacity={0.82}
                >
                  <Ionicons name="close-circle-outline" size={15} color={theme.textSecondary} />
                  <Text style={[styles.clearSelectionText, { color: theme.textSecondary }]}>
                    {t('vacationRequestsCalendarClear')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.calendarMonthBar, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <TouchableOpacity
                style={styles.calendarMonthButton}
                onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              >
                <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthLabel, { color: theme.textPrimary }]}>{calendarMonthLabel}</Text>
              <TouchableOpacity
                style={styles.calendarMonthButton}
                onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              >
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.vacationCalendarHeader}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={[styles.vacationCalendarWeekday, { color: theme.textSecondary }]}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.vacationCalendarGrid}>
              {calendarWeeks.map((week, weekIndex) => (
                <View key={`vacation-week-${weekIndex}`} style={styles.vacationCalendarWeek}>
                  {week.map((day) => {
                    const dayKey = toDateOnlyString(day);
                    const todayKey = toDateOnlyString(new Date());
                    const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                    const isSelected = draftDateKeys.has(dayKey);
                    const isToday = dayKey === todayKey;
                    return (
                      <TouchableOpacity
                        key={dayKey}
                        style={[
                          styles.vacationDay,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                          isToday && !isSelected && { borderColor: theme.primary },
                          isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                          isSelected && styles.vacationDaySelected,
                          !isCurrentMonth && styles.vacationDayMuted,
                        ]}
                        onPress={() => handleCalendarDayPress(day)}
                        activeOpacity={0.82}
                      >
                        <Text
                          style={[
                            styles.vacationDayText,
                            { color: theme.textPrimary },
                            !isCurrentMonth && { color: theme.textSecondary },
                            isSelected && styles.vacationDayTextSelected,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                        {isToday && !isSelected ? (
                          <View style={[styles.todayDot, { backgroundColor: theme.primary }]} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}
                onPress={closeVacationCalendar}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>{t('commonCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  {
                    backgroundColor: draftVacationDays === 0 ? theme.surfaceMuted : theme.primary,
                    opacity: draftVacationDays === 0 ? 0.62 : 1,
                  },
                ]}
                onPress={applyVacationSelection}
                disabled={draftVacationDays === 0}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    draftVacationDays === 0
                      ? { color: theme.textSecondary }
                      : styles.modalButtonPrimaryText,
                  ]}
                >
                  {t('vacationRequestsCalendarApply')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function VacationRequestCard({
  request,
  language,
  theme,
  getStatusLabel,
  onOpenApprovalLetter,
  isOpeningApprovalLetter,
  onCancelVacationRequest,
  isCancellingRequest,
  t,
  isCompact,
}: {
  request: VacationRequestRecord;
  language: string;
  theme: ReturnType<typeof useTheme>['theme'];
  getStatusLabel: (status: VacationRequestStatus) => string;
  onOpenApprovalLetter: (request: VacationRequestRecord) => void;
  isOpeningApprovalLetter: boolean;
  onCancelVacationRequest: (request: VacationRequestRecord) => void;
  isCancellingRequest: boolean;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  isCompact: boolean;
}) {
  const parsedNote = parseVacationRequestNote(request.note);
  const selectedDaysText = Array.isArray(request.selectedDates) && request.selectedDates.length > 0
    ? request.selectedDates
        .slice()
        .sort()
        .map((date) => formatVacationDate(date, language))
        .join(', ')
    : parsedNote.selectedDays;

  return (
    <View style={[styles.requestCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
      <View style={[styles.requestTopRow, isCompact && styles.requestTopRowStack]}>
        <Text style={[styles.requestRange, { color: theme.textPrimary }]}>
          {formatVacationRange(request.startDate, request.endDate, language)}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: `${statusTone(request.status, theme)}20`,
              borderColor: `${statusTone(request.status, theme)}44`,
            },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: statusTone(request.status, theme) }]}>
            {getStatusLabel(request.status)}
          </Text>
        </View>
      </View>
      <Text style={[styles.requestMeta, { color: theme.textSecondary }]}>
        {t('vacationRequestsLatestSubmitted')} {formatVacationDate(request.createdAt, language)}
      </Text>
      {selectedDaysText ? (
        <View style={[styles.selectedDaysBlock, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.selectedDaysLabel, { color: theme.textSecondary }]}>
            {t('vacationRequestsSelectedDaysNote')}
          </Text>
          <Text style={[styles.selectedDaysText, { color: theme.textPrimary }]}>
            {selectedDaysText}
          </Text>
        </View>
      ) : null}
      {parsedNote.userNote ? (
        <Text style={[styles.requestNote, { color: theme.textPrimary }]}>{parsedNote.userNote}</Text>
      ) : null}
      {request.status === 'approved' ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.documentButton, { borderColor: theme.borderSoft, backgroundColor: theme.surface }]}
          onPress={() => void onOpenApprovalLetter(request)}
          activeOpacity={0.86}
          disabled={isOpeningApprovalLetter}
        >
          <Ionicons
            name={isOpeningApprovalLetter ? 'hourglass-outline' : 'document-text-outline'}
            size={16}
            color={theme.primary}
          />
          <Text style={[styles.documentButtonText, { color: theme.primary }]}>
            {isOpeningApprovalLetter
              ? t('vacationRequestsApprovalLetterOpening')
              : t('vacationRequestsApprovalLetterAction')}
          </Text>
        </TouchableOpacity>
      ) : null}
      {request.status === 'pending' ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.cancelRequestButton, { borderColor: theme.fail, backgroundColor: `${theme.fail}12` }]}
          onPress={() => onCancelVacationRequest(request)}
          activeOpacity={0.86}
          disabled={isCancellingRequest}
        >
          <Ionicons
            name={isCancellingRequest ? 'hourglass-outline' : 'close-circle-outline'}
            size={16}
            color={theme.fail}
          />
          <Text style={[styles.cancelRequestButtonText, { color: theme.fail }]}>
            {isCancellingRequest
              ? t('vacationRequestsCancelling')
              : t('vacationRequestsCancelAction')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
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
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 18,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerHint: {
    fontSize: 15,
    lineHeight: 22,
  },
  overviewCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    gap: 14,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  overviewHeaderStack: {
    flexDirection: 'column',
  },
  overviewHeadingCopy: {
    flex: 1,
    gap: 6,
  },
  overviewEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  overviewTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  overviewBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
  },
  overviewBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricsGridStack: {
    flexDirection: 'column',
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  highlightCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  highlightValue: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  highlightMeta: {
    fontSize: 13,
  },
  segmentedControl: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#020617',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  segmentedControlCompact: {
    gap: 4,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentButtonCompact: {
    minHeight: 44,
    paddingHorizontal: 10,
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionHeadingRow: {
    gap: 4,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: 13,
  },
  dateRangeField: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateRangeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRangeCopy: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  durationPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  durationPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectionHint: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: -6,
  },
  noteLabel: {
    marginTop: 2,
  },
  noteWrap: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 92,
  },
  noteInput: {
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  stateBlock: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
  },
  requestFilterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  requestFilterChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestFilterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  requestList: {
    gap: 12,
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  requestTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  requestTopRowStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  requestRange: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  requestMeta: {
    fontSize: 13,
  },
  requestNote: {
    fontSize: 14,
    lineHeight: 21,
  },
  selectedDaysBlock: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  selectedDaysLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  selectedDaysText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  documentButton: {
    marginTop: 2,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  documentButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cancelRequestButton: {
    marginTop: 2,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelRequestButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  calendarModalHeader: {
    gap: 12,
    marginBottom: 14,
  },
  calendarTitleCopy: {
    gap: 6,
  },
  calendarSelectionTools: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalCountPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  modalCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearSelectionButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  clearSelectionButtonDisabled: {
    opacity: 0.48,
  },
  clearSelectionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  calendarMonthBar: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarMonthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  vacationCalendarHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  vacationCalendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  vacationCalendarGrid: {
    gap: 5,
  },
  vacationCalendarWeek: {
    flexDirection: 'row',
    gap: 5,
  },
  vacationDay: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacationDaySelected: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  vacationDayMuted: {
    opacity: 0.42,
  },
  vacationDayText: {
    fontSize: 14,
    fontWeight: '800',
  },
  vacationDayTextSelected: {
    color: '#FFFFFF',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    marginTop: 3,
    opacity: 0.6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
  },
});
