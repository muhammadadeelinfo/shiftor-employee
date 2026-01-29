import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useLanguage } from '@shared/context/LanguageContext';

export default function GuestPreviewScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const highlights = [
    {
      title: t('guestJobSectionTitle'),
      body: t('guestJobActionBody'),
    },
    {
      title: t('guestPerksSectionTitle'),
      body: t('guestPerksActionBody'),
    },
    {
      title: t('guestCommunityUpcomingLabel'),
      body: t('guestCommunityHeroSubtitle'),
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 32 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.heroTitle}>{t('guestHeroTitle')}</Text>
        <Text style={styles.heroSubtitle}>{t('guestHeroSubtitle')}</Text>
      </View>
      <View style={styles.cards}>
        {highlights.map((highlight) => (
          <View key={highlight.title} style={styles.card}>
            <Text style={styles.cardTitle}>{highlight.title}</Text>
            <Text style={styles.cardBody}>{highlight.body}</Text>
          </View>
        ))}
      </View>
      <PrimaryButton
        title={t('guestHeroTitle')}
        onPress={() => router.push('/login')}
        style={styles.ctaButton}
      />
      <Text style={styles.note}>{t('guestPerksActionBody')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  header: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 22,
  },
  cards: {
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 20,
  },
  ctaButton: {
    marginBottom: 12,
  },
  note: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
});
