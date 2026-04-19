import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { getContentMaxWidth, shouldStackForCompactWidth } from '@shared/utils/responsiveLayout';
import { downloadRemoteDocument } from '@shared/utils/nativeDocumentOpen';
import { getUserFacingErrorMessage } from '@shared/utils/userFacingError';
import {
  buildVacationApprovalDocumentFileName,
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
  const [activeView, setActiveView] = useState<'new' | 'approved'>('new');
  const [pickerField, setPickerField] = useState<'start' | 'end' | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());

  const { data: requestContext } = useQuery({
    queryKey: ['vacationRequestContext', employeeId],
    queryFn: () => fetchVacationRequestContext(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 60_000,
  });

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['vacationRequests', employeeId],
    queryFn: () => fetchVacationRequests(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 15_000,
  });

  const openPicker = (field: 'start' | 'end') => {
    setPickerField(field);
    setPickerDate(field === 'start' ? startDate : endDate);
  };

  const closePicker = () => setPickerField(null);

  const confirmPicker = () => {
    if (pickerField === 'start') {
      setStartDate(pickerDate);
      if (pickerDate > endDate) {
        setEndDate(pickerDate);
      }
    }
    if (pickerField === 'end') {
      setEndDate(pickerDate < startDate ? startDate : pickerDate);
    }
    closePicker();
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

    try {
      setSubmitting(true);
      await submitVacationRequest({
        companyId: requestContext.companyId,
        employeeId,
        startDate: startValue,
        endDate: endValue,
        note,
      });
      setNote('');
      setActiveView('approved');
      await queryClient.invalidateQueries({ queryKey: ['vacationRequests', employeeId] });
      Alert.alert(t('vacationRequestsTitle'), t('vacationRequestsSubmitted'));
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('commonBack')}
            style={[styles.backButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
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
            <View
              style={[
                styles.overviewBadge,
                {
                  backgroundColor: `${statusTone(latestRequest?.status ?? 'pending', theme)}18`,
                  borderColor: `${statusTone(latestRequest?.status ?? 'pending', theme)}38`,
                },
              ]}
            >
              <Text style={[styles.overviewBadgeText, { color: statusTone(latestRequest?.status ?? 'pending', theme) }]}>
                {latestRequest ? getStatusLabel(latestRequest.status) : t('vacationRequestsStatusPending')}
              </Text>
            </View>
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
            { key: 'approved', label: t('vacationRequestsSegmentApproved') },
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
                onPress={() => setActiveView(segment.key as 'new' | 'approved')}
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

            <View style={[styles.dateGrid, isCompact && styles.dateGridStack]}>
              <TouchableOpacity
                style={[styles.dateField, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
                onPress={() => openPicker('start')}
                activeOpacity={0.86}
              >
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {t('vacationRequestsStartDate')}
                </Text>
                <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                  {formatVacationDate(toDateOnlyString(startDate), language)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateField, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
                onPress={() => openPicker('end')}
                activeOpacity={0.86}
              >
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {t('vacationRequestsEndDate')}
                </Text>
                <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                  {formatVacationDate(toDateOnlyString(endDate), language)}
                </Text>
              </TouchableOpacity>
            </View>

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
            />
          </View>
        ) : (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <View style={styles.sectionHeadingRow}>
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('vacationRequestsApprovedLetters')}
              </Text>
              <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
                {approvedRequests.length} {t('vacationRequestsCountLabel')}
              </Text>
            </View>

            {isLoading ? (
              <View style={styles.stateBlock}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                  {t('vacationRequestsLoading')}
                </Text>
              </View>
            ) : error ? (
              <Text style={[styles.stateText, { color: theme.fail }]}>
                {getUserFacingErrorMessage(error, { fallback: t('vacationRequestsLoadFailed') })}
              </Text>
            ) : approvedRequests.length === 0 ? (
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('vacationRequestsApprovedEmpty')}
              </Text>
            ) : (
              <View style={styles.requestList}>
                {approvedRequests.map((request) => (
                  <VacationRequestCard
                    key={request.id}
                    request={request}
                    language={language}
                    theme={theme}
                    getStatusLabel={getStatusLabel}
                    onOpenApprovalLetter={handleOpenApprovalLetter}
                    isOpeningApprovalLetter={openingRequestId === request.id}
                    t={t}
                    isCompact={isCompact}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal transparent visible={Boolean(pickerField)} animationType="slide" onRequestClose={closePicker}>
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.borderSoft }]} />
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              {pickerField === 'start' ? t('vacationRequestsStartDate') : t('vacationRequestsEndDate')}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {formatVacationDate(toDateOnlyString(pickerDate), language)}
            </Text>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={pickerField === 'end' ? startDate : undefined}
              themeVariant="dark"
              textColor="#FFFFFF"
              accentColor={theme.primary}
              onChange={(_, selectedDate) => {
                if (selectedDate) {
                  setPickerDate(selectedDate);
                }
              }}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}
                onPress={closePicker}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>{t('commonCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: theme.primary }]}
                onPress={confirmPicker}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText]}>OK</Text>
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
  t,
  isCompact,
}: {
  request: VacationRequestRecord;
  language: string;
  theme: ReturnType<typeof useTheme>['theme'];
  getStatusLabel: (status: VacationRequestStatus) => string;
  onOpenApprovalLetter: (request: VacationRequestRecord) => void;
  isOpeningApprovalLetter: boolean;
  t: (key: string) => string;
  isCompact: boolean;
}) {
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
        {formatVacationDate(request.createdAt, language)}
      </Text>
      {request.note?.trim() ? (
        <Text style={[styles.requestNote, { color: theme.textPrimary }]}>{request.note.trim()}</Text>
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
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  dateGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  dateGridStack: {
    flexDirection: 'column',
  },
  dateField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
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
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 10,
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
