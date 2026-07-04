import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@shared/components/BackButton';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage, type TranslationKey } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { layoutTokens } from '@shared/theme/layout';
import { fetchCompanyLinks, requestCompanyLink } from '@features/account/companyLinking';
import { trackAppEvent } from '@shared/utils/analytics';

const resultMessageKeys: Record<string, TranslationKey> = {
  pending: 'companyLinkResultPending',
  active: 'companyLinkResultActive',
  rejected: 'companyLinkResultRejected',
  invalid_code: 'companyLinkResultInvalid',
  code_expired: 'companyLinkResultExpired',
  code_exhausted: 'companyLinkResultExhausted',
  rate_limited: 'companyLinkResultRateLimited',
};

export default function CompanyLinkScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const metadataCode = typeof user?.user_metadata?.company_code === 'string'
    ? user.user_metadata.company_code
    : '';
  const fullName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : undefined;
  const [joinCode, setJoinCode] = useState(metadataCode);
  const [submitting, setSubmitting] = useState(false);
  const [messageKey, setMessageKey] = useState<TranslationKey | null>(null);
  const linksQueryKey = useMemo(() => ['companyLinks', user?.id], [user?.id]);
  const { data: links = [], isLoading, error, refetch } = useQuery({
    queryKey: linksQueryKey,
    queryFn: () => fetchCompanyLinks(user?.id ?? ''),
    enabled: Boolean(user?.id),
  });

  const submit = async () => {
    if (!joinCode.trim()) {
      setMessageKey('companyLinkCodeRequired');
      return;
    }
    setSubmitting(true);
    setMessageKey(null);
    try {
      const result = await requestCompanyLink(joinCode, fullName);
      void trackAppEvent('company_link_requested', {
        result: result.status,
        action: result.requestedAction ?? 'join',
      });
      setMessageKey(resultMessageKeys[result.status] ?? 'companyLinkRequestFailed');
      if (result.ok && user?.id) {
        await queryClient.invalidateQueries({ queryKey: linksQueryKey });
      }
    } catch {
      setMessageKey('companyLinkRequestFailed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: layoutTokens.screenTop, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton fallbackHref="/account" />
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('companyLinkTitle')}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{t('companyLinkDescription')}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>{t('companyLinkCodeLabel')}</Text>
          <TextInput
            value={joinCode}
            onChangeText={(value) => setJoinCode(value.toUpperCase())}
            placeholder={t('signupCompanyCodePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[
              styles.input,
              { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceElevated },
            ]}
          />
          {messageKey ? <Text style={[styles.message, { color: theme.textSecondary }]}>{t(messageKey)}</Text> : null}
          <PrimaryButton title={t('companyLinkSubmit')} onPress={() => void submit()} loading={submitting} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>{t('companyLinkStatusTitle')}</Text>
          {isLoading ? <Text style={[styles.body, { color: theme.textSecondary }]}>{t('companyLinkLoading')}</Text> : null}
          {error ? (
            <View style={styles.errorBlock}>
              <Text style={[styles.body, { color: theme.fail }]}>{t('companyLinkStatusUnavailable')}</Text>
              <PrimaryButton title={t('retry')} onPress={() => void refetch()} />
            </View>
          ) : null}
          {!isLoading && !error && links.length === 0 ? (
            <Text style={[styles.body, { color: theme.textSecondary }]}>{t('companyLinkNoRequests')}</Text>
          ) : null}
          {links.map((link) => (
            <View key={link.id} style={[styles.statusRow, { borderColor: theme.borderSoft }]}>
              <View style={styles.statusText}>
                <Text style={[styles.code, { color: theme.textPrimary }]}>{link.requestedCode}</Text>
                <Text style={[styles.companyId, { color: theme.textSecondary }]} numberOfLines={1}>
                  {link.companyId}
                </Text>
              </View>
              <Text style={[styles.badge, { color: theme.primary }]}>{t(resultMessageKeys[link.status])}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: layoutTokens.screenHorizontal, gap: 16 },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: '900' },
  body: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  label: { fontSize: 16, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  message: { fontSize: 13, lineHeight: 18 },
  errorBlock: { gap: 12 },
  statusRow: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusText: { flex: 1, gap: 2 },
  code: { fontSize: 14, fontWeight: '800' },
  companyId: { fontSize: 11 },
  badge: { maxWidth: '45%', fontSize: 12, fontWeight: '800', textAlign: 'right' },
});
