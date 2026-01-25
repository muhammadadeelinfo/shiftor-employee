import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import type { Shift } from '@features/shifts/shiftsService';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { ShiftPhase, phaseMeta } from '@shared/utils/shiftPhase';

const statusColors: Record<string, string> = {
  scheduled: '#2563eb',
  'in-progress': '#059669',
  completed: '#6b7280',
  blocked: '#dc2626',
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
  phase: ShiftPhase;
  isPrimary?: boolean;
};

export const ShiftCard = ({
  shift,
  onPress,
  onConfirm,
  confirmLoading,
  phase: shiftPhase,
  isPrimary,
}: Props) => {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const phaseConfig = phaseMeta[shiftPhase];
  const statusColor = statusColors[shift.status] ?? '#1d4ed8';
  const locationLabel = shift.objectName ?? shift.location ?? 'TBD';
  const locationSubtext = shift.objectAddress ?? shift.location;
  const addressPreview = simplifyAddress(locationSubtext ?? '');
  const displayedAddress =
    locationSubtext && showFullAddress ? locationSubtext : truncateText(addressPreview || '', 48);
  const isLive = shiftPhase === 'live';

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isLive) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => animation?.stop();
  }, [isLive, pulseAnim]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.accentContainer}>
        <View
          style={[
            styles.accent,
            isPrimary && { backgroundColor: phaseConfig.color },
            isPrimary && styles.accentActive,
          ]}
        />
        {isPrimary && <View style={[styles.accentDot, { backgroundColor: phaseConfig.color }]} />}
      </View>
      <View style={styles.body}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.title}>{shift.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{formatDate(shift.start)}</Text>
              <Text style={styles.metaSeparator}>·</Text>
              <Text style={styles.metaText}>
                {formatTime(shift.start)} – {formatTime(shift.end)}
              </Text>
            </View>
          </View>
          <View style={styles.statusBlock}>
            <View style={[styles.statusBadge, { borderColor: statusColor }]}>
              <Animated.View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColor },
                  isLive && { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>{shift.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.phaseInline}>{phaseConfig.label}</Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <View>
            <Text style={styles.timeLabel}>Shift window</Text>
            <Text style={styles.timeValue}>
              {formatTime(shift.start)} – {formatTime(shift.end)}
            </Text>
          </View>
          <Text style={styles.duration}>{formatDuration(shift.start, shift.end)}</Text>
        </View>

        <Pressable
          style={styles.locationRow}
          onPress={() => locationSubtext && setShowFullAddress((prev) => !prev)}
          disabled={!locationSubtext}
        >
          <View style={styles.locationIcon}>
            <Ionicons name="location-outline" size={18} color="#2563eb" />
          </View>
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>{locationLabel}</Text>
            {locationSubtext ? (
              <Text
                style={[styles.locationDetails, !showFullAddress && styles.locationDetailsClipped]}
                numberOfLines={showFullAddress ? undefined : 1}
              >
                {displayedAddress}
              </Text>
            ) : (
              <Text style={styles.locationDetails}>Location TBD</Text>
            )}
          </View>
          {locationSubtext ? (
            <Ionicons
              name={showFullAddress ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={18}
              color="#6b7280"
            />
          ) : null}
        </Pressable>

        {shift.description ? <Text style={styles.description}>{shift.description}</Text> : null}

        {shift.assignmentId && (
          <View style={styles.confirmSection}>
            <Text style={styles.confirmInstruction}>Be On Time</Text>
            {shift.confirmationStatus?.toLowerCase() === 'confirmed' ? (
              <Text style={styles.confirmedText}>Confirmed</Text>
            ) : (
              onConfirm && (
                <PrimaryButton
                  title="Confirm shift"
                  onPress={onConfirm}
                  loading={confirmLoading}
                  style={styles.confirmButton}
                />
              )
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
  },
  accentContainer: {
    width: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  accent: {
    width: 5,
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
  },
  accentActive: {
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 6,
    elevation: 4,
  },
  accentDot: {
    position: 'absolute',
    bottom: 8,
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  metaSeparator: {
    marginHorizontal: 6,
    fontSize: 14,
    color: '#cbd5f5',
  },
  statusBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  phaseInline: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  timeLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 2,
  },
  duration: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#f3f4ff',
  },
  locationIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationText: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  locationDetails: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  locationDetailsClipped: {
    opacity: 0.8,
  },
  description: {
    marginTop: 10,
    fontSize: 13,
    color: '#4b5563',
  },
  confirmSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  confirmInstruction: {
    textTransform: 'uppercase',
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  confirmedText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    paddingHorizontal: 18,
  },
});
