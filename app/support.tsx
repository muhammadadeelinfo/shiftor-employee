import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackButton } from '@shared/components/BackButton';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage, type TranslationKey } from '@shared/context/LanguageContext';
import { layoutTokens } from '@shared/theme/layout';
import { useTheme } from '@shared/themeContext';
import {
  buildFeedbackEmailBody,
  buildFeedbackEntry,
  feedbackCategories,
  saveFeedbackEntry,
  type FeedbackCategory,
} from '@shared/utils/feedback';
import { getLegalLinks, openExternalUrlWithFallback } from '@shared/utils/legalLinks';
import { buildSupportMailto, SUPPORT_EMAIL, SUPPORT_FALLBACK_URL } from '@shared/utils/support';

const feedbackCategoryLabelKeys: Record<FeedbackCategory, TranslationKey> = {
  login: 'feedbackCategoryLogin',
  'shift-missing': 'feedbackCategoryShiftMissing',
  qr: 'feedbackCategoryQr',
  documents: 'feedbackCategoryDocuments',
  vacation: 'feedbackCategoryVacation',
  'monthly-hours': 'feedbackCategoryMonthlyHours',
  other: 'feedbackCategoryOther',
};

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { supportPageUrl } = getLegalLinks();
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('other');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

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

  const handleSubmitFeedback = async () => {
    const trimmedMessage = feedbackMessage.trim();
    if (!trimmedMessage) {
      Alert.alert(t('feedbackTitle'), t('feedbackMessageRequired'));
      return;
    }

    const categoryLabel = t(feedbackCategoryLabelKeys[feedbackCategory]);
    const entry = buildFeedbackEntry({
      category: feedbackCategory,
      message: trimmedMessage,
      userId: user?.id,
      email: user?.email,
      source: 'support-screen',
    });

    try {
      setIsSubmittingFeedback(true);
      await saveFeedbackEntry(entry);
      setFeedbackMessage('');
      Alert.alert(t('feedbackThanksTitle'), t('feedbackThanksBody'), [
        {
          text: t('commonContinue'),
          style: 'cancel',
        },
        {
          text: t('feedbackEmailSupportAction'),
          onPress: () => {
            const supportUrl = buildSupportMailto(
              `Shiftor Employee feedback: ${categoryLabel}`,
              buildFeedbackEmailBody(entry, categoryLabel)
            );
            void Linking.openURL(supportUrl).catch(() => {
              Alert.alert(t('supportSectionTitle'), `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
            });
          },
        },
      ]);
    } catch {
      Alert.alert(t('feedbackTitle'), t('feedbackSubmitFailed'));
    } finally {
      setIsSubmittingFeedback(false);
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
        <BackButton onPress={() => router.replace('/account')} />

        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>{t('supportSectionTitle')}</Text>
          <Text style={[styles.pageBody, { color: theme.textSecondary }]}>
            {t('supportPageBody')}
          </Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('feedbackTitle')}</Text>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{t('feedbackBody')}</Text>
          <View style={styles.categoryGrid}>
            {feedbackCategories.map((category) => {
              const active = feedbackCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  activeOpacity={0.85}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? theme.primary : theme.surface,
                      borderColor: active ? theme.primary : theme.borderSoft,
                    },
                  ]}
                  onPress={() => setFeedbackCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: active ? '#fff' : theme.textPrimary },
                    ]}
                  >
                    {t(feedbackCategoryLabelKeys[category])}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            placeholder={t('feedbackMessagePlaceholder')}
            placeholderTextColor={theme.textPlaceholder}
            multiline
            textAlignVertical="top"
            style={[
              styles.feedbackInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderSoft,
                color: theme.textPrimary,
              },
            ]}
          />
          <PrimaryButton
            title={isSubmittingFeedback ? t('feedbackSubmitting') : t('feedbackSubmitAction')}
            onPress={() => void handleSubmitFeedback()}
            loading={isSubmittingFeedback}
          />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t('supportContactTitle')}</Text>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>
            {t('supportContactBody')}
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
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{t('supportEmailAction')}</Text>
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
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
