import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '@shared/context/NotificationContext';
import { languageDefinitions, useLanguage } from '@shared/context/LanguageContext';

export type TopBarVariant = 'regular' | 'compact' | 'floating';

type Props = {
  variant?: TopBarVariant;
};

export const TopBar = ({ variant = 'regular' }: Props) => {
  const insets = useSafeAreaInsets();
  const { toggle, unreadCount } = useNotifications();
  const { language, setLanguage } = useLanguage();

  const variantStyle =
    variant === 'floating'
      ? styles.barFloating
      : variant === 'compact'
      ? styles.barCompact
      : styles.barRegular;

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={[styles.wrapper, variantStyle]}>
        <View style={styles.languagePill}>
          {languageDefinitions.map((definition) => {
            const isActive = language === definition.code;
            return (
              <TouchableOpacity
                key={definition.code}
                onPress={() => setLanguage(definition.code)}
                activeOpacity={0.85}
                style={[styles.languageOption, isActive && styles.languageOptionActive]}
              >
                <Text style={[styles.languageText, isActive && styles.languageTextActive]}>
                  {definition.flag} {definition.shortLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={toggle}
          activeOpacity={0.8}
          accessibilityLabel="Notifications"
        >
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            start={[0, 0]}
            end={[1, 1]}
            style={styles.notificationGradient}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  wrapper: {
    width: '100%',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    borderRadius: 32,
    marginHorizontal: 4,
  },
  barRegular: {
    paddingVertical: 8,
    marginTop: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  barCompact: {
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  barFloating: {
    paddingVertical: 3,
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  languagePill: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  languageOption: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    marginHorizontal: 4,
  },
  languageOptionActive: {
    backgroundColor: '#1d4ed8',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  languageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  languageTextActive: {
    color: '#fff',
  },
  notificationButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  notificationGradient: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
