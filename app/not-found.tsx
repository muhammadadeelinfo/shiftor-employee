import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@shared/components/BackButton';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const readmeSummary = [
    t('notFoundSummaryOne'),
    t('notFoundSummaryTwo'),
    t('notFoundSummaryThree'),
    t('notFoundSummaryFour'),
    t('notFoundSummaryFive'),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton
          fallbackHref="/"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/');
          }}
        />
        <Text style={[styles.heading, { color: theme.textPrimary }]}>{t('notFoundHeading')}</Text>
        {readmeSummary.map((line) => (
          <View key={line} style={styles.row}>
            <Text style={[styles.bullet, { color: theme.primary }]}>{'\u2022'}</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>{line}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030711',
  },
  content: {
    padding: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bullet: {
    color: '#a5b4fc',
    marginRight: 8,
    fontSize: 16,
    lineHeight: 24,
  },
  text: {
    flex: 1,
    color: '#e0e7ff',
    fontSize: 14,
    lineHeight: 22,
  },
});
