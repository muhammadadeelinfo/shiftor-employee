import { useMemo } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { useTheme } from '@shared/themeContext';
import { SUPPORT_EMAIL, SUPPORT_FALLBACK_URL } from '@shared/utils/support';
import { getLegalLinks, openExternalUrlWithFallback } from '@shared/utils/legalLinks';

export default function AboutScreen() {
  const isIOS = Platform.OS === 'ios';
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
  const { privacyPolicyUrl, termsUrl, supportPageUrl } = getLegalLinks();

  const previewBullets = useMemo(
    () => [
      t('guestAboutPreviewJobs'),
      t('guestAboutPreviewCalendar'),
      t('guestAboutPreviewUnlock'),
    ],
    [t]
  );

  return (
    <SafeAreaView style={[styles.scrollView, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.container,
          {
            flexGrow: 1,
            backgroundColor: theme.background,
            paddingTop: layoutTokens.screenTop,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <View style={styles.heroHeader}>
            <View
              style={[
                styles.heroBrandFrame,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
              ]}
            >
              <Image
                source={require('../../assets/icon.png')}
                style={styles.heroLogo}
                resizeMode="cover"
              />
            </View>
            <View style={styles.heroTextBlock}>
              <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>{t('guestAboutTitle')}</Text>
              <Text style={[styles.heroBody, { color: theme.textSecondary }]}>{t('guestAboutBody')}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('guestAboutPreviewTitle')}</Text>
          <View style={styles.bulletList}>
            {previewBullets.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                <Text style={[styles.bulletText, { color: theme.textSecondary }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('aboutSectionTitle')}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{t('aboutAppName')}</Text>
            <Text style={[styles.metaValue, { color: theme.textPrimary }]}>Shiftor Employee</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Developer</Text>
            <Text style={[styles.metaValue, { color: theme.textPrimary }]}>Goi Labs</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{t('aboutVersion')}</Text>
            <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{versionLabel}</Text>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('supportSectionTitle')}</Text>
          {!isIOS ? (
            <>
              <TouchableOpacity
                onPress={() =>
                  void openExternalUrlWithFallback({
                    title: t('supportHelpCenter'),
                    url: supportPageUrl,
                    fallbackUrl: SUPPORT_FALLBACK_URL,
                    unableToOpenMessage: t('unableOpenLinkDevice'),
                  })
                }
                activeOpacity={0.85}
                style={[styles.linkButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
              >
                <Text style={[styles.linkButtonText, { color: theme.textPrimary }]}>{t('supportHelpCenter')}</Text>
                <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  void openExternalUrlWithFallback({
                    title: t('aboutPrivacyPolicy'),
                    url: privacyPolicyUrl,
                    fallbackUrl: SUPPORT_FALLBACK_URL,
                    unableToOpenMessage: t('unableOpenLinkDevice'),
                  })
                }
                activeOpacity={0.85}
                style={[styles.linkButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
              >
                <Text style={[styles.linkButtonText, { color: theme.textPrimary }]}>{t('aboutPrivacyPolicy')}</Text>
                <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  void openExternalUrlWithFallback({
                    title: t('aboutTerms'),
                    url: termsUrl,
                    fallbackUrl: SUPPORT_FALLBACK_URL,
                    unableToOpenMessage: t('unableOpenLinkDevice'),
                  })
                }
                activeOpacity={0.85}
                style={[styles.linkButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
              >
                <Text style={[styles.linkButtonText, { color: theme.textPrimary }]}>{t('aboutTerms')}</Text>
                <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.iosInfoCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Text style={[styles.iosInfoText, { color: theme.textSecondary }]}>{t('loginSupportText')}</Text>
              <Text style={[styles.iosInfoEmail, { color: theme.textPrimary }]}>{SUPPORT_EMAIL}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    gap: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroBrandFrame: {
    width: 76,
    height: 76,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    flexShrink: 0,
  },
  heroTextBlock: {
    flex: 1,
    gap: 6,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  heroBody: {
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
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    fontSize: 14,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  linkButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  linkButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  iosInfoCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  iosInfoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  iosInfoEmail: {
    fontSize: 13,
    fontWeight: '700',
  },
});
