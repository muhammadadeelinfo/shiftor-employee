import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNotifications } from '@shared/context/NotificationContext';
import { useTheme } from '@shared/themeContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import {
  getContentMaxWidth,
  shouldStackForCompactWidth,
} from '@shared/utils/responsiveLayout';
import { getNotificationsSummaryTranslationKey } from '@shared/utils/notificationsViewModel';

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getRelativeTimeLabel = (
  iso: string,
  labels: { justNow: string; comingSoon: string }
) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return labels.justNow;
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  if (Math.abs(diff) < minute) return labels.justNow;
  if (diff < 0) return labels.comingSoon;
  if (diff < minute * 60) return `${Math.round(diff / minute)}m ago`;
  if (diff < minute * 60 * 24) return `${Math.round(diff / (minute * 60))}h ago`;
  return `${Math.round(diff / (minute * 60 * 24))}d ago`;
};

type NotificationSection = {
  key: string;
  title: string;
  items: ReturnType<typeof useNotifications>['notifications'];
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { notifications, unreadCount, markAllAsRead, markNotificationRead } = useNotifications();
  const isCompact = width < 390;
  const shouldStackHeader = shouldStackForCompactWidth(width);
  const contentMaxWidth = getContentMaxWidth(width);

  const sections = useMemo<NotificationSection[]>(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const todayItems = notifications.filter((item) => isSameDay(new Date(item.createdAt), now));
    const yesterdayItems = notifications.filter((item) =>
      isSameDay(new Date(item.createdAt), yesterday)
    );
    const earlierItems = notifications.filter((item) => {
      const created = new Date(item.createdAt);
      return !isSameDay(created, now) && !isSameDay(created, yesterday);
    });
    return [
      { key: 'today', title: t('notificationSectionToday'), items: todayItems },
      { key: 'yesterday', title: t('notificationSectionYesterday'), items: yesterdayItems },
      { key: 'earlier', title: t('notificationSectionEarlier'), items: earlierItems },
    ].filter((section) => section.items.length > 0);
  }, [notifications, t]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <View style={[styles.header, { borderColor: theme.borderSoft }]}>
        <View
          style={[
            styles.headerInner,
            contentMaxWidth ? styles.constrained : null,
            contentMaxWidth ? { maxWidth: contentMaxWidth } : null,
          ]}
        >
          <View style={[styles.headerRow, shouldStackHeader ? styles.headerRowCompact : null]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {t('notificationsPanelTitle')}
              </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t(getNotificationsSummaryTranslationKey(unreadCount), { count: unreadCount })}
            </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.readAllButton,
                shouldStackHeader ? styles.readAllButtonCompact : styles.readAllButtonInline,
                { borderColor: theme.borderSoft, opacity: notifications.length ? 1 : 0.5 },
              ]}
              onPress={() => void markAllAsRead()}
              disabled={!notifications.length}
            >
              <Text
                style={[
                  styles.readAllText,
                  isCompact ? styles.readAllTextCompact : null,
                  { color: theme.textPrimary },
                ]}
                numberOfLines={shouldStackHeader ? 2 : 1}
              >
                {t('notificationsMarkAllRead')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          contentMaxWidth ? styles.constrained : null,
          contentMaxWidth ? { maxWidth: contentMaxWidth } : null,
          { paddingBottom: Math.max(20, insets.bottom + 20) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sections.length ? (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.title}</Text>
              {section.items.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: theme.surface,
                      borderColor: item.read ? theme.borderSoft : theme.primary,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                  onPress={async () => {
                    await markNotificationRead(item.id);
                    if (item.targetPath) router.push(item.targetPath);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                    {!item.read ? <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} /> : null}
                  </View>
                  <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>{item.detail}</Text>
                  <Text style={[styles.cardTime, { color: theme.textSecondary }]}>
                    {getRelativeTimeLabel(item.createdAt, {
                      justNow: t('notificationRelativeJustNow'),
                      comingSoon: t('notificationRelativeComingSoon'),
                    })}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        ) : (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('notificationsPanelEmpty')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: layoutTokens.screenTop,
    paddingBottom: 12,
  },
  headerInner: {
    width: '100%',
  },
  constrained: {
    alignSelf: 'center',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  readAllButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  readAllButtonInline: {
    maxWidth: '56%',
  },
  readAllButtonCompact: {
    width: '100%',
    maxWidth: '100%',
    minHeight: 38,
  },
  readAllText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  readAllTextCompact: {
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  cardDetail: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  cardTime: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'right',
  },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
  },
});
