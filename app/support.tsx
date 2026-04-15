import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { useTheme } from '@shared/themeContext';
import { getLegalLinks, openExternalUrlWithFallback } from '@shared/utils/legalLinks';
import { buildSupportMailto, SUPPORT_EMAIL, SUPPORT_FALLBACK_URL } from '@shared/utils/support';

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { supportPageUrl } = getLegalLinks();

  const handleEmailSupport = async () => {
    const supportUrl = buildSupportMailto('Help request');
    try {
      try {
        await Linking.openURL(supportUrl);
        return;
      } catch {
        // Mail may be unavailable on simulator devices; fall through to the web page.
      }

      await Linking.openURL(supportPageUrl || SUPPORT_FALLBACK_URL);
    } catch {
      Alert.alert(t('supportSectionTitle'), `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: layoutTokens.screenTop,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.replace('/account')}
          activeOpacity={0.8}
          style={[styles.backButton, { borderColor: theme.borderSoft, backgroundColor: theme.surface }]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
          <Text style={[styles.backText, { color: theme.textSecondary }]}>{t('commonBack')}</Text>
        </TouchableOpacity>

        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>{t('supportSectionTitle')}</Text>
          <Text style={[styles.pageBody, { color: theme.textSecondary }]}>
            Get help with account access, app issues, and general support requests.
          </Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Contact</Text>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>
            Choose the fastest way to reach the team.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.rowButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={() => void handleEmailSupport()}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="mail-outline" size={17} color={theme.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Email support</Text>
              <Text style={[styles.rowSubtext, { color: theme.textSecondary }]}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.rowButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={() =>
              void openExternalUrlWithFallback({
                title: t('supportHelpCenter'),
                url: supportPageUrl,
                fallbackUrl: SUPPORT_FALLBACK_URL,
                unableToOpenMessage: t('unableOpenLinkDevice'),
              })
            }
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="help-circle-outline" size={17} color={theme.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{t('supportHelpCenter')}</Text>
              <Text style={[styles.rowSubtext, { color: theme.textSecondary }]}>{SUPPORT_FALLBACK_URL}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    gap: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pageHeader: {
    gap: 6,
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  pageBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionBody: {
    marginTop: -4,
    fontSize: 13,
    lineHeight: 19,
  },
  rowButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
});
