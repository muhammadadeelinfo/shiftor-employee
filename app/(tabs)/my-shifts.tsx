import {
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
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const isTabletLandscape = isLargeTablet && width > height;
  const showTabletGrid = isTabletLandscape && width >= 1180;
  const horizontalPadding = isTablet ? 20 : layoutTokens.screenHorizontal;
  const { orderedShifts, isLoading, error, refetch } = useShiftFeed();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
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
  }, [nextShift, t]);

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

  const renderListEmptyState = () => (
    <View style={styles.listEmptyState}>
      <Text style={styles.emptyTitle}>{t('listEmptyTitle', { month: monthLabel })}</Text>
      <Text style={styles.emptySubtitle}>{t('listEmptySubtitle')}</Text>
      <PrimaryButton title={t('refreshShifts')} onPress={() => refetch()} style={styles.emptyAction} />
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
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length) {
        console.error('Confirm all shifts failed', {
          failed: rejected.length,
          total: results.length,
        });
      }
      await refetch();
    } finally {
      setConfirmingAll(false);
    }
  }, [confirmingAll, pendingAssignmentIds, refetch]);

  useEffect(() => {
    shiftLayouts.current.clear();
    lastAutoScrolledShiftId.current = null;
    setLayoutTick((tick) => tick + 1);
  }, [orderedShifts.length]);

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
          </View>
          <View style={styles.pageHeaderMetaRow}>
            <Text style={[styles.pageHeaderSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {nextShiftLabel}
            </Text>
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
  pageHeaderSubtitle: {
    flex: 1,
    fontSize: 12,
    marginTop: 0,
    fontWeight: '500',
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
