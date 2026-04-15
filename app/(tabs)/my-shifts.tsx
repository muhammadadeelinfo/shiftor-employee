import {
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ShiftCard } from '@shared/components/ShiftCard';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useShiftFeed } from '@features/shifts/useShiftFeed';
import { confirmShiftAssignment } from '@features/shifts/shiftsService';
import { normalizeShiftConfirmationStatus } from '@lib/shiftConfirmationStatus';
import { getShiftPhase } from '@shared/utils/shiftPhase';
import { useLanguage } from '@shared/context/LanguageContext';
import { useRouter } from 'expo-router';
import { useTheme } from '@shared/themeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { layoutTokens } from '@shared/theme/layout';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@hooks/useSupabaseAuth';
import { buildShiftPlanCalendarContent, buildShiftPlanFileName } from '@shared/utils/shiftPlanExport';

const getMonthLabel = (date: Date) => date.toLocaleDateString([], { month: 'long', year: 'numeric' });

const renderSkeletons = () => (
  <View style={styles.skeletonContainer}>
    {Array.from({ length: 3 }).map((_, index) => (
      <View key={`skeleton-${index}`} style={styles.skeletonCard}>
        <View style={styles.skeletonLine} />
        <View style={styles.skeletonLineShort} />
      </View>
    ))}
  </View>
);

