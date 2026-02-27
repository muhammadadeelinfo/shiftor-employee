import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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
const SUPPORT_BASE_URL = 'https://shiftorapp.com';

const getStringMetadataField = (user: User, field: string): string | null => {
  const metadata = user.user_metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const isRpcSignatureMismatchError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /Could not find the function/i.test(message) ||
    /request_employee_company_link/i.test(message)
  );
};

const requestCompanyLink = async (joinCode: string, fullName?: string | null) => {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const normalizedCode = joinCode.trim().toUpperCase();
  const normalizedName = (fullName ?? '').trim();
  const attempts: Array<Record<string, unknown>> = [
    { join_code: normalizedCode, full_name: normalizedName || null },
    { join_code: normalizedCode },
  ];

  let lastSignatureError: unknown = null;
  for (const params of attempts) {
    const { data, error } = await supabase.rpc('request_employee_company_link', params);
    if (!error) {
      return data;
    }
    if (isRpcSignatureMismatchError(error)) {
      lastSignatureError = error;
      continue;
    }
    throw error;
  }

  if (lastSignatureError) {
    throw lastSignatureError;
  }
  throw new Error('Failed to request company link.');
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
  const [rememberedEmail, setRememberedEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const signupPasswordHasMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const signupPasswordsMatch = Boolean(confirmPassword) && password === confirmPassword;
  const signupPasswordRules = [
    {
      key: 'min-length',
      done: signupPasswordHasMinLength,
      label: t('authPasswordRuleMinLength'),
    },
    {
      key: 'match',
      done: signupPasswordsMatch,
      label: t('authPasswordRuleMatch'),
    },
  ];

  useEffect(() => {
    (async () => {
      const storedRemember = await AsyncStorage.getItem(REMEMBER_KEY);
      if (storedRemember !== null) {
        setRememberMe(storedRemember === 'true');
      }
      const storedEmail = await AsyncStorage.getItem(EMAIL_KEY);
      if (storedEmail) {
        setRememberedEmail(storedEmail);
        if (params.mode !== 'signup') {
          setEmail(storedEmail);
        }
      }
    })();
  }, [params.mode]);

  useEffect(() => {
    if (params.mode === 'signup') {
      setMode('signup');
    } else if (params.mode === 'signin') {
      setMode('signin');
    }
  }, [params.mode]);

  useEffect(() => {
    if (mode === 'signup') {
      setEmail('');
      setEmailError(null);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'signin' && rememberMe && rememberedEmail) {
      setEmail((current) => (current.trim() ? current : rememberedEmail));
    }
  }, [mode, rememberMe, rememberedEmail]);

  const handleAuthenticate = async () => {
    const trimmedEmail = email.trim();
    const submittedPassword = password;
    const nextEmailError =
      !trimmedEmail
        ? t('authEmailPasswordRequiredBody')
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
          ? null
          : t('authInvalidEmailBody');
    const nextPasswordError = !submittedPassword ? t('authEmailPasswordRequiredBody') : null;
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
        password: submittedPassword,
      });
      if (error) {
        throw error;
      }

      const authedUser = data.user;
      if (authedUser) {
        const requestedCompanyCode = getStringMetadataField(authedUser, 'requested_company_code');
        const requestedFullName = getStringMetadataField(authedUser, 'full_name');

        if (requestedCompanyCode) {
          try {
            const linkData = await requestCompanyLink(requestedCompanyCode, requestedFullName);
            const payload =
              linkData && typeof linkData === 'object' ? (linkData as Record<string, unknown>) : {};
            const status = typeof payload.status === 'string' ? payload.status : null;
            const requestedAction =
              typeof payload.requestedAction === 'string' ? payload.requestedAction : 'join';
            const ok = payload.ok === true;

            if (status === 'invalid_code') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkInvalidCodeBody'));
            } else if (status === 'active') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkAlreadyActiveBody'));
            } else if (status === 'code_expired') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkCodeExpiredBody'));
            } else if (status === 'code_exhausted') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkCodeExhaustedBody'));
            } else if (status === 'rate_limited') {
              Alert.alert(t('companyLinkTitle'), t('companyLinkRateLimitedBody'));
            } else if (ok) {
              Alert.alert(
                t('companyLinkTitle'),
                requestedAction === 'switch'
                  ? t('companyLinkSwitchRequestedBody')
                  : t('companyLinkRequestedBody')
              );
                await supabase.auth.updateUser({
                  data: {
                    ...(authedUser.user_metadata ?? {}),
                    requested_company_code: null,
                  },
                });
            }
          } catch (linkError) {
            console.warn('Failed to link account to company', linkError);
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
  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert(t('securityResetPassword'), t('loginEnterEmailForReset'));
      return;
    }
    if (!supabase) {
      Alert.alert(t('authConfigurationMissingTitle'), t('authConfigurationMissingBody'));
      return;
    }
    const authRedirectUrl = (Constants.expoConfig?.extra?.authRedirectUrl as string | undefined)?.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: authRedirectUrl || undefined,
    });
    if (error) {
      Alert.alert(t('securityResetPassword'), error.message);
      return;
    }
    Alert.alert(t('securityResetPassword'), t('securityResetLinkSent', { email: trimmedEmail }));
  };

  const baseSiteUrl =
    ((Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim() || SUPPORT_BASE_URL).replace(
      /\/+$/,
      ''
    );
  const privacyPolicyUrl =
    ((Constants.expoConfig?.extra?.legalPrivacyUrl as string | undefined)?.trim() ||
      `${baseSiteUrl}/privacy#mobile`);
  const termsUrl =
    ((Constants.expoConfig?.extra?.legalTermsUrl as string | undefined)?.trim() || `${baseSiteUrl}/terms#mobile`);
  const helpCenterUrl =
    ((Constants.expoConfig?.extra?.legalSupportUrl as string | undefined)?.trim() ||
      `${baseSiteUrl}/support#mobile`);
  const openExternalUrl = async (title: string, url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
      Alert.alert(title, `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    } catch {
      Alert.alert(title, `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    }
  };

  const { width } = useWindowDimensions();
  const isSigninMode = mode === 'signin';
  const disablePrimaryAction = loading || !email.trim() || !password || (!isSigninMode && !confirmPassword);

  return (
    <LinearGradient
      colors={['#020617', '#080f1f', '#111827']}
      locations={[0, 0.55, 1]}
      style={styles.gradient}
    >
      <View style={styles.accentCircleLarge} />
      <View style={styles.accentCircleSmall} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
          <View style={styles.emailField}>
            <TextInput
              style={styles.emailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
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
              importantForAutofill="yes"
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
              autoCorrect={false}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={t('loginPasswordPlaceholder')}
              placeholderTextColor="#a4b3cf"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) {
                  setPasswordError(null);
                }
              }}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
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
            <>
              <View style={styles.passwordField}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  placeholder={t('signupConfirmPasswordPlaceholder')}
                  placeholderTextColor="#a4b3cf"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  textContentType="newPassword"
                  ref={confirmPasswordInputRef}
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                  editable={!loading}
                  importantForAutofill="yes"
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
              <View style={styles.passwordRulesWrap}>
                <Text style={styles.passwordRulesTitle}>{t('authPasswordRulesTitle')}</Text>
                {signupPasswordRules.map((rule) => (
                  <View key={rule.key} style={styles.passwordRuleRow}>
                    <Ionicons
                      name={rule.done ? 'checkmark-circle' : 'ellipse'}
                      size={14}
                      color={rule.done ? '#22c55e' : '#475569'}
                    />
                    <Text
                      style={[
                        styles.passwordRuleText,
                        { color: rule.done ? '#86efac' : '#9aa7bf' },
                      ]}
                    >
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.rememberRow}>
              <Text style={styles.rememberLabel}>{t('keepSignedIn')}</Text>
              <View style={styles.signinUtilityRight}>
                <TouchableOpacity
                  onPress={() => void handleForgotPassword()}
                  disabled={loading}
                  activeOpacity={0.75}
                  style={styles.forgotPasswordBtn}
                >
                  <Text style={styles.forgotPasswordText}>{t('loginForgotPassword')}</Text>
                </TouchableOpacity>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  disabled={loading}
                  trackColor={{ false: '#334155', true: '#2563eb' }}
                  thumbColor={rememberMe ? '#f8fafc' : '#cbd5f5'}
                  ios_backgroundColor="#334155"
                />
              </View>
            </View>
          )}
          <PrimaryButton
            title={mode === 'signin' ? t('loginSignInButton') : t('signupCreateButton')}
            onPress={mode === 'signin' ? handleAuthenticate : handleSignup}
            loading={loading}
            disabled={disablePrimaryAction}
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
            <View style={styles.footerRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.footerLinkChip}
                onPress={() => void openExternalUrl(t('aboutPrivacyPolicy'), privacyPolicyUrl)}
                disabled={loading}
              >
                <Text style={styles.footerLink}>{t('aboutPrivacyPolicy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.footerLinkChip}
                onPress={() => void openExternalUrl(t('aboutTerms'), termsUrl)}
                disabled={loading}
              >
                <Text style={styles.footerLink}>{t('aboutTerms')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.footerLinkChip}
                onPress={() => void openExternalUrl(t('supportHelpCenter'), helpCenterUrl)}
                disabled={loading}
              >
                <Text style={styles.footerLink}>{t('supportHelpCenter')}</Text>
              </TouchableOpacity>
            </View>
          </>
        </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardContainer: {
    width: '100%',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
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
    minHeight: 44,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  signinUtilityRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forgotPasswordBtn: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7dd3fc',
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
    minHeight: 44,
  },
  supportText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  footerRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  footerLinkChip: {
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 34,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  footerLink: {
    fontSize: 11,
    color: '#5ab7ee',
    fontWeight: '600',
  },
  passwordRulesWrap: {
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  passwordRulesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8ea0bf',
    marginBottom: 4,
  },
  passwordRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  passwordRuleText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
