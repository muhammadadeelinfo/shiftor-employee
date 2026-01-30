'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@lib/supabaseClient';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useRouter } from 'expo-router';

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
  category: NotificationCategory;
  metadata?: Record<string, unknown>;
  targetPath?: string;
};

type NotificationContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

type NotificationCategory =
  | 'shift-published'
  | 'shift-removed'
  | 'shift-schedule'
  | 'admin'
  | 'general';

const categoryMeta: Record<
  NotificationCategory,
  { label: string; color: string; background: string }
> = {
  'shift-published': {
    label: 'Shift published',
    color: '#0ea5e9',
    background: 'rgba(14,165,233,0.15)',
  },
  'shift-removed': {
    label: 'Shift removed',
    color: '#f97316',
    background: 'rgba(249,115,22,0.12)',
  },
  'shift-schedule': {
    label: 'Schedule changed',
    color: '#facc15',
    background: 'rgba(250,204,21,0.15)',
  },
  admin: {
    label: 'Admin message',
    color: '#a855f7',
    background: 'rgba(168,85,247,0.15)',
  },
  general: {
    label: 'General',
    color: '#94a3b8',
    background: 'rgba(148,163,184,0.12)',
  },
};

const determineNotificationCategory = (title: string, detail: string): NotificationCategory => {
  const normalized = `${title} ${detail}`.toLowerCase();
  if (normalized.includes('published') || normalized.includes('assigned') || normalized.includes('new shift')) {
    return 'shift-published';
  }
  if (normalized.includes('removed') || normalized.includes('canceled') || normalized.includes('cancelled')) {
    return 'shift-removed';
  }
  if (normalized.includes('schedule') || normalized.includes('updated') || normalized.includes('changed')) {
    return 'shift-schedule';
  }
  if (
    normalized.includes('admin') ||
    normalized.includes('policy') ||
    normalized.includes('message') ||
    normalized.includes('announcement')
  ) {
    return 'admin';
  }
  return 'general';
};

const normalizeString = (value?: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const resolveTargetPath = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;
  const directTarget = normalizeString(metadata.target ?? metadata.url ?? metadata.deepLink);
  if (directTarget) return directTarget;
  const shiftId = normalizeString(
    metadata.shiftId ?? metadata.shift_id ?? metadata.assignmentId ?? metadata.assignment_id
  );
  if (shiftId) {
    return `/shift-details/${shiftId}`;
  }
  return undefined;
};

const createFallbackNotifications = (): NotificationItem[] => {
  const now = Date.now();
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60 * 1000).toISOString();
  return [
    {
      id: 'shift-reminder',
      title: 'Shift Reminder',
      detail: '8:00 AM – Lobby Coverage',
      createdAt: minutesAgo(2),
      read: false,
      category: 'shift-schedule',
      metadata: { target: '/my-shifts' },
      targetPath: '/my-shifts',
    },
    {
      id: 'policy-update',
      title: 'New QR Policy',
      detail: 'Review QR clock-in steps before your next shift.',
      createdAt: minutesAgo(40),
      read: false,
      category: 'admin',
    },
    {
      id: 'weekend-rota',
      title: 'Weekend rota',
      detail: 'Open unpaid weekend bids are live now.',
      createdAt: minutesAgo(26 * 60),
      read: true,
      category: 'general',
    },
  ];
};

const parseIsoDate = (value?: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
};

const normalizeNotificationRow = (row: Record<string, unknown>): NotificationItem | null => {
  const rawId = row.id ?? row.notificationId ?? row.notification_id;
  if (rawId === undefined || rawId === null) return null;
  const titleCandidate =
    (typeof row.title === 'string' && row.title.trim()) ||
    (typeof row.message === 'string' && row.message.trim());
  const detailCandidate =
    (typeof row.detail === 'string' && row.detail.trim()) ||
    (typeof row.body === 'string' && row.body.trim()) ||
    (typeof row.description === 'string' && row.description.trim());
  const normalizedTitle = titleCandidate ?? 'Notification';
  const normalizedDetail = detailCandidate ?? 'Tap to see the latest update.';
  const createdAt = parseIsoDate(
    row.created_at ?? row.createdAt ?? row.sent_at ?? row.timestamp ?? row.time
  );
  const read = Boolean(
    row.is_read ?? row.read ?? row.viewed ?? row.dismissed ?? row.status === 'read'
  );
  const category = determineNotificationCategory(normalizedTitle, normalizedDetail);
  const metadata = (row.metadata ?? row.meta ?? row.data ?? row.payload ?? row.context) as
    | Record<string, unknown>
    | undefined;
  const targetPath = resolveTargetPath(metadata);
  return {
    id: String(rawId),
    title: normalizedTitle,
    detail: normalizedDetail,
    createdAt,
    read,
    category,
    metadata,
    targetPath,
  };
};

const getRelativeTimeLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  if (Math.abs(diff) < minute) return 'just now';
  if (diff < 0) return 'coming soon';
  if (diff < minute * 60) return `${Math.round(diff / minute)}m ago`;
  if (diff < minute * 60 * 24) return `${Math.round(diff / (minute * 60))}h ago`;
  return `${Math.round(diff / (minute * 60 * 24))}d ago`;
};

const areSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

type NotificationSectionKey = 'today' | 'yesterday' | 'earlier';

const sectionLabels: Record<NotificationSectionKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
};

const groupNotificationsByRecency = (notifications: NotificationItem[]): {
  key: NotificationSectionKey;
  title: string;
  items: NotificationItem[];
}[] => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const buckets: Record<NotificationSectionKey, NotificationItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  notifications.forEach((item) => {
    const created = new Date(item.createdAt);
    if (areSameDay(created, now)) {
      buckets.today.push(item);
    } else if (areSameDay(created, yesterday)) {
      buckets.yesterday.push(item);
    } else {
      buckets.earlier.push(item);
    }
  });

  return (['today', 'yesterday', 'earlier'] as NotificationSectionKey[])
    .map((key) => ({
      key,
      title: sectionLabels[key],
      items: buckets[key],
    }))
    .filter((section) => section.items.length > 0);
};

