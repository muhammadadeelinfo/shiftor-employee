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

export type TopBarVariant = 'regular' | 'compact' | 'floating';

type Props = {
  variant?: TopBarVariant;
};

const STAGE_TRANSFORM: Record<TopBarVariant, 'uppercase' | 'none'> = {
  regular: 'uppercase',
  compact: 'none',
  floating: 'uppercase',
};

export const TopBar = ({ variant = 'regular' }: Props) => {
  const insets = useSafeAreaInsets();
  const { toggle } = useNotifications();
  const stage = Constants.expoConfig?.extra?.expoStage ?? 'development';
  const stageColor = stageColorMap[stage] ?? '#38bdf8';
  const stageLabel = stageLabelMap[stage] ?? 'Dev';
  const isCompact = variant === 'compact';
  const isFloating = variant === 'floating';

  return (
    <SafeAreaView
      style={[
        styles.safe,
        {
          paddingTop:
            insets.top +
            (isFloating ? 2 : isCompact ? 4 : 0),
        },
      ]}
    >
      <View
        style={[
          styles.bar,
          isFloating ? styles.barFloating : isCompact ? styles.barCompact : styles.barRegular,
        ]}
      >
        <View
          style={[
            styles.leftGroup,
            isCompact && styles.leftGroupCompact,
            isFloating && styles.leftGroupFloating,
          ]}
        >
          <View
            style={[
              styles.logoPill,
              isCompact && styles.logoPillCompact,
              isFloating && styles.logoPillFloating,
            ]}
          >
            <Ionicons
              name="sparkles"
              size={isFloating ? 16 : isCompact ? 16 : 18}
              color="#0f172a"
            />
          </View>
          <View>
            <Text
              style={[
                styles.title,
                isCompact && styles.titleCompact,
                isFloating && styles.titleFloating,
              ]}
            >
              Employee Portal
            </Text>
            {!isCompact && !isFloating && <Text style={styles.subtitle}>Shift planning & updates</Text>}
          </View>
        </View>
        <View
          style={[
            styles.rightGroup,
            isCompact && styles.rightGroupCompact,
            isFloating && styles.rightGroupFloating,
          ]}
        >
          <View
            style={[
              styles.stageChip,
              isCompact && styles.stageChipCompact,
              isFloating && styles.stageChipFloating,
              { borderColor: stageColor },
            ]}
          >
            <Text
              style={[
                styles.stageText,
                isCompact && styles.stageTextCompact,
                isFloating && styles.stageTextFloating,
                { color: stageColor, textTransform: STAGE_TRANSFORM[variant] },
              ]}
            >
              {stageLabel}
            </Text>
          </View>
          <Pressable
            style={[
              styles.iconButton,
              isCompact && styles.iconButtonCompact,
              isFloating && styles.iconButtonFloating,
            ]}
            onPress={toggle}
          >
            <Ionicons name="notifications-outline" size={isFloating ? 16 : isCompact ? 18 : 20} color="#fff" />
            <View style={[styles.notificationDot, styles.redDot]} />
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
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  barRegular: {
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  barCompact: {
    paddingVertical: 10,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  barFloating: {
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 2,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    backgroundColor: '#ffffff',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leftGroupCompact: {
    gap: 8,
  },
  leftGroupFloating: {
    gap: 6,
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
  logoPillCompact: {
    width: 36,
    height: 36,
    borderRadius: 12,
    shadowOpacity: 0.06,
  },
  logoPillFloating: {
    width: 32,
    height: 32,
    borderRadius: 10,
    shadowOpacity: 0.05,
  },
  title: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  titleCompact: {
    fontSize: 16,
  },
  titleFloating: {
    fontSize: 14,
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
  rightGroupCompact: {
    gap: 6,
  },
  rightGroupFloating: {
    gap: 4,
  },
  stageChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#e0f2fe',
    borderWidth: 0.5,
  },
  stageChipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  stageChipFloating: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  stageText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stageTextCompact: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  stageTextFloating: {
    fontSize: 10,
    letterSpacing: 0.6,
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
  iconButtonCompact: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  iconButtonFloating: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
