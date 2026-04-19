import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { NativeModulesProxy } from 'expo-modules-core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage } from '@shared/context/LanguageContext';
import { getContentMaxWidth, shouldStackForCompactWidth } from '@shared/utils/responsiveLayout';
import { downloadRemoteDocument } from '@shared/utils/nativeDocumentOpen';
import { getUserFacingErrorMessage } from '@shared/utils/userFacingError';
import {
  EMPLOYEE_DOCUMENT_TYPES,
  fetchEmployeeDocumentDownloadUrl,
  fetchEmployeeDocuments,
  fetchEmployeeDocumentsContext,
  formatEmployeeDocumentDateTime,
  formatEmployeeDocumentFileSize,
  getEmployeeDocumentTypeLabelKey,
  submitEmployeeDocument,
  validateEmployeeDocumentAsset,
  type EmployeeDocumentType,
  type EmployeeDocumentRecord,
} from '@features/account/employeeDocuments';

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

type SelectedAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export default function EmployeeDocumentsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const employeeId = user?.id ?? '';
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] =
    useState<EmployeeDocumentType>('certificate-of-sickness');
  const [submitting, setSubmitting] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [typePickerExpanded, setTypePickerExpanded] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | EmployeeDocumentType>('all');

  const { data: documentContext } = useQuery({
    queryKey: ['employeeDocumentsContext', employeeId],
    queryFn: () => fetchEmployeeDocumentsContext(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 60_000,
  });

  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['employeeDocuments', employeeId, session?.access_token],
    queryFn: () =>
      fetchEmployeeDocuments({
        employeeId,
        accessToken: session?.access_token ?? '',
      }),
    enabled: Boolean(employeeId && session?.access_token),
    staleTime: 15_000,
  });

  const isCompact = shouldStackForCompactWidth(width);
  const contentMaxWidth = getContentMaxWidth(width);
  const selectedTypeOption =
    EMPLOYEE_DOCUMENT_TYPES.find((option) => option.slug === selectedDocumentType) ?? EMPLOYEE_DOCUMENT_TYPES[0];
  const activeHistoryOption =
    historyFilter === 'all'
      ? null
      : EMPLOYEE_DOCUMENT_TYPES.find((option) => option.slug === historyFilter) ?? null;
  const historyTypeCounts = useMemo(
    () =>
      EMPLOYEE_DOCUMENT_TYPES.reduce<Record<EmployeeDocumentType, number>>(
        (accumulator, option) => {
          accumulator[option.slug] = documents.filter((document) => document.slug === option.slug).length;
          return accumulator;
        },
        {
          'certificate-of-sickness': 0,
          'id-passport': 0,
          contract: 0,
          'proof-of-address': 0,
          other: 0,
        }
      ),
    [documents]
  );
  const filteredDocuments = useMemo(() => {
    if (historyFilter === 'all') {
      return documents;
    }
    return documents.filter((document) => document.slug === historyFilter);
  }, [documents, historyFilter]);
  const latestFilteredDocument = filteredDocuments[0] ?? null;
  const summaryLabel = useMemo(() => {
    if (!latestFilteredDocument) {
      return historyFilter === 'all'
        ? t('certificateOfSicknessNoRecentSubmission')
        : t('employeeDocumentsNoRecentForType', {
            type: t(activeHistoryOption?.labelKey ?? 'employeeDocumentsTypeOther'),
          });
    }
    return `${t('certificateOfSicknessLatestSubmitted')} ${formatEmployeeDocumentDateTime(
      latestFilteredDocument.createdAt,
      language
    )}`;
  }, [activeHistoryOption?.labelKey, historyFilter, language, latestFilteredDocument, t]);

  const handlePickFile = async () => {
    try {
      const documentPicker = getDocumentPickerModule();
      if (!documentPicker) {
        Alert.alert(t('certificateOfSicknessTitle'), t('certificateOfSicknessSubmitFailed'));
        return;
      }

      const result = await documentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const validationError = validateEmployeeDocumentAsset(asset, t);
      if (validationError) {
        Alert.alert(t('certificateOfSicknessTitle'), validationError);
        return;
      }

      setSelectedAsset({
        uri: asset.uri,
        name: asset.name || 'certificate',
        mimeType: asset.mimeType || null,
        size: asset.size,
      });
    } catch (pickError) {
      Alert.alert(
        t('certificateOfSicknessTitle'),
        getUserFacingErrorMessage(pickError, {
          fallback: t('certificateOfSicknessSubmitFailed'),
        })
      );
    }
  };

  const handleSubmit = async () => {
    if (!employeeId || !documentContext?.companyId) {
      Alert.alert(t('certificateOfSicknessTitle'), t('certificateOfSicknessEmployeeUnavailable'));
      return;
    }
    if (!session?.access_token) {
      Alert.alert(t('certificateOfSicknessTitle'), t('certificateOfSicknessApiUnavailable'));
      return;
    }
    if (!selectedAsset) {
      Alert.alert(t('certificateOfSicknessTitle'), t('certificateOfSicknessMissingFile'));
      return;
    }

    const validationError = validateEmployeeDocumentAsset(selectedAsset, t);
    if (validationError) {
      Alert.alert(t('certificateOfSicknessTitle'), validationError);
      return;
    }

    try {
      setSubmitting(true);
      await submitEmployeeDocument({
        accessToken: session.access_token,
        companyId: documentContext.companyId,
        employeeId,
        documentType: selectedDocumentType,
        asset: selectedAsset,
      });
      setSelectedAsset(null);
      await queryClient.invalidateQueries({
        queryKey: ['employeeDocuments', employeeId, session.access_token],
      });
      Alert.alert(t('certificateOfSicknessTitle'), t('certificateOfSicknessSubmitted'));
    } catch (submitError) {
      const fallbackMessage =
        submitError instanceof Error && submitError.message === 'DOCUMENT_TYPE_UNAVAILABLE'
          ? t('employeeDocumentsTypeUnavailable')
          : t('certificateOfSicknessSubmitFailed');
      Alert.alert(
        t('certificateOfSicknessTitle'),
        getUserFacingErrorMessage(submitError, {
          fallback: fallbackMessage,
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadDocument = async (document: EmployeeDocumentRecord) => {
    if (!session?.access_token) {
      return;
    }

    try {
      setOpeningDocumentId(document.id);
      const signedUrl = await fetchEmployeeDocumentDownloadUrl({
        accessToken: session.access_token,
        documentId: document.id,
      });

      if (!signedUrl) {
        Alert.alert(t('certificateOfSicknessTitle'), t('certificateOfSicknessUnavailable'));
        return;
      }

      const savedDocument = await downloadRemoteDocument({
        url: signedUrl,
        fileName: document.fileName,
      });
      Alert.alert(
        t('certificateOfSicknessDownloadedTitle'),
        t('certificateOfSicknessDownloadedBody', { path: savedDocument.relativePath })
      );
    } catch (openError) {
      Alert.alert(
        t('certificateOfSicknessTitle'),
        getUserFacingErrorMessage(openError, {
          fallback: t('certificateOfSicknessDownloadFailed'),
        })
      );
    } finally {
      setOpeningDocumentId((current) => (current === document.id ? null : current));
    }
  };

  const statusLabel = submitting
    ? t('certificateOfSicknessStatusUploading')
    : filteredDocuments.length > 0
      ? t('certificateOfSicknessLatestSubmitted')
      : t('certificateOfSicknessStatusMissing');

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
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('certificateOfSicknessTitle')}</Text>
            <Text style={[styles.headerHint, { color: theme.textSecondary }]}>
              {t('certificateOfSicknessHint')}
            </Text>
          </View>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <View style={[styles.overviewHeader, isCompact && styles.overviewHeaderStack]}>
            <View style={styles.overviewHeadingCopy}>
              <Text style={[styles.overviewEyebrow, { color: theme.primaryAccent }]}>
                {t('certificateOfSicknessOverviewLabel')}
              </Text>
              <Text style={[styles.overviewTitle, { color: theme.textPrimary }]}>{summaryLabel}</Text>
            </View>
            <View
              style={[
                styles.overviewBadge,
                {
                  backgroundColor: `${theme.primaryAccent}18`,
                  borderColor: `${theme.primaryAccent}38`,
                },
              ]}
            >
              <Text style={[styles.overviewBadgeText, { color: theme.primaryAccent }]}>{statusLabel}</Text>
            </View>
          </View>

          <View style={[styles.metricsGrid, isCompact && styles.metricsGridStack]}>
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                {t('certificateOfSicknessFilesCount')}
              </Text>
              <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{filteredDocuments.length}</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                {t('employeeDocumentsActiveFilter')}
              </Text>
              <Text style={[styles.metricValue, { color: theme.textPrimary }]} numberOfLines={2}>
                {historyFilter === 'all'
                  ? t('employeeDocumentsFilterAll')
                  : t(activeHistoryOption?.labelKey ?? 'employeeDocumentsTypeOther')}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            {t('certificateOfSicknessNewSubmission')}
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
            {t('certificateOfSicknessAcceptedTypes')}
          </Text>

          <TouchableOpacity
            style={[styles.filePicker, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
            onPress={() => setTypePickerExpanded((current) => !current)}
            activeOpacity={0.85}
          >
            <View style={[styles.fileIconWrap, { backgroundColor: `${theme.primaryAccent}14` }]}>
              <Ionicons name="list-outline" size={20} color={theme.primaryAccent} />
            </View>
            <View style={styles.filePickerCopy}>
              <Text style={[styles.filePickerTitle, { color: theme.textPrimary }]}>
                {t('employeeDocumentsTypeField')}
              </Text>
              <Text style={[styles.filePickerMeta, { color: theme.textSecondary }]}>
                {t(selectedTypeOption.labelKey)}
              </Text>
            </View>
            <Ionicons
              name={typePickerExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {typePickerExpanded ? (
            <View style={styles.typeOptions}>
              {EMPLOYEE_DOCUMENT_TYPES.map((option) => {
                const active = option.slug === selectedDocumentType;
                return (
                  <TouchableOpacity
                    key={option.slug}
                    style={[
                      styles.typeOption,
                      {
                        backgroundColor: active ? `${theme.primaryAccent}14` : theme.surfaceMuted,
                        borderColor: active ? `${theme.primaryAccent}40` : theme.borderSoft,
                      },
                    ]}
                    onPress={() => {
                      setSelectedDocumentType(option.slug);
                      setTypePickerExpanded(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.typeOptionLabel,
                        { color: active ? theme.primaryAccent : theme.textPrimary },
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={theme.primaryAccent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.filePicker, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
            onPress={() => {
              void handlePickFile();
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.fileIconWrap, { backgroundColor: `${theme.primaryAccent}14` }]}>
              <Ionicons name="document-attach-outline" size={20} color={theme.primaryAccent} />
            </View>
            <View style={styles.filePickerCopy}>
              <Text style={[styles.filePickerTitle, { color: theme.textPrimary }]}>
                {selectedAsset ? selectedAsset.name : t('certificateOfSicknessPickAction')}
              </Text>
              <Text style={[styles.filePickerMeta, { color: theme.textSecondary }]}>
                {selectedAsset?.size
                  ? formatEmployeeDocumentFileSize(selectedAsset.size)
                  : t('certificateOfSicknessAcceptedTypes')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <PrimaryButton
            title={submitting ? t('certificateOfSicknessSubmitting') : t('certificateOfSicknessSubmitAction')}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={submitting || !selectedAsset}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                {t('certificateOfSicknessHistory')}
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                {t('employeeDocumentsHistoryHint')}
              </Text>
            </View>
            <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
              {filteredDocuments.length}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={theme.primaryAccent} />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('certificateOfSicknessLoading')}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.stateBlock}>
              <Text style={[styles.stateText, { color: theme.fail }]}>
                {getUserFacingErrorMessage(error, { fallback: t('certificateOfSicknessLoadFailed') })}
              </Text>
            </View>
          ) : documents.length === 0 ? (
            <View style={styles.stateBlock}>
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('certificateOfSicknessEmpty')}
              </Text>
            </View>
          ) : (
            <View style={styles.documentList}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterTabs}
              >
                <TouchableOpacity
                  style={[
                    styles.filterTab,
                    {
                      backgroundColor: historyFilter === 'all' ? `${theme.primaryAccent}14` : theme.surfaceMuted,
                      borderColor: historyFilter === 'all' ? `${theme.primaryAccent}40` : theme.borderSoft,
                    },
                  ]}
                  onPress={() => setHistoryFilter('all')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterTabLabel,
                      { color: historyFilter === 'all' ? theme.primaryAccent : theme.textPrimary },
                    ]}
                  >
                    {t('employeeDocumentsFilterAll')}
                  </Text>
                  <Text
                    style={[
                      styles.filterTabCount,
                      { color: historyFilter === 'all' ? theme.primaryAccent : theme.textSecondary },
                    ]}
                  >
                    {documents.length}
                  </Text>
                </TouchableOpacity>
                {EMPLOYEE_DOCUMENT_TYPES.map((option) => {
                  const active = historyFilter === option.slug;
                  return (
                    <TouchableOpacity
                      key={option.slug}
                      style={[
                        styles.filterTab,
                        {
                          backgroundColor: active ? `${theme.primaryAccent}14` : theme.surfaceMuted,
                          borderColor: active ? `${theme.primaryAccent}40` : theme.borderSoft,
                        },
                      ]}
                      onPress={() => {
                        setHistoryFilter(option.slug);
                        setSelectedDocumentType(option.slug);
                        setTypePickerExpanded(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.filterTabLabel,
                          { color: active ? theme.primaryAccent : theme.textPrimary },
                        ]}
                      >
                        {t(option.labelKey)}
                      </Text>
                      <Text
                        style={[
                          styles.filterTabCount,
                          { color: active ? theme.primaryAccent : theme.textSecondary },
                        ]}
                      >
                        {historyTypeCounts[option.slug]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {filteredDocuments.length === 0 ? (
                <View style={styles.stateBlock}>
                  <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                    {t('employeeDocumentsFilteredEmpty')}
                  </Text>
                </View>
              ) : null}

              {filteredDocuments.map((document) => (
                <View
                  key={document.id}
                  style={[styles.documentRow, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
                >
                  <View style={styles.documentCopy}>
                    <View style={styles.documentBadges}>
                      <View
                        style={[
                          styles.documentTypeBadge,
                          {
                            backgroundColor: `${theme.primaryAccent}16`,
                            borderColor: `${theme.primaryAccent}34`,
                          },
                        ]}
                      >
                        <Text style={[styles.documentTypeBadgeText, { color: theme.primaryAccent }]}>
                          {t(getEmployeeDocumentTypeLabelKey(document.slug))}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.documentTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                      {document.fileName}
                    </Text>
                    <Text style={[styles.documentMeta, { color: theme.textSecondary }]}>
                      {`${formatEmployeeDocumentDateTime(document.createdAt, language)} • ${formatEmployeeDocumentFileSize(document.sizeBytes)}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.openButton, { borderColor: theme.borderSoft }]}
                    onPress={() => {
                      void handleDownloadDocument(document);
                    }}
                    disabled={openingDocumentId === document.id}
                  >
                    {openingDocumentId === document.id ? (
                      <ActivityIndicator size="small" color={theme.primaryAccent} />
                    ) : (
                      <Text style={[styles.openButtonLabel, { color: theme.primaryAccent }]}>
                        {t('certificateOfSicknessDownloadAction')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  overviewCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  overviewHeaderStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  overviewHeadingCopy: {
    flex: 1,
    gap: 6,
  },
  overviewEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  overviewBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overviewBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    gap: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitleGroup: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionMeta: {
    fontSize: 14,
    fontWeight: '600',
  },
  filePicker: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filePickerCopy: {
    flex: 1,
    gap: 4,
  },
  filePickerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  filePickerMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  typeOptions: {
    gap: 10,
  },
  typeOption: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  typeOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  stateBlock: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  filterTabs: {
    gap: 10,
    paddingBottom: 2,
  },
  filterTab: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterTabCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  documentList: {
    gap: 12,
  },
  documentRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentCopy: {
    flex: 1,
    gap: 4,
  },
  documentBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  documentTypeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  documentTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  documentMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  openButton: {
    minWidth: 96,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
