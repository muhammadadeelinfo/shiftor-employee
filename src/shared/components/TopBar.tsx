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
          <Ionicons name="shield-checkmark-outline" size={20} color="#7dd3fc" />
          <View style={[styles.stageChip, { borderColor: stageColor }]}>
            <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
            <Text style={styles.stageText}>{stageLabel}</Text>
          </View>
          <View>
            <Text style={styles.title}>Employee Portal</Text>
            <Text style={styles.subtitle}>Shift planning & updates</Text>
          </View>
        </View>
        <View style={styles.rightGroup}>
          <Pressable style={styles.iconButton} onPress={toggle}>
            <Ionicons name="notifications-outline" size={20} color="#020617" />
            <View style={[styles.notificationDot, { backgroundColor: '#f87171' }]} />
          </Pressable>
          <Pressable style={styles.iconButton}>
            <Ionicons name="person-circle-outline" size={22} color="#020617" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    width: '100%',
    backgroundColor: '#050714',
  },
  bar: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#050714',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
});
