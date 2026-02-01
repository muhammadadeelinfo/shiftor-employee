import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { supabase } from '@lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useLanguage } from '@shared/context/LanguageContext';

const REMEMBER_KEY = 'employee-portal-remember-me';
const EMAIL_KEY = 'employee-portal-remembered-email';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const loginTitle = t('loginTitle');
  const titleParts = loginTitle.split(' ');
  const [titleFirstWord, ...titleRestWords] = titleParts;
  const titleRest = titleRestWords.join(' ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const storedRemember = await AsyncStorage.getItem(REMEMBER_KEY);
      if (storedRemember !== null) {
        setRememberMe(storedRemember === 'true');
      }
      const storedEmail = await AsyncStorage.getItem(EMAIL_KEY);
      if (storedEmail) {
        setEmail(storedEmail);
      }
    })();
  }, []);

  const handleAuthenticate = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('authEmailPasswordRequiredTitle'), t('authEmailPasswordRequiredBody'));
      return;
    }

    if (!supabase) {
      Alert.alert(t('authConfigurationMissingTitle'), t('authConfigurationMissingBody'));
      return;
    }

    try {
      setLoading(true);
      await AsyncStorage.setItem(REMEMBER_KEY, rememberMe ? 'true' : 'false');
      if (rememberMe) {
        await AsyncStorage.setItem(EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(EMAIL_KEY);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        throw error;
      }
      router.replace('(tabs)/my-shifts');
    } catch (error) {
      Alert.alert(
        t('authFailedTitle'),
        error instanceof Error ? error.message : t('authUnableSignIn')
      );
    } finally {
      setLoading(false);
    }
  };

  const { width } = useWindowDimensions();

  return (
    <LinearGradient
      colors={['#020617', '#080f1f', '#111827']}
      locations={[0, 0.55, 1]}
      style={styles.gradient}
    >
      <View style={styles.accentCircleLarge} />
      <View style={styles.accentCircleSmall} />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.card, { width: Math.min(width - 32, 420) }]}>
          <Text style={styles.title}>
            <Text style={styles.titleAccent}>{titleFirstWord ?? loginTitle}</Text>
            {titleRest ? ` ${titleRest}` : ''}
          </Text>
          <Text style={styles.subtitle}>{t('loginSignInSubtitle')}</Text>
          <View style={styles.emailField}>
            <TextInput
              style={styles.emailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder={t('loginEmailPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
            {email ? (
              <Pressable
                onPress={() => setEmail('')}
                accessibilityRole="button"
                accessibilityLabel={t('loginClearEmail')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#cbd5f5" />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.passwordField}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder={t('loginPasswordPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              textContentType="password"
              ref={passwordInputRef}
              returnKeyType="done"
              onSubmitEditing={handleAuthenticate}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? t('loginHidePassword') : t('loginShowPassword')
              }
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#cbd5f5"
              />
            </Pressable>
          </View>
          <View style={styles.rememberRow}>
            <Text style={styles.rememberLabel}>{t('keepSignedIn')}</Text>
            <Switch value={rememberMe} onValueChange={setRememberMe} />
          </View>
          <PrimaryButton
            title={t('loginSignInButton')}
            onPress={handleAuthenticate}
            loading={loading}
          />
          <>
            <TouchableOpacity
              style={styles.supportRow}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('mailto:hello@employeeportal.com')}
            >
              <Ionicons name="help-circle-outline" size={18} color="#60a5fa" />
              <Text style={styles.supportText}>{t('loginSupportText')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.guestRow}
              activeOpacity={0.7}
              onPress={() => router.push('/guest')}
            >
              <Text style={styles.guestTitle}>{t('continueAsGuestButton')}</Text>
              <Text style={styles.guestSubtitle}>{t('continueAsGuestSubtitle')}</Text>
            </TouchableOpacity>
          </>
        </View>
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
  card: {
    backgroundColor: '#0b1224',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 6,
    color: '#e2e8f0',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
  },
  titleAccent: {
    color: '#60a5fa',
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111629',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#e2e8f0',
  },
  passwordToggle: {
    padding: 8,
  },
  emailField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111629',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  emailInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#e2e8f0',
  },
  clearButton: {
    padding: 8,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rememberLabel: {
    fontSize: 14,
    color: '#cbd5f5',
  },
  switchRow: {
    marginTop: 12,
  },
  switchText: {
    color: '#60a5fa',
    textAlign: 'center',
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
    backgroundColor: '#312e81',
    opacity: 0.35,
    bottom: 60,
    left: -40,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  supportText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  guestRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 16,
    backgroundColor: '#111629',
  },
  guestTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    color: '#e2e8f0',
  },
  guestSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
});
