import { LayoutChangeEvent, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShiftCard } from '@shared/components/ShiftCard';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useShiftFeed } from '@features/shifts/useShiftFeed';
import { confirmShiftAssignment } from '@features/shifts/shiftsService';
import { getShiftPhase } from '@shared/utils/shiftPhase';
import { useLanguage } from '@shared/context/LanguageContext';
import { useRouter } from 'expo-router';

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
  const { orderedShifts, isLoading, error, refetch } = useShiftFeed();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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

  const showSkeletons = isLoading && !orderedShifts.length && !error;

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

  return (
    <View style={styles.container}>
      <View style={styles.headerWrapper}>
        <Text style={styles.headerTitle}>{`${t('upcomingShifts')} · ${monthLabel}`}</Text>
      </View>
      {errorView}
      <ScrollView
        ref={listScrollRef}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
      >
        {showSkeletons && renderSkeletons()}
        {!error &&
          orderedShifts.map((shift) => (
            <View key={shift.id} onLayout={handleShiftLayout(shift.id)}>
              <ShiftCard
                shift={shift}
                phase={getShiftPhase(shift.start, shift.end, now)}
                isPrimary={shift.id === focusedShiftId}
                onPress={() => router.push(`/shift-details/${shift.id}`)}
                onConfirm={shift.assignmentId ? () => handleConfirm(shift.assignmentId) : undefined}
                confirmLoading={shift.assignmentId ? confirmingId === shift.assignmentId : false}
              />
            </View>
          ))}
        {!error && !orderedShifts.length && !isLoading && renderListEmptyState()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  headerWrapper: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 24,
    paddingTop: 2,
    flexGrow: 1,
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 10,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },
  listEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: 260,
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
    backgroundColor: '#eef2ff',
    marginBottom: 12,
    padding: 16,
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonLineShort: {
    height: 12,
    width: '60%',
    backgroundColor: '#dbeafe',
    borderRadius: 6,
  },
});
