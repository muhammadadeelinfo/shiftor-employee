import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@hooks/useSupabaseAuth';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useLanguage, type TranslationKey } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';
import { saveOnboardingCompletion } from '@shared/utils/onboarding';
import { getStartupRoute } from '@shared/utils/startupRoute';

type SlideAccent = [string, string];

type SlideDefinition = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  metricLabel: string;
  metricValue: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: SlideAccent;
};

type SlideConfig = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: SlideAccent;
  prefix: 'One' | 'Two' | 'Three' | 'Four';
};

const SLIDE_CONFIGS: SlideConfig[] = [
  {
    key: 'discover',
    icon: 'sparkles-outline',
    accent: ['#8b5cf6', '#38bdf8'],
    prefix: 'One',
  },
  {
    key: 'organize',
    icon: 'calendar-clear-outline',
    accent: ['#14b8a6', '#3b82f6'],
    prefix: 'Two',
  },
  {
    key: 'clock-in',
    icon: 'qr-code-outline',
    accent: ['#f97316', '#fb7185'],
    prefix: 'Three',
  },
  {
    key: 'updates',
    icon: 'notifications-outline',
    accent: ['#6366f1', '#22c55e'],
    prefix: 'Four',
  },
];

const slideKey = (prefix: SlideConfig['prefix'], suffix: string) =>
  `onboardingSlide${prefix}${suffix}` as TranslationKey;

