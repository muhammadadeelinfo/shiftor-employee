'use client';
'use client';

import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNotifications } from '@shared/context/NotificationContext';

const stageColorMap: Record<string, string> = {
  production: '#22c55e',
  staging: '#f97316',
  development: '#38bdf8',
};

const stageLabelMap: Record<string, string> = {
  production: 'Live',
  staging: 'Preview',
  development: 'Dev',
};

export const TopBar = () => {
  const stage = Constants.expoConfig?.extra?.expoStage ?? 'development';
  const stageColor = stageColorMap[stage] ?? '#38bdf8';
  const stageLabel = stageLabelMap[stage] ?? 'Dev';
  const insets = useSafeAreaInsets();
  const { toggle } = useNotifications();

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.leftGroup}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#1d4ed8" />
          </View>
          <View style={styles.titleGroup}>
            <Text style={styles.title}>Employee Portal</Text>
            <Text style={styles.subtitle}>Shift planning & updates</Text>
          </View>
        </View>
        <View style={styles.rightGroup}>
          <View style={[styles.stageChip, { borderColor: stageColor }]}>
            <View style={[styles.stageDot, { backgroundColor: stageColor, borderColor: stageColor }]} />
            <Text style={styles.stageText}>{stageLabel}</Text>
          </View>
          <Pressable style={[styles.iconButton, styles.notificationButton]} onPress={toggle}>
            <Ionicons name="notifications-outline" size={20} color="#0f172a" />
            <View style={[styles.notificationDot, styles.redDot]} />
          </Pressable>
          <Pressable style={[styles.iconButton, styles.secondaryButton]}>
            <Ionicons name="person-circle-outline" size={22} color="#0f172a" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  bar: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    justifyContent: 'center',
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#475569',
    fontSize: 12,
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    gap: 6,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  stageText: {
    color: '#0f172a',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: '#fff',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  redDot: {
    backgroundColor: '#ef4444',
    borderColor: '#fef2f2',
  },
});
