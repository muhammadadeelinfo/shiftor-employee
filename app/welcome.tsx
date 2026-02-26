import { Animated, Easing, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useLanguage } from '@shared/context/LanguageContext';

const SUPPORT_BASE_URL = 'https://shiftorapp.com';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 540,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardTranslateY]);

  const baseSiteUrl = useMemo(
    () =>
      ((Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim() || SUPPORT_BASE_URL).replace(
        /\/+$/,
        ''
      ),
    []
  );
  const legalLinks = [
    {
      label: t('aboutPrivacyPolicy'),
      url:
        ((Constants.expoConfig?.extra?.legalPrivacyUrl as string | undefined)?.trim() ||
          `${baseSiteUrl}/privacy#mobile`),
    },
    {
      label: t('aboutTerms'),
      url:
        ((Constants.expoConfig?.extra?.legalTermsUrl as string | undefined)?.trim() || `${baseSiteUrl}/terms#mobile`),
    },
    {
      label: t('supportHelpCenter'),
      url:
        ((Constants.expoConfig?.extra?.legalSupportUrl as string | undefined)?.trim() ||
          `${baseSiteUrl}/support#mobile`),
    },
  ];

  const openExternalUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) return;
      await Linking.openURL(url);
    } catch {
      // Ignore external-link failures on welcome screen.
    }
  };

  return (
    <LinearGradient colors={['#020617', '#080f1f', '#111827']} locations={[0, 0.55, 1]} style={styles.gradient}>
      <View style={styles.accentCircleLarge} />
      <View style={styles.accentCircleSmall} />
      <View style={styles.gridOverlay} />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          <View style={styles.tag}>
            <Text style={styles.tagText}>Public App Access</Text>
          </View>
          <Text style={styles.title}>{t('welcomeTitle')}</Text>
          <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>
          <Text style={styles.note}>{t('welcomePublicNote')}</Text>

          <PrimaryButton title={t('welcomeBrowseJobs')} onPress={() => router.push('/startup')} style={styles.cta} />

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.84}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.secondaryButtonText}>{t('welcomeAuthCta')}</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            {legalLinks.map((entry) => (
              <TouchableOpacity
                key={entry.url}
                onPress={() => void openExternalUrl(entry.url)}
                activeOpacity={0.75}
                style={styles.footerLinkChip}
              >
                <Text style={styles.footerLink}>{entry.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    position: 'relative',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
    backgroundColor: 'transparent',
  },
  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: 'rgba(11, 18, 36, 0.8)',
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 22 },
    elevation: 14,
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.35)',
    marginBottom: 14,
  },
  tagText: {
    color: '#bae6fd',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 10,
    lineHeight: 22,
  },
  note: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
  },
  cta: {
    marginBottom: 12,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  footerRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  footerLinkChip: {
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  footerLink: {
    fontSize: 12,
    color: '#7dd3fc',
    fontWeight: '600',
  },
  accentCircleLarge: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#2563eb',
    opacity: 0.25,
    top: -40,
    right: -80,
  },
  accentCircleSmall: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0369a1',
    opacity: 0.35,
    bottom: 60,
    left: -40,
  },
});
