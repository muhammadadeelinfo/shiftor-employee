'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const notifications = [
  { id: '1', title: 'Shift Reminder', detail: '8:00 AM – Lobby Coverage', time: '2m ago' },
  { id: '2', title: 'New QR Policy', detail: 'Review QR clock-in steps', time: '1h ago' },
  { id: '3', title: 'Weekend rota', detail: 'Open unpaid weekend bids', time: 'Yesterday' },
];

type NotificationContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);

  const value = useMemo(
    () => ({
      open,
      toggle: () => setOpen((prev) => !prev),
      close: () => setOpen(false),
    }),
    [open]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {open && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Notifications</Text>
            {notifications.map((item) => (
              <View key={item.id} style={styles.notificationItem}>
                <View>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.notificationTime}>{item.time}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.closeButton} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingTop: 64,
    paddingRight: 16,
  },
  panel: {
    width: 280,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  panelTitle: {
    color: '#dbeafe',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  notificationItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 10,
    marginBottom: 10,
  },
  notificationTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  notificationDetail: {
    color: '#94a3b8',
    fontSize: 12,
  },
  notificationTime: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  closeButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  closeText: {
    color: '#cbd5f5',
    fontWeight: '600',
  },
});
