import { useMemo } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { SUPPORT_EMAIL, SUPPORT_FALLBACK_URL } from '@shared/utils/support';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const appVersion = Constants.nativeAppVersion || Constants.expoConfig?.version || '1.0.0';
  const appBuild = Constants.nativeBuildVersion || null;
  const versionLabel = appBuild ? `${appVersion} (${appBuild})` : appVersion;
  const baseSiteUrl = SUPPORT_FALLBACK_URL.replace(/\/+$/, '');
  const privacyPolicyUrl =
    ((Constants.expoConfig?.extra?.legalPrivacyUrl as string | undefined)?.trim() ||
      `${baseSiteUrl}/privacy#mobile`);
  const termsUrl =
    ((Constants.expoConfig?.extra?.legalTermsUrl as string | undefined)?.trim() ||
      `${baseSiteUrl}/terms#mobile`);
  const supportPageUrl =
    ((Constants.expoConfig?.extra?.legalSupportUrl as string | undefined)?.trim() ||
      `${baseSiteUrl}/support#mobile`);

  const previewBullets = useMemo(
    () => [
      t('guestAboutPreviewJobs'),
      t('guestAboutPreviewCalendar'),
      t('guestAboutPreviewUnlock'),
    ],
    [t]
  );

  const openExternalUrl = async (title: string, url: string, fallbackUrl?: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
      if (fallbackUrl) {
        const fallbackSupported = await Linking.canOpenURL(fallbackUrl);
        if (fallbackSupported) {
          await Linking.openURL(fallbackUrl);
          return;
        }
      }
      Alert.alert(title, `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    } catch {
      Alert.alert(title, `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 32,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>{t('guestAboutTitle')}</Text>
        <Text style={[styles.heroBody, { color: theme.textSecondary }]}>{t('guestAboutBody')}</Text>
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
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{t('aboutVersion')}</Text>
          <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{versionLabel}</Text>
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('supportSectionTitle')}</Text>
        <TouchableOpacity
          onPress={() => openExternalUrl(t('supportHelpCenter'), supportPageUrl, SUPPORT_FALLBACK_URL)}
          activeOpacity={0.85}
          style={[styles.linkButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
        >
          <Text style={[styles.linkButtonText, { color: theme.textPrimary }]}>{t('supportHelpCenter')}</Text>
          <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => openExternalUrl(t('aboutPrivacyPolicy'), privacyPolicyUrl, SUPPORT_FALLBACK_URL)}
          activeOpacity={0.85}
          style={[styles.linkButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
        >
          <Text style={[styles.linkButtonText, { color: theme.textPrimary }]}>{t('aboutPrivacyPolicy')}</Text>
          <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => openExternalUrl(t('aboutTerms'), termsUrl, SUPPORT_FALLBACK_URL)}
          activeOpacity={0.85}
          style={[styles.linkButton, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
        >
          <Text style={[styles.linkButtonText, { color: theme.textPrimary }]}>{t('aboutTerms')}</Text>
          <Ionicons name="open-outline" size={16} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 10,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroLogo: {
    width: 34,
    height: 34,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 22,
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
});
