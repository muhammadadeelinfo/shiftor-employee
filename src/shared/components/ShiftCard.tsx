import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { GestureResponderEvent } from 'react-native';
import type { Shift } from '@features/shifts/shiftsService';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useLanguage, type TranslationKey } from '@shared/context/LanguageContext';
import {
  getShiftConfirmationStatusLabel,
  normalizeShiftConfirmationStatus,
} from '@lib/shiftConfirmationStatus';
import { getShiftPhase, phaseMeta } from '@shared/utils/shiftPhase';
import { openAddressInMaps } from '@shared/utils/maps';
import { useTheme } from '@shared/themeContext';

const statusColors: Record<string, string> = {
  scheduled: '#2563eb',
  'in-progress': '#059669',
  completed: '#6b7280',
  blocked: '#dc2626',
};

const statusIconMap: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  scheduled: 'time-outline',
  'in-progress': 'play-outline',
  completed: 'checkmark-done-outline',
  blocked: 'alert-circle-outline',
};

const statusLabelTranslationKeys: Record<string, TranslationKey | undefined> = {
  scheduled: 'statusScheduled',
  'in-progress': 'statusInProgress',
  completed: 'statusCompleted',
  blocked: 'statusBlocked',
};

const formatTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatDate = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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

const truncateText = (value: string, maxLength = 36) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
};

const simplifyAddress = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const segments = normalized
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) return '';
  if (segments.length <= 2) return segments.join(', ');
  return `${segments.slice(0, 2).join(', ')}…`;
};

type Props = {
  shift: Shift;
  onPress?: () => void;
  onConfirm?: () => void;
  confirmLoading?: boolean;
  isPrimary?: boolean;
};

