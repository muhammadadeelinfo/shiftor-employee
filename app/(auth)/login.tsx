import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { User } from '@supabase/supabase-js';
import { supabase } from '@lib/supabaseClient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLanguage } from '@shared/context/LanguageContext';
import {
  buildSupportMailto,
  SUPPORT_EMAIL,
  SUPPORT_FALLBACK_URL,
} from '@shared/utils/support';

const REMEMBER_KEY = 'employee-portal-remember-me';
const EMAIL_KEY = 'employee-portal-remembered-email';
const MIN_PASSWORD_LENGTH = 8;

const getStringMetadataField = (user: User, field: string): string | null => {
  const metadata = user.user_metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup'>(params.mode === 'signup' ? 'signup' : 'signin');
  const loginTitle = t('loginTitle');
  const titleParts = loginTitle.split(' ');
  const [titleFirstWord, ...titleRestWords] = titleParts;
  const titleRest = titleRestWords.join(' ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const [fullName, setFullName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const confirmPasswordInputRef = useRef<TextInput>(null);

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

  useEffect(() => {
    if (params.mode === 'signup') {
      setMode('signup');
    } else if (params.mode === 'signin') {
      setMode('signin');
    }
  }, [params.mode]);

  const handleAuthenticate = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const nextEmailError =
      !trimmedEmail
        ? t('authEmailPasswordRequiredBody')
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
          ? null
          : t('authInvalidEmailBody');
    const nextPasswordError = !trimmedPassword ? t('authEmailPasswordRequiredBody') : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (error) {
        throw error;
      }

      const authedUser = data.user;
      if (authedUser) {
        const requestedCompanyCode = getStringMetadataField(authedUser, 'requested_company_code');
        const requestedFullName = getStringMetadataField(authedUser, 'full_name');

        if (requestedCompanyCode) {
          const { data: linkData, error: linkError } = await supabase.rpc(
            'request_employee_company_link',
            {
              join_code: requestedCompanyCode,
              full_name: requestedFullName,
            }
          );

          if (linkError) {
            console.warn('Failed to link account to company', linkError);
          } else {
            const payload =
              linkData && typeof linkData === 'object' ? (linkData as Record<string, unknown>) : {};
            const status = typeof payload.status === 'string' ? payload.status : null;
            const ok = payload.ok === true;

            if (status === 'invalid_code') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkInvalidCodeBody'));
            } else if (status === 'code_expired') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkCodeExpiredBody'));
            } else if (status === 'code_exhausted') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkCodeExhaustedBody'));
            } else if (status === 'rate_limited') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkRateLimitedBody'));
            } else if (ok) {
              Alert.alert(t('companyLinkTitle'), t('companyLinkRequestedBody'));
              await supabase.auth.updateUser({
                data: {
                  ...(authedUser.user_metadata ?? {}),
                  requested_company_code: null,
                },
              });
            }
          }
        }
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

  const handleSignup = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    const trimmedCompanyCode = companyCode.trim();

    if (!trimmedEmail || !password || !confirmPassword) {
      Alert.alert(t('authEmailPasswordRequiredTitle'), t('authEmailPasswordRequiredBody'));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert(t('authFailedTitle'), t('authInvalidEmailBody'));
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(t('authFailedTitle'), t('authPasswordMinLengthBody'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('authFailedTitle'), t('authPasswordMismatchBody'));
      return;
    }

    if (!supabase) {
      Alert.alert(t('authConfigurationMissingTitle'), t('authConfigurationMissingBody'));
      return;
    }

    const authRedirectUrl = (Constants.expoConfig?.extra?.authRedirectUrl as string | undefined)?.trim();

    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: authRedirectUrl || undefined,
          data: {
            full_name: trimmedName || null,
            requested_company_code: trimmedCompanyCode || null,
          },
        },
      });

      if (error) {
        throw error;
      }

      Alert.alert(t('authVerifyEmailTitle'), t('authVerifyEmailBody'));
      setMode('signin');
    } catch (error) {
      Alert.alert(t('authFailedTitle'), error instanceof Error ? error.message : t('authUnableSignIn'));
    } finally {
      setLoading(false);
    }
  };

  const handleSupportEmail = async () => {
    const supportUrl = buildSupportMailto('Help request');
    try {
      const supported = await Linking.canOpenURL(supportUrl);
      if (supported) {
        await Linking.openURL(supportUrl);
        return;
      }
      const fallbackSupported = await Linking.canOpenURL(SUPPORT_FALLBACK_URL);
      if (fallbackSupported) {
        await Linking.openURL(SUPPORT_FALLBACK_URL);
        return;
      }
      Alert.alert(t('supportHelpCenter'), `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    } catch {
      Alert.alert(t('supportHelpCenter'), `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
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
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'signin' && styles.segmentButtonActive]}
              onPress={() => setMode('signin')}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={[styles.segmentText, mode === 'signin' && styles.segmentTextActive]}>
                {t('loginSignInButton')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'signup' && styles.segmentButtonActive]}
              onPress={() => setMode('signup')}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>
                {t('signupCreateButton')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{mode === 'signin' ? t('loginSignInSubtitle') : t('signupSubtitle')}</Text>
          {mode === 'signup' ? (
            <View style={styles.emailField}>
              <TextInput
                style={styles.emailInput}
                autoCapitalize="words"
                placeholder={t('signupFullNamePlaceholder')}
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          ) : null}
          {mode === 'signup' ? (
            <View style={styles.emailField}>
              <TextInput
                style={styles.emailInput}
                autoCapitalize="characters"
                placeholder={t('signupCompanyCodePlaceholder')}
                placeholderTextColor="#94a3b8"
                value={companyCode}
                onChangeText={setCompanyCode}
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          ) : null}
          <View style={styles.emailField}>
            <TextInput
              style={styles.emailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder={t('loginEmailPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (emailError) {
                  setEmailError(null);
                }
              }}
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              editable={!loading}
            />
            {email ? (
              <Pressable
                onPress={() => setEmail('')}
                accessibilityRole="button"
                accessibilityLabel={t('loginClearEmail')}
                style={styles.clearButton}
                disabled={loading}
              >
                <Ionicons name="close-circle" size={20} color="#cbd5f5" />
              </Pressable>
            ) : null}
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          <View style={styles.passwordField}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder={t('loginPasswordPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) {
                  setPasswordError(null);
                }
              }}
              textContentType="password"
              ref={passwordInputRef}
              returnKeyType={mode === 'signup' ? 'next' : 'done'}
              onSubmitEditing={() =>
                mode === 'signup' ? confirmPasswordInputRef.current?.focus() : handleAuthenticate()
              }
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? t('loginHidePassword') : t('loginShowPassword')
              }
              style={styles.passwordToggle}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#cbd5f5"
              />
            </Pressable>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          {mode === 'signup' ? (
            <View style={styles.passwordField}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                placeholder={t('signupConfirmPasswordPlaceholder')}
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                textContentType="password"
                ref={confirmPasswordInputRef}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
                editable={!loading}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword ? t('loginHidePassword') : t('loginShowPassword')
                }
                style={styles.passwordToggle}
                disabled={loading}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#cbd5f5"
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.rememberRow}>
              <Text style={styles.rememberLabel}>{t('keepSignedIn')}</Text>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                disabled={loading}
                trackColor={{ false: '#334155', true: '#2563eb' }}
                thumbColor={rememberMe ? '#f8fafc' : '#cbd5f5'}
                ios_backgroundColor="#334155"
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.backRow}
            activeOpacity={0.7}
            onPress={() => router.push('/startup')}
            disabled={loading}
          >
            <Ionicons name="arrow-back-circle-outline" size={18} color="#94a3b8" />
            <Text style={styles.backText}>{t('loginBackToJobs')}</Text>
          </TouchableOpacity>
          <PrimaryButton
            title={mode === 'signin' ? t('loginSignInButton') : t('signupCreateButton')}
            onPress={mode === 'signin' ? handleAuthenticate : handleSignup}
            loading={loading}
          />
          <>
            <TouchableOpacity
              style={styles.supportRow}
              activeOpacity={0.7}
              onPress={() => void handleSupportEmail()}
              disabled={loading}
            >
              <Ionicons name="help-circle-outline" size={18} color="#60a5fa" />
              <Text style={styles.supportText}>{t('loginSupportText')}</Text>
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
    marginBottom: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#111629',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 4,
    marginBottom: 14,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#2563eb',
  },
  segmentText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#f8fafc',
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
  errorText: {
    marginTop: -10,
    marginBottom: 12,
    color: '#f87171',
    fontSize: 12,
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
});