const buildSlideDefinition = (
  t: (key: TranslationKey) => string,
  config: SlideConfig
): SlideDefinition => ({
  key: config.key,
  eyebrow: t(slideKey(config.prefix, 'Eyebrow')),
  title: t(slideKey(config.prefix, 'Title')),
  body: t(slideKey(config.prefix, 'Body')),
  points: [
    t(slideKey(config.prefix, 'PointOne')),
    t(slideKey(config.prefix, 'PointTwo')),
  ],
  metricLabel: t(slideKey(config.prefix, 'MetricLabel')),
  metricValue: t(slideKey(config.prefix, 'MetricValue')),
  icon: config.icon,
  accent: config.accent,
});

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const introAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const swipeHintAnim = useRef(new Animated.Value(0)).current;

  const slides = useMemo<SlideDefinition[]>(
    () => SLIDE_CONFIGS.map((config) => buildSlideDefinition(t, config)),
    [t]
  );

  const cardWidth = Math.min(width - 40, 420);
  const cardGap = 16;
  const snapInterval = cardWidth + cardGap;
  const isLastSlide = activeIndex === slides.length - 1;
  const showSwipeHint = !hasInteracted && !isLastSlide;
  const introOpacity = introAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const introTranslateY = introAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const cardOpacity = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
  const cardScale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });
  const swipeHintTranslateX = swipeHintAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });

  useEffect(() => {
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [introAnim]);

  useEffect(() => {
    cardAnim.setValue(0);
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, cardAnim]);

  useEffect(() => {
    if (!showSwipeHint) {
      swipeHintAnim.stopAnimation();
      swipeHintAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swipeHintAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(swipeHintAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [showSwipeHint, swipeHintAnim]);

  const goToSlide = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    scrollRef.current?.scrollTo({ x: nextIndex * snapInterval, animated: true });
    setActiveIndex(nextIndex);
    setHasInteracted(true);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    setActiveIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  };

  const completeOnboarding = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await saveOnboardingCompletion(AsyncStorage);
    } catch {
      /* let the user continue even if local persistence fails */
    } finally {
      router.replace(getStartupRoute(Boolean(user)));
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View pointerEvents="none" style={styles.bgOrbs}>
        <View style={[styles.orb, styles.orbTop, { backgroundColor: 'rgba(99, 102, 241, 0.18)' }]} />
        <View style={[styles.orb, styles.orbBottom, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]} />
      </View>

      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 14,
            opacity: introOpacity,
            transform: [{ translateY: introTranslateY }],
          },
        ]}
      >
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('onboardingTitle')}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {t('onboardingSubtitle')}
          </Text>
        </View>
        <Pressable onPress={completeOnboarding} hitSlop={10}>
          <Text style={[styles.skipText, { color: theme.textSecondary }]}>{t('onboardingSkip')}</Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.progressRow,
          {
            opacity: introOpacity,
            transform: [{ translateY: introTranslateY }],
          },
        ]}
      >
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {t('onboardingProgress', { current: activeIndex + 1, total: slides.length })}
        </Text>
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                {
                  backgroundColor: index === activeIndex ? theme.primary : theme.borderSoft,
                  width: index === activeIndex ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {showSwipeHint ? (
        <Animated.View
          style={[
            styles.swipeHintWrap,
            {
              opacity: introOpacity,
              transform: [{ translateY: introTranslateY }, { translateX: swipeHintTranslateX }],
            },
          ]}
        >
          <View style={[styles.swipeHintPill, { backgroundColor: theme.overlay, borderColor: theme.borderSoft }]}>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            <Text style={[styles.swipeHintText, { color: theme.textSecondary }]}>{t('onboardingSwipeHint')}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.primary} />
          </View>
        </Animated.View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={snapInterval}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setHasInteracted(true)}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={[styles.carouselContent, { paddingHorizontal: 20 }]}
      >
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <Animated.View
              key={slide.key}
              style={{
                opacity: isActive ? cardOpacity : 0.82,
                transform: [{ scale: isActive ? cardScale : 0.985 }],
              }}
            >
              <LinearGradient
                colors={[theme.surfaceElevated, theme.surface, slide.accent[0]]}
                start={[0, 0]}
                end={[1, 1]}
                style={[
                  styles.slideCard,
                  {
                    width: cardWidth,
                    marginRight: cardGap,
                    borderColor: theme.border,
                  },
                ]}
              >
                <LinearGradient
                  colors={slide.accent}
                  start={[0, 0]}
                  end={[1, 1]}
                  style={styles.iconBadge}
                >
                  <Ionicons name={slide.icon} size={24} color="#fff" />
                </LinearGradient>

                <View style={[styles.metricPill, { backgroundColor: theme.overlay, borderColor: theme.borderSoft }]}>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{slide.metricLabel}</Text>
                  <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{slide.metricValue}</Text>
                </View>

                <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>{slide.eyebrow}</Text>
                <Text style={[styles.slideTitle, { color: theme.textPrimary }]}>{slide.title}</Text>
                <Text style={[styles.slideBody, { color: theme.textSecondary }]}>{slide.body}</Text>

                <View style={styles.pointList}>
                  {slide.points.map((point) => (
                    <View
                      key={point}
                      style={[styles.pointRow, { backgroundColor: theme.overlay, borderColor: theme.borderSoft }]}
                    >
                      <View style={[styles.pointIndicator, { backgroundColor: slide.accent[1] }]} />
                      <Text style={[styles.pointText, { color: theme.textPrimary }]}>{point}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </Animated.View>
          );
        })}
      </ScrollView>

      <Animated.View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 20,
            opacity: introOpacity,
            transform: [{ translateY: introTranslateY }],
          },
        ]}
      >
        <Pressable
          onPress={() => goToSlide(activeIndex - 1)}
          disabled={activeIndex === 0}
          hitSlop={10}
          style={styles.backButton}
        >
          <Text
            style={[
              styles.backText,
              { color: activeIndex === 0 ? theme.textPlaceholder : theme.textSecondary },
            ]}
          >
            {t('onboardingBack')}
          </Text>
        </Pressable>

        <PrimaryButton
          title={isLastSlide ? t('onboardingGetStarted') : t('onboardingContinue')}
          onPress={isLastSlide ? completeOnboarding : () => goToSlide(activeIndex + 1)}
          loading={isCompleting}
          style={styles.primaryButton}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  bgOrbs: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 260,
    height: 260,
    top: -80,
    right: -60,
  },
  orbBottom: {
    width: 240,
    height: 240,
    bottom: 120,
    left: -90,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    maxWidth: 320,
  },
  headerSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressRow: {
    marginTop: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  swipeHintWrap: {
    paddingHorizontal: 20,
    marginTop: 14,
    alignItems: 'flex-start',
  },
  swipeHintPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipeHintText: {
    fontSize: 13,
    fontWeight: '600',
  },
  carouselContent: {
    paddingTop: 22,
  },
  slideCard: {
    minHeight: 470,
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    overflow: 'hidden',
  },
  iconBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  metricPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 20,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 12,
  },
  slideTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  slideBody: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
  },
  pointList: {
    marginTop: 22,
    gap: 12,
  },
  pointRow: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pointIndicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
    marginRight: 12,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    paddingTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
  },
});
