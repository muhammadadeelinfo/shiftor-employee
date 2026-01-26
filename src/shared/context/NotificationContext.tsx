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
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@lib/supabaseClient';
import { useAuth } from '@hooks/useSupabaseAuth';

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
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
    },
    {
      id: 'policy-update',
      title: 'New QR Policy',
      detail: 'Review QR clock-in steps before your next shift.',
      createdAt: minutesAgo(40),
      read: false,
    },
    {
      id: 'weekend-rota',
      title: 'Weekend rota',
      detail: 'Open unpaid weekend bids are live now.',
      createdAt: minutesAgo(26 * 60),
      read: true,
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
  return {
    id: String(rawId),
    title: normalizedTitle,
    detail: normalizedDetail,
    createdAt,
    read,
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

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
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
    }),
    [open, toggle, close, notifications, unreadCount, markAllAsRead, refresh]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {open && (
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              <Text style={styles.panelMeta}>
                {unreadCount > 0 ? `${unreadCount} waiting` : 'All caught up'}
              </Text>
            </View>
            {notifications.length ? (
              notifications.map((item) => (
                <View key={item.id} style={styles.notificationItem}>
                  <View style={styles.notificationText}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationDetail} numberOfLines={2}>
                      {item.detail}
                    </Text>
                  </View>
                  <Text style={styles.notificationTime}>{getRelativeTimeLabel(item.createdAt)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.notificationEmpty}>No notifications at the moment.</Text>
            )}
            {notifications.length ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  void markAllAsRead();
                  setOpen(false);
                }}
              >
                <Text style={styles.actionText}>Mark all as read</Text>
              </TouchableOpacity>
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
  notificationItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    alignItems: 'flex-start',
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  notificationDetail: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  notificationTime: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
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
  actionText: {
    color: '#e0e7ff',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