export const ShiftCard = ({
  shift,
  onPress,
  onConfirm,
  confirmLoading,
  isPrimary,
}: Props) => {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const gradientColors: [string, string] = [theme.heroGradientStart, theme.heroGradientEnd];
  const statusColor = statusColors[shift.status] ?? '#1d4ed8';
  const statusTranslationKey = statusLabelTranslationKeys[shift.status];
  const statusLabel = statusTranslationKey ? t(statusTranslationKey) : shift.status;
  const locationLabel = shift.objectName ?? shift.location ?? 'TBD';
  const locationSubtext = shift.objectAddress ?? shift.location;
  const displayedAddress = locationSubtext
    ? showFullAddress
      ? locationSubtext
      : truncateText(simplifyAddress(locationSubtext), 50)
    : t('locationTbd');
  const normalizedConfirmationStatus = normalizeShiftConfirmationStatus(shift.confirmationStatus);
  const isConfirmed =
    normalizedConfirmationStatus === 'confirmed' ||
    normalizedConfirmationStatus === 'confirmed by employee';
  const confirmationLabel = getShiftConfirmationStatusLabel(normalizedConfirmationStatus);
  const shiftPhase = getShiftPhase(shift.start, shift.end);
  const phaseMetadata = phaseMeta[shiftPhase];
  const phaseGradientColors: [string, string, ...string[]] = [
    `${phaseMetadata.color}20`,
    `${phaseMetadata.color}70`,
    phaseMetadata.color,
  ];

  const accentBorder = `${theme.primary}33`;
  const statusGradientColors: [string, string, ...string[]] = [
    `${statusColor}33`,
    `${statusColor}99`,
    statusColor,
  ];
  const statusIcon = statusIconMap[shift.status];
  const handleOpenMaps = (event: GestureResponderEvent) => {
    event.stopPropagation();
    openAddressInMaps(locationSubtext);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isPrimary ? accentBorder : theme.borderSoft,
          shadowColor: isPrimary ? theme.primaryAccent : '#000',
        },
        pressed && styles.cardPressed,
        isPrimary && styles.primaryOutline,
      ]}
      onPress={onPress}
      android_ripple={{ color: theme.primary }}
      accessibilityRole="button"
      accessibilityState={{ selected: isPrimary }}
    >
      <View style={[styles.decoration, { backgroundColor: theme.primary }]} />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
        pointerEvents="none"
      />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.headerLabelRow}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={theme.primary}
                style={styles.headerIcon}
              />
              <Text style={[styles.cardLabel, { color: theme.textPrimary }]}>
                {t('upcomingShiftListTitle')}
              </Text>
            </View>
            <Text style={[styles.cardDate, { color: theme.textSecondary }]}>{formatDate(shift.start)}</Text>
            <View style={styles.phaseRow}>
              <LinearGradient
                colors={phaseGradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.phaseBadge, { backgroundColor: phaseMetadata.color }]}
              >
                <Ionicons
                  name={phaseMetadata.icon as ComponentProps<typeof Ionicons>['name']}
                  size={14}
                  color="#fff"
                  style={styles.phaseIcon}
                />
                <Text style={styles.phaseBadgeText}>{phaseMetadata.label}</Text>
              </LinearGradient>
            </View>
          </View>
          <LinearGradient
            colors={statusGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: statusColor }]}
          >
            {statusIcon ? (
              <Ionicons name={statusIcon} size={14} color="#fff" style={styles.statusIcon} />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: '#fff' }]} />
            )}
            <Text style={[styles.statusText, { color: '#fff' }]}>{statusLabel}</Text>
          </LinearGradient>
        </View>

        <View style={styles.sectionSpacer}>
          <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>{t('shiftWindowLabel')}</Text>
          <View style={styles.timeRow}>
            <View style={styles.timePart}>
              <Text style={[styles.timeValue, { color: theme.textPrimary }]}>{formatTime(shift.start)}</Text>
              <Text style={[styles.timeLabelSmall, { color: theme.textSecondary }]}>{t('shiftStartLabel')}</Text>
            </View>
            <View style={styles.timePart}>
              <Text style={[styles.timeValue, { color: theme.textPrimary }]}>{formatTime(shift.end)}</Text>
              <Text style={[styles.timeLabelSmall, { color: theme.textSecondary }]}>{t('shiftEndLabel')}</Text>
            </View>
            <View style={[styles.durationContainer, styles.timePartRight]}>
              <Text style={[styles.duration, { color: theme.textSecondary }]}>{formatDuration(shift.start, shift.end)}</Text>
              <Text style={[styles.timeLabelSmall, { color: theme.textSecondary }]}>· {t('shiftDuration')}</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[
            styles.locationRow,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            },
          ]}
          onPress={() => setShowFullAddress((prev) => !prev)}
          disabled={!locationSubtext}
          accessibilityRole="button"
        >
          <Ionicons name="location-outline" size={20} color={theme.info} style={styles.locationIcon} />
          <View style={styles.locationText}>
            <Text style={[styles.locationLabel, { color: theme.textPrimary }]}>{locationLabel}</Text>
            <Text
              style={[styles.locationDetails, { color: theme.textSecondary }]}
              numberOfLines={showFullAddress ? 2 : 1}
            >
              {displayedAddress}
            </Text>
          </View>
          {locationSubtext && (
            <View style={styles.locationActions}>
              <Pressable
                onPress={handleOpenMaps}
                accessibilityRole="button"
                accessibilityLabel={t('openInMaps')}
                style={({ pressed }) => [
                  styles.mapIconButton,
                  { backgroundColor: theme.surface },
                  pressed && styles.mapIconButtonPressed,
                ]}
                hitSlop={8}
              >
                <Ionicons name="map-outline" size={16} color={theme.info} />
              </Pressable>
              <Ionicons
                name={showFullAddress ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={18}
                color={theme.textSecondary}
              />
            </View>
          )}
        </Pressable>

        <Text style={[styles.description, { color: theme.textSecondary }]}>{shift.description ?? t('beOnTime')}</Text>

        <View style={styles.confirmSection}>
          <View>
            <Text style={[styles.confirmInstruction, { color: theme.textSecondary }]}>{t('beOnTime')}</Text>
            <Text style={[styles.confirmSubLabel, { color: theme.textPrimary }]}>{t('confirmShift')}</Text>
          </View>
          {isConfirmed ? (
            <Text style={[styles.confirmedTextOption, { color: theme.success }]}>{confirmationLabel}</Text>
          ) : (
            onConfirm && (
              <PrimaryButton
                title={t('confirmShift')}
                onPress={onConfirm}
                loading={confirmLoading}
                style={styles.confirmButton}
              />
            )
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7ef',
    position: 'relative',
  },
  cardPressed: {
    opacity: 0.95,
  },
  primaryOutline: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  decoration: {
    width: 6,
    backgroundColor: '#dbeafe',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    zIndex: 0,
    borderRadius: 26,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 18,
    position: 'relative',
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 6,
  },
  cardDate: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 110,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statusIcon: {
    marginRight: 6,
  },
  phaseRow: {
    marginTop: 6,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 110,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  phaseIcon: {
    marginRight: 8,
  },
  timeLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  timeLabelSmall: {
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  sectionSpacer: {
    marginTop: 10,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    alignItems: 'flex-end',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  duration: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  durationContainer: {
    alignItems: 'flex-end',
  },
  timePart: {
    flex: 1,
  },
  timePartRight: {
    alignItems: 'flex-end',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#f7f8ff',
    borderWidth: 1,
    borderColor: '#e5e7ef',
  },
  locationIcon: {
    marginRight: 10,
  },
  locationText: {
    flex: 1,
  },
  locationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  mapIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapIconButtonPressed: {
    opacity: 0.75,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  locationDetails: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  description: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    color: '#4b5563',
    minHeight: 30,
  },
  confirmSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingBottom: 2,
  },
  confirmInstruction: {
    textTransform: 'uppercase',
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  confirmSubLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  confirmedTextOption: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  confirmButton: {
    paddingHorizontal: 22,
    borderRadius: 22,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 5,
  },
});
