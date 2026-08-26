import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BackButton } from '@shared/components/BackButton';
import { useLanguage } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { useTheme } from '@shared/themeContext';
import { SUPPORT_FALLBACK_URL } from '@shared/utils/support';
import { getLegalLinks, openExternalUrlWithFallback } from '@shared/utils/legalLinks';

const SHIFTOR_WEBSITE_URL = 'https://shiftorapp.com';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { privacyPolicyUrl, termsUrl, supportPageUrl } = getLegalLinks();

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
        <BackButton onPress={() => router.replace('/account')} style={styles.backButton} />

        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>{t('aboutSectionTitle')}</Text>
          <Text style={[styles.pageBody, { color: theme.textSecondary }]}>{t('aboutSectionHint')}</Text>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="business-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('aboutCompaniesTitle')}</Text>
          </View>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{t('aboutCompaniesBody')}</Text>
          <PolicyLink
            iconName="globe-outline"
            label="Shiftorapp.com"
            onPress={() =>
              void openExternalUrlWithFallback({
                title: 'Shiftorapp.com',
                url: SHIFTOR_WEBSITE_URL,
                fallbackUrl: SUPPORT_FALLBACK_URL,
                unableToOpenMessage: t('unableOpenLinkDevice'),
              })
            }
          />
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('privacySummaryTitle')}</Text>
          </View>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{t('privacySummaryBody')}</Text>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="document-text-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('aboutLegalTitle')}</Text>
          </View>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{t('aboutLegalBody')}</Text>
          <PolicyLink
            iconName="help-circle-outline"
            label={t('supportHelpCenter')}
            onPress={() =>
              void openExternalUrlWithFallback({
                title: t('supportHelpCenter'),
                url: supportPageUrl,
                fallbackUrl: SUPPORT_FALLBACK_URL,
                unableToOpenMessage: t('unableOpenLinkDevice'),
              })
            }
          />
          <PolicyLink
            iconName="shield-outline"
            label={t('aboutPrivacyPolicy')}
            onPress={() =>
              void openExternalUrlWithFallback({
                title: t('aboutPrivacyPolicy'),
                url: privacyPolicyUrl,
                fallbackUrl: SUPPORT_FALLBACK_URL,
                unableToOpenMessage: t('unableOpenLinkDevice'),
              })
            }
          />
          <PolicyLink
            iconName="document-text-outline"
            label={t('aboutTerms')}
            onPress={() =>
              void openExternalUrlWithFallback({
                title: t('aboutTerms'),
                url: termsUrl,
                fallbackUrl: SUPPORT_FALLBACK_URL,
                unableToOpenMessage: t('unableOpenLinkDevice'),
              })
            }
          />
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('aboutAppDetails')}</Text>
          </View>
          <InfoRow label={t('aboutAppName')} value="Shiftor Employee" />
          <InfoRow label={t('aboutPlatform')} value={t('aboutPlatformValue')} isLast />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  isLast?: boolean;
};

function InfoRow({ label, value, isLast = false }: InfoRowProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.infoRow,
        {
          borderBottomColor: theme.borderSoft,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{value}</Text>
    </View>
  );
}

type PolicyLinkProps = {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function PolicyLink({ iconName, label, onPress }: PolicyLinkProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        {
          borderColor: theme.borderSoft,
          backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name={iconName} size={16} color={theme.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
    </Pressable>
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
    gap: 14,
  },
  backButton: {
    width: 38,
    height: 38,
  },
  pageHeader: {
    gap: 5,
    paddingTop: 4,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
  },
  pageBody: {
    fontSize: 14,
    lineHeight: 19,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  infoRow: {
    minHeight: 44,
    paddingVertical: 10,
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
    fontSize: 13,
    fontWeight: '700',
  },
  linkRow: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
});
