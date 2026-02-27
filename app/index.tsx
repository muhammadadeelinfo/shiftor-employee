import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useLanguage } from '@shared/context/LanguageContext';
import { getStartupRoute } from '@shared/utils/startupRoute';

const ROOT_BOOT_TIMEOUT_MS = 12000;

export default function RootIndex() {
  const { user, loading, refreshSession } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [showBootFallback, setShowBootFallback] = useState(false);

  useEffect(() => {
    if (loading) return;
    router.replace(getStartupRoute(Boolean(user)));
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading) {
      setShowBootFallback(false);
      return;
    }
    const timeout = setTimeout(() => {
      setShowBootFallback(true);
    }, ROOT_BOOT_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [loading]);

  const handleRetry = () => {
    setShowBootFallback(false);
    void refreshSession();
  };

  const handleContinueToLogin = () => {
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#93c5fd" />
      <Text style={styles.text}>
        {loading ? t('rootCheckingSession') : t('rootPreparingWorkspace')}
      </Text>
      {showBootFallback ? (
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackTitle}>{t('rootBootTimeoutTitle')}</Text>
          <Text style={styles.fallbackBody}>{t('rootBootTimeoutBody')}</Text>
          <Pressable style={styles.primaryButton} onPress={handleRetry}>
            <Text style={styles.primaryButtonText}>{t('rootBootTimeoutRetry')}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleContinueToLogin}>
            <Text style={styles.secondaryButtonText}>{t('rootBootTimeoutContinue')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  text: {
    color: '#6b7280',
    marginTop: 10,
  },
  fallbackCard: {
    marginTop: 20,
    width: '100%',
    maxWidth: 360,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
  },
  fallbackTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  fallbackBody: {
    color: '#334155',
    marginTop: 6,
    marginBottom: 14,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#94a3b8',
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
});
