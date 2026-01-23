import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
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
  const insets = useSafeAreaInsets();
  const { toggle } = useNotifications();
  const stage = Constants.expoConfig?.extra?.expoStage ?? 'development';
  const stageColor = stageColorMap[stage] ?? '#38bdf8';
  const stageLabel = stageLabelMap[stage] ?? 'Dev';

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.wrapper}>
        <View style={styles.bar}>
          <View style={styles.leftGroup}>
            <View style={styles.logoPill}>
              <Ionicons name="sparkles" size={18} color="#0f172a" />
            </View>
            <View>
              <Text style={styles.title}>Employee Portal</Text>
              <Text style={styles.subtitle}>Shift planning & updates</Text>
            </View>
          </View>
          <View style={styles.rightGroup}>
            <View style={[styles.stageChip, { borderColor: stageColor }]}>
              <Text style={[styles.stageText, { color: stageColor }]}>{stageLabel}</Text>
            </View>
          <Pressable style={styles.iconButton} onPress={toggle}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
              <View style={[styles.notificationDot, styles.redDot]} />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  wrapper: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  bar: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoPill: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  title: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stageChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#e0f2fe',
    borderWidth: 0.5,
  },
  stageText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  redDot: {
    backgroundColor: '#ef4444',
  },
});