const tallyCategoryCounts = (notifications: NotificationItem[]) =>
  notifications.reduce<Record<NotificationCategory, number>>((acc, notification) => {
    acc[notification.category] = (acc[notification.category] ?? 0) + 1;
    return acc;
  }, {
    'shift-published': 0,
    'shift-removed': 0,
    'shift-schedule': 0,
    admin: 0,
    general: 0,
  });

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const router = useRouter();
  const employeeId = user?.id;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(createFallbackNotifications);
  const mountedRef = useRef(true);

  const loadNotifications = useCallback(async () => {
    if (!mountedRef.current) return;
    if (!supabase) {
      setNotifications(createFallbackNotifications());
      return;
    }

    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (employeeId) {
        query = query.eq('employeeId', employeeId);
      }

      const { data, error } = await query;

      if (!mountedRef.current) return;

      if (error) {
        throw error;
      }

      const normalized = (data ?? [])
        .map(normalizeNotificationRow)
        .filter((item): item is NotificationItem => Boolean(item));

      if (!normalized.length) {
        setNotifications(createFallbackNotifications());
        return;
      }

      setNotifications(normalized);
    } catch (error) {
      console.warn('Failed to load notifications', error);
      if (mountedRef.current) {
        setNotifications(createFallbackNotifications());
      }
    }
  }, [employeeId]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  const refresh = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const addNotification = useCallback(
    (
      entry: Omit<NotificationItem, 'id' | 'createdAt'> & {
        category?: NotificationCategory;
        metadata?: Record<string, unknown>;
        targetPath?: string;
      }
    ) => {
      setNotifications((prev) => [
        {
          id: `system-${Date.now()}`,
          title: entry.title,
          detail: entry.detail,
          createdAt: new Date().toISOString(),
          read: entry.read ?? false,
          category: entry.category ?? determineNotificationCategory(entry.title, entry.detail),
          metadata: entry.metadata,
          targetPath:
            entry.targetPath ?? (entry.metadata && resolveTargetPath(entry.metadata)),
        },
        ...prev,
      ]);
    },
    []
  );

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
    );

    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Failed to mark notification as read', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (!unreadIds.length) return;
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));

    if (!supabase) return;

    try {
      let query = supabase.from('notifications').update({ is_read: true });
      if (employeeId) {
        query = query.eq('employeeId', employeeId);
      }
      const { error } = await query.in('id', unreadIds);
      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Failed to mark notifications as read', error);
    }
  }, [notifications, employeeId]);

  useEffect(() => {
    mountedRef.current = true;
    loadNotifications();
    return () => {
      mountedRef.current = false;
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!supabase || !employeeId) return;
    const channel = supabase.channel(`notifications:${employeeId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `employeeId=eq.${employeeId}`,
      },
      () => {
        void loadNotifications();
      }
    );
    (async () => {
      try {
        await channel.subscribe();
      } catch (error) {
        console.warn('Failed to subscribe to notifications channel', error);
      }
    })();

    return () => {
      channel.unsubscribe();
    };
  }, [employeeId, loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const value = useMemo(
    () => ({
      open,
      toggle,
      close,
      notifications,
      unreadCount,
      markAllAsRead,
      refresh,
      addNotification,
    }),
    [open, toggle, close, notifications, unreadCount, markAllAsRead, refresh, addNotification]
  );

  const handleNotificationPress = useCallback(
    (item: NotificationItem) => {
      void markNotificationRead(item.id);
      if (item.targetPath) {
        setOpen(false);
        router.push(item.targetPath);
      }
    },
    [markNotificationRead, router]
  );

  const groupedSections = useMemo(() => groupNotificationsByRecency(notifications), [notifications]);
  const categoryCounts = useMemo(() => tallyCategoryCounts(notifications), [notifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {open && (
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>Notifications</Text>
                <Text style={styles.panelMeta}>
                  {unreadCount > 0 ? `${unreadCount} waiting` : 'All caught up'}
                </Text>
              </View>
              <View style={styles.summaryChips}>
                {Object.entries(categoryCounts)
                  .filter(([, count]) => count > 0)
                  .map(([category, count]) => (
                    <View
                      key={category}
                      style={[
                        styles.summaryChip,
                        {
                          backgroundColor: categoryMeta[category as NotificationCategory].background,
                          borderColor: categoryMeta[category as NotificationCategory].color,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.summaryChipText,
                          { color: categoryMeta[category as NotificationCategory].color },
                        ]}
                      >
                        {`${categoryMeta[category as NotificationCategory].label}: ${count}`}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
            {groupedSections.length ? (
              <ScrollView style={styles.notificationsList} contentContainerStyle={styles.notificationsListContent}>
                {groupedSections.map((section) => (
                  <View key={section.key} style={styles.sectionGroup}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    {section.items.map((item) => (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                          styles.notificationCard,
                          pressed && styles.notificationCardPressed,
                        ]}
                        onPress={() => handleNotificationPress(item)}
                        android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                      >
                        <View style={styles.notificationTitleRow}>
                          <Text style={styles.notificationTitle}>{item.title}</Text>
                          <View
                            style={[
                              styles.categoryChip,
                              {
                                backgroundColor: categoryMeta[item.category].background,
                                borderColor: categoryMeta[item.category].color,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                { color: categoryMeta[item.category].color },
                              ]}
                              numberOfLines={1}
                            >
                              {categoryMeta[item.category].label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.notificationDetail} numberOfLines={2}>
                          {item.detail}
                        </Text>
                        <Text style={styles.notificationTime}>{getRelativeTimeLabel(item.createdAt)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.notificationEmpty}>No notifications at the moment.</Text>
            )}
            {notifications.length ? (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.footerButton]}
                  onPress={() => {
                    void markAllAsRead();
                    setOpen(false);
                  }}
                >
                  <Text style={styles.actionText}>Mark all as read</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    paddingTop: 70,
    paddingRight: 20,
  },
  panel: {
    width: 300,
    borderRadius: 20,
    padding: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.6)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.65,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
    backdropFilter: 'blur(24px)',
    maxHeight: 420,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  panelTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
  },
  panelMeta: {
    color: '#b1bfed',
    fontSize: 12,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 12,
  },
  summaryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
    marginRight: 6,
  },
  summaryChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notificationsList: {
    marginTop: 10,
    maxHeight: 320,
  },
  notificationsListContent: {
    paddingBottom: 12,
  },
  sectionGroup: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#cbd5f5',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  notificationCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 10,
  },
  notificationCardPressed: {
    borderColor: 'rgba(255,255,255,0.25)',
  },
  notificationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notificationTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  notificationDetail: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
  },
  notificationTime: {
    color: '#a1a8c3',
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  notificationEmpty: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
  actionButton: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.3)',
  },
  footer: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  footerButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
  },
  actionText: {
    color: '#e0e7ff',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
