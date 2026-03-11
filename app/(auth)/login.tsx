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
import { supabase } from '@lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useLanguage } from '@shared/context/LanguageContext';
import {
  buildSupportMailto,
  SUPPORT_EMAIL,
  SUPPORT_FALLBACK_URL,
} from '@shared/utils/support';
import { getUserFacingErrorMessage } from '@shared/utils/userFacingError';

const REMEMBER_KEY = 'employee-portal-remember-me';
const EMAIL_KEY = 'employee-portal-remembered-email';
const SUPPORT_BASE_URL = 'https://shiftorapp.com';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const isIOS = Platform.OS === 'ios';
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

  useEffect(() => {
    (async () => {
      const storedRemember = await AsyncStorage.getItem(REMEMBER_KEY);
      if (storedRemember !== null) {
        setRememberMe(storedRemember === 'true');
      }
      const storedEmail = await AsyncStorage.getItem(EMAIL_KEY);
      if (storedEmail) {
        setRememberedEmail(storedEmail);
        setEmail(storedEmail);
      }
    })();
  }, []);

  useEffect(() => {
    if (rememberMe && rememberedEmail) {
      setEmail((current) => (current.trim() ? current : rememberedEmail));
    }
  }, [rememberMe, rememberedEmail]);

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

      router.replace('/my-shifts');
    } catch (error) {
      console.warn('Sign-in failed', error);
      Alert.alert(
        t('authFailedTitle'),
        getUserFacingErrorMessage(error, {
          fallback: t('authUnableSignIn'),
          invalidCredentials: t('authInvalidCredentialsBody'),
          emailNotConfirmed: t('authVerifyEmailBody'),
        })
      );
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
      if (!isIOS) {
        const fallbackSupported = await Linking.canOpenURL(SUPPORT_FALLBACK_URL);
        if (fallbackSupported) {
          await Linking.openURL(SUPPORT_FALLBACK_URL);
          return;
        }
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
      console.warn('Password reset request failed', error);
      Alert.alert(
        t('securityResetPassword'),
        getUserFacingErrorMessage(error, {
          fallback: t('authGenericOperationFailed'),
        })
      );
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
  const disablePrimaryAction = loading || !email.trim() || !password;

  return (
    <LinearGradient
      colors={['#020617', '#080f1f', '#111827']}
      locations={[0, 0.55, 1]}
      style={styles.gradient}
    >
      <View style={styles.accentCircleLarge} />
      <View style={styles.accentCircleSmall} />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/jobs');
          }}
          disabled={loading}
          activeOpacity={0.75}
          style={styles.pageBackButton}
        >
          <Ionicons name="chevron-back" size={17} color="#e2e8f0" />
          <Text style={styles.pageBackButtonText}>{t('loginBackToJobs')}</Text>
        </TouchableOpacity>
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
          <Text style={styles.subtitle}>{t('loginSignInSubtitle')}</Text>
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
              autoComplete="current-password"
              placeholder={t('loginPasswordPlaceholder')}
              placeholderTextColor="#a4b3cf"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) {
                  setPasswordError(null);
                }
              }}
              textContentType="password"
              ref={passwordInputRef}
              returnKeyType="done"
              onSubmitEditing={handleAuthenticate}
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
          <PrimaryButton
            title={t('loginSignInButton')}
            onPress={handleAuthenticate}
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
            {!isIOS ? (
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
            ) : null}
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
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: 16,
  },
  pageBackButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.44)',
    paddingHorizontal: 10,
    minHeight: 34,
  },
  pageBackButtonText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
});