export default function MyShiftsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const isTabletLandscape = isLargeTablet && width > height;
  const showTabletGrid = isTabletLandscape && width >= 1180;
  const horizontalPadding = isTablet ? 20 : layoutTokens.screenHorizontal;
  const isGuest = !user;
  const { orderedShifts, isLoading, error, refetch } = useShiftFeed();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [isExportingPlan, setIsExportingPlan] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);
  const listScrollRef = useRef<ScrollView>(null);
  const shiftLayouts = useRef(new Map<string, number>());
  const lastAutoScrolledShiftId = useRef<string | null>(null);

  const now = new Date();
  const liveShift = orderedShifts.find((shift) => getShiftPhase(shift.start, shift.end, now) === 'live');
  const nextShift = orderedShifts.find((shift) => new Date(shift.start) > now);
  const focusedShiftId = liveShift?.id ?? nextShift?.id;

  const referenceShift = orderedShifts.find((shift) => shift.id === focusedShiftId) ?? orderedShifts[0];
  const referenceMonth = referenceShift ? new Date(referenceShift.start) : now;
  const monthLabel = getMonthLabel(referenceMonth);
  const nextShiftLabel = useMemo(() => {
    if (isGuest) {
      return t('shiftsGuestSubtitle');
    }
    if (!nextShift) {
      return t('noUpcomingShifts');
    }
    const start = new Date(nextShift.start);
    if (Number.isNaN(start.getTime())) {
      return t('nextShift');
    }
    const dateText = start.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeText = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${t('nextShift')}: ${dateText} · ${timeText}`;
  }, [isGuest, nextShift, t]);

  const showSkeletons = isLoading && !orderedShifts.length && !error;
  const pendingAssignmentIds = useMemo(
    () =>
      orderedShifts
        .filter((shift) => {
          if (!shift.assignmentId) return false;
          const normalized = normalizeShiftConfirmationStatus(shift.confirmationStatus);
          return normalized === 'published';
        })
        .map((shift) => shift.assignmentId as string),
    [orderedShifts]
  );
  const pendingAssignmentIdSet = useMemo(
    () => new Set(pendingAssignmentIds),
    [pendingAssignmentIds]
  );
  const shiftIdentityKey = useMemo(
    () => orderedShifts.map((shift) => `${shift.id}:${shift.start}:${shift.end}`).join('|'),
    [orderedShifts]
  );

  const renderListEmptyState = () => (
    <View style={styles.listEmptyState}>
      {isGuest ? (
        <View
          style={[
            styles.guestCard,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.borderSoft,
            },
          ]}
        >
          <View style={[styles.guestBadge, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
            <Ionicons name="flash-outline" size={13} color={theme.primary} />
            <Text style={[styles.guestBadgeText, { color: theme.primary }]}>{t('shiftsGuestEyebrow')}</Text>
          </View>
          <View style={[styles.guestOrb, { backgroundColor: theme.primaryAccent }]}>
            <Ionicons name="sparkles-outline" size={20} color={theme.surface} />
          </View>
          <Text style={[styles.guestTitle, { color: theme.textPrimary }]}>{t('shiftsGuestTitle')}</Text>
          <Text style={[styles.guestBody, { color: theme.textSecondary }]}>{t('shiftsGuestBody')}</Text>
          <View style={styles.guestMetricRow}>
            {[
              { value: 'Live', label: t('shiftsGuestStatLive') },
              { value: '<1m', label: t('shiftsGuestStatReplies') },
              { value: 'QR', label: t('shiftsGuestStatReady') },
            ].map((item) => (
              <View
                key={item.label}
                style={[
                  styles.guestMetric,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                ]}
              >
                <Text style={[styles.guestMetricValue, { color: theme.textPrimary }]}>{item.value}</Text>
                <Text style={[styles.guestMetricLabel, { color: theme.textSecondary }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.guestChipRow}>
            {[t('shiftsGuestChipLive'), t('shiftsGuestChipCalendar'), t('shiftsGuestChipClockIn')].map((chip) => (
              <View
                key={chip}
                style={[
                  styles.guestChip,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                ]}
              >
                <Text style={[styles.guestChipText, { color: theme.textPrimary }]}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.emptyTitle}>{t('listEmptyTitle', { month: monthLabel })}</Text>
          <Text style={styles.emptySubtitle}>{t('listEmptySubtitle')}</Text>
          <PrimaryButton title={t('refreshShifts')} onPress={() => refetch()} style={styles.emptyAction} />
        </>
      )}
    </View>
  );

  const handleShiftLayout = useCallback(
    (shiftId: string) => (event: LayoutChangeEvent) => {
      shiftLayouts.current.set(shiftId, event.nativeEvent.layout.y);
      setLayoutTick((tick) => tick + 1);
    },
    []
  );

  const handleConfirm = useCallback(
    async (assignmentId: string) => {
      try {
        setConfirmingId(assignmentId);
        await confirmShiftAssignment(assignmentId);
        await refetch();
      } catch (error) {
        console.error('Shift confirmation failed', error);
      } finally {
        setConfirmingId((current) => (current === assignmentId ? null : current));
      }
    },
    [refetch]
  );

  const handleConfirmAll = useCallback(async () => {
    if (!pendingAssignmentIds.length || confirmingAll) return;
    try {
      setConfirmingAll(true);
      const results = await Promise.allSettled(
        pendingAssignmentIds.map((assignmentId) => confirmShiftAssignment(assignmentId))
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length) {
        console.error('Confirm all shifts failed', {
          failed: rejected.length,
          total: results.length,
        });
      }
      await refetch();
      if (!rejected.length) {
        Alert.alert(
          t('confirmAllShiftsResultTitle'),
          t('confirmAllShiftsResultSuccessBody', { count: succeeded })
        );
      } else if (succeeded > 0) {
        Alert.alert(
          t('confirmAllShiftsResultTitle'),
          t('confirmAllShiftsResultPartialBody', {
            successCount: succeeded,
            failedCount: rejected.length,
          })
        );
      } else {
        Alert.alert(
          t('confirmAllShiftsResultTitle'),
          t('confirmAllShiftsResultFailureBody')
        );
      }
    } finally {
      setConfirmingAll(false);
    }
  }, [confirmingAll, pendingAssignmentIds, refetch, t]);

  const handleExportShiftPlan = useCallback(async () => {
    if (isExportingPlan) return;
    if (!orderedShifts.length) {
      Alert.alert(t('shiftPlanExportTitle'), t('shiftPlanExportEmptyBody'));
      return;
    }

    setIsExportingPlan(true);
    try {
      const directory = FileSystem.documentDirectory;
      if (!directory) {
        throw new Error('Document directory unavailable');
      }

      const fileName = buildShiftPlanFileName(orderedShifts);
      const fileUri = `${directory}${fileName}`;
      const content = buildShiftPlanCalendarContent(orderedShifts);

      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/calendar',
          dialogTitle: t('shiftPlanExportAction'),
          UTI: 'public.ics',
        });
      }

      Alert.alert(
        t('shiftPlanExportTitle'),
        t('shiftPlanExportSuccessBody', {
          path: fileUri.replace(directory, 'Files/'),
        })
      );
    } catch (error) {
      console.error('Failed to export shift plan', error);
      Alert.alert(t('shiftPlanExportTitle'), t('shiftPlanExportFailedBody'));
    } finally {
      setIsExportingPlan(false);
    }
  }, [isExportingPlan, orderedShifts, t]);

  useEffect(() => {
    shiftLayouts.current.clear();
    lastAutoScrolledShiftId.current = null;
    setLayoutTick((tick) => tick + 1);
  }, [shiftIdentityKey]);

  useEffect(() => {
    if (!focusedShiftId) return;
    if (lastAutoScrolledShiftId.current === focusedShiftId) return;
    const targetOffset = shiftLayouts.current.get(focusedShiftId);
    if (targetOffset === undefined) return;
    listScrollRef.current?.scrollTo({ y: Math.max(targetOffset - 12, 0), animated: true });
    lastAutoScrolledShiftId.current = focusedShiftId;
  }, [focusedShiftId, layoutTick]);

  const errorView = error ? (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{t('shiftSyncFailedTitle')}</Text>
      <Text style={styles.errorText}>{t('shiftSyncFailedMessage')}</Text>
      <PrimaryButton title={t('retrySync')} onPress={() => refetch()} style={styles.retryButton} />
    </View>
  ) : null;

  const containerStyle = [
    styles.container,
    {
      backgroundColor: theme.background,
      paddingTop: layoutTokens.screenTop,
      paddingHorizontal: horizontalPadding,
    },
  ];
  const listContentStyle = [styles.list, { backgroundColor: theme.background }];
  const shiftRows = useMemo(() => {
    if (!showTabletGrid) return [];
    const rows: (typeof orderedShifts)[] = [];
    for (let index = 0; index < orderedShifts.length; index += 2) {
      rows.push(orderedShifts.slice(index, index + 2));
    }
    return rows;
  }, [orderedShifts, showTabletGrid]);

  const renderShiftCard = useCallback(
    (shift: (typeof orderedShifts)[number]) => {
      const assignmentId = shift.assignmentId;
      return (
        <View key={shift.id} onLayout={handleShiftLayout(shift.id)} style={showTabletGrid ? styles.gridCard : null}>
          <ShiftCard
            shift={shift}
            isPrimary={shift.id === focusedShiftId}
            onPress={() =>
              router.push({
                pathname: `/shift-details/${shift.id}`,
                params: { from: 'shifts' },
              })
            }
            onConfirm={assignmentId ? () => handleConfirm(assignmentId) : undefined}
            confirmLoading={
              assignmentId
                ? confirmingId === assignmentId || (confirmingAll && pendingAssignmentIdSet.has(assignmentId))
                : false
            }
          />
        </View>
      );
    },
    [
      confirmingAll,
      confirmingId,
      focusedShiftId,
      handleConfirm,
      handleShiftLayout,
      pendingAssignmentIdSet,
      router,
      showTabletGrid,
    ]
  );

  return (
    <SafeAreaView style={containerStyle} edges={['left', 'right']}>
      <View style={styles.contentFrame}>
        <View
          style={[
            styles.pageHeader,
            isLargeTablet && styles.pageHeaderTablet,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}
        >
          <View style={styles.pageHeaderTopRow}>
            <Text style={[styles.pageHeaderTitle, { color: theme.textPrimary }]}>{t('shiftOverview')}</Text>
            {!isGuest ? (
              <TouchableOpacity
                onPress={() => {
                  void handleExportShiftPlan();
                }}
                disabled={isExportingPlan}
                activeOpacity={0.9}
                style={[
                  styles.exportAction,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSoft,
                  },
                  isExportingPlan && styles.exportActionDisabled,
                ]}
              >
                {isExportingPlan ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={14} color={theme.primary} />
                    <Text style={[styles.exportActionText, { color: theme.textPrimary }]}>
                      {t('shiftPlanExportAction')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.pageHeaderMetaRow}>
            <Text style={[styles.pageHeaderSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {nextShiftLabel}
            </Text>
            <View style={styles.headerActionsRow}>
              {pendingAssignmentIds.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    void handleConfirmAll();
                  }}
                  disabled={confirmingAll}
                  activeOpacity={0.9}
                  style={[
                    styles.confirmAllAction,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.borderSoft,
                    },
                    confirmingAll && styles.confirmAllActionDisabled,
                  ]}
                >
                  {confirmingAll ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-outline" size={13} color={theme.primary} />
                      <Text
                        style={[
                          styles.confirmAllActionText,
                          isTabletLandscape && styles.confirmAllActionTextTablet,
                          { color: theme.textPrimary },
                        ]}
                      >
                        {t('confirmAllShiftsShort')}
                      </Text>
                      <View style={[styles.confirmAllCountBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.confirmAllCountText}>{pendingAssignmentIds.length}</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
        {errorView}
        <ScrollView
          ref={listScrollRef}
          contentContainerStyle={listContentStyle}
          style={[styles.scrollView, { backgroundColor: theme.background }]}
          contentInsetAdjustmentBehavior="never"
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
        >
          {showSkeletons && renderSkeletons()}
          {!error &&
            (showTabletGrid
              ? shiftRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.gridRow}>
                    {row.map((shift) => renderShiftCard(shift))}
                    {row.length === 1 ? <View style={styles.gridSpacer} /> : null}
                  </View>
                ))
              : orderedShifts.map((shift) => renderShiftCard(shift)))}
          {!error && !orderedShifts.length && !isLoading && renderListEmptyState()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 0,
    paddingBottom: 0,
    alignItems: 'center',
  },
  contentFrame: {
    flex: 1,
    width: '100%',
  },
  list: {
    paddingBottom: 24,
    paddingTop: 0,
    flexGrow: 1,
  },
  pageHeader: {
    borderWidth: 1,
    borderRadius: layoutTokens.cardRadiusMd,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: layoutTokens.sectionGap,
  },
  pageHeaderTablet: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pageHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pageHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pageHeaderMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageHeaderSubtitle: {
    flex: 1,
    fontSize: 12,
    marginTop: 0,
    fontWeight: '500',
  },
  exportAction: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportActionDisabled: {
    opacity: 0.78,
  },
  exportActionText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  confirmAllAction: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  confirmAllActionDisabled: {
    opacity: 0.8,
  },
  confirmAllActionText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  confirmAllActionTextTablet: {
    fontSize: 11,
  },
  confirmAllCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  confirmAllCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  scrollView: {
    borderTopLeftRadius: layoutTokens.cardRadiusLg,
    borderTopRightRadius: layoutTokens.cardRadiusLg,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
  },
  gridSpacer: {
    flex: 1,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: layoutTokens.sectionGap,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 4,
  },
  errorText: {
    color: '#f97316',
    fontSize: 14,
    marginBottom: 10,
  },
  retryButton: {
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  listEmptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  guestCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 8,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  guestBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  guestOrb: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  guestBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  guestMetricRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginTop: 16,
    marginBottom: 2,
  },
  guestMetric: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  guestMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  guestMetricLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  guestChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 4,
  },
  guestChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  guestChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyAction: {
    minWidth: 180,
  },
  skeletonContainer: {
    marginBottom: 12,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 20,
    backgroundColor: '#111a34',
    marginBottom: 12,
    padding: 16,
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#1f263d',
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonLineShort: {
    height: 12,
    width: '60%',
    backgroundColor: '#1f263d',
    borderRadius: 6,
  },
});
