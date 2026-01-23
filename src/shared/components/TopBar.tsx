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
      <View style={styles.topGradient} pointerEvents="none" />
      <View style={styles.bar}>
        <View style={styles.leftGroup}>
          <View style={[styles.stageChip, { borderColor: stageColor }]}>
            <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
            <Text style={styles.stageText}>{stageLabel}</Text>
          </View>
          <Text style={styles.title}>Employee Portal</Text>
        </View>
        <View style={styles.rightGroup}>
          <Pressable style={[styles.iconButton, styles.notificationButton]} onPress={toggle}>
            <Ionicons name="notifications-outline" size={20} color="#f8fafc" />
            <View style={[styles.notificationDot, { backgroundColor: stageColor }]} />
          </Pressable>
          <Pressable style={styles.iconButton}>
            <Ionicons name="person-circle-outline" size={22} color="#f8fafc" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    width: '100%',
    backgroundColor: '#030712',
  },
  topGradient: {
    width: '100%',
    height: 16,
    backgroundColor: '#0b122b',
  },
  bar: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#030712',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageText: {
    color: '#f8fafc',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(248,250,252,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#030712',
  },
  notificationButton: {
    marginRight: 4,
  },
});
