import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { useTheme } from '@shared/themeContext';
import { SUPPORT_FALLBACK_URL } from '@shared/utils/support';
import { getLegalLinks, openExternalUrlWithFallback } from '@shared/utils/legalLinks';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const nativeAppVersion =
    typeof Constants.nativeAppVersion === 'string' ? Constants.nativeAppVersion.trim() : '';
  const nativeBuildVersion =
    typeof Constants.nativeBuildVersion === 'string' ? Constants.nativeBuildVersion.trim() : '';
  const versionLabel = nativeAppVersion
    ? nativeBuildVersion
      ? `${nativeAppVersion} (${nativeBuildVersion})`
      : nativeAppVersion
    : t('notProvided');
  const platformLabel =
    Constants.expoConfig?.platforms?.includes('ios') && Constants.expoConfig?.platforms?.includes('android')
      ? 'iOS / Android'
      : Constants.platform?.ios
        ? 'iOS'
        : Constants.platform?.android
          ? 'Android'
          : 'Mobile';
  const { privacyPolicyUrl, termsUrl } = getLegalLinks();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: layoutTokens.screenTop,
            paddingBottom: insets.bottom + 28,
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
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>{t('aboutSectionTitle')}</Text>
          <Text style={[styles.pageBody, { color: theme.textSecondary }]}>{t('aboutSectionHint')}</Text>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>App details</Text>
          <View style={[styles.infoRow, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('aboutAppName')}</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>Shiftor Employee</Text>
          </View>
          <View style={[styles.infoRow, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Developer</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>Goi Labs</Text>
          </View>
          <View style={[styles.infoRow, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('aboutVersion')}</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{versionLabel}</Text>
          </View>
          <View style={[styles.infoRow, { borderColor: theme.borderSoft }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Platform</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{platformLabel}</Text>
          </View>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Legal</Text>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>
            Review the privacy and usage policies for the mobile app.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.linkRow, { borderColor: theme.borderSoft, backgroundColor: theme.surface }]}
            onPress={() =>
              void openExternalUrlWithFallback({
                title: t('aboutPrivacyPolicy'),
                url: privacyPolicyUrl,
                fallbackUrl: SUPPORT_FALLBACK_URL,
                unableToOpenMessage: t('unableOpenLinkDevice'),
              })
            }
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="shield-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('aboutPrivacyPolicy')}</Text>
            <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.linkRow, { borderColor: theme.borderSoft, backgroundColor: theme.surface }]}
            onPress={() =>
              void openExternalUrlWithFallback({
                title: t('aboutTerms'),
                url: termsUrl,
                fallbackUrl: SUPPORT_FALLBACK_URL,
                unableToOpenMessage: t('unableOpenLinkDevice'),
              })
            }
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="document-text-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t('aboutTerms')}</Text>
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
  pageHeader: {
    gap: 6,
    paddingTop: 2,
    paddingHorizontal: 2,
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
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
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
  infoRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
  },
  linkRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
});
