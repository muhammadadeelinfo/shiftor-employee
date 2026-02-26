import { Alert, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { supabase } from '@lib/supabaseClient';
import { useLanguage } from '@shared/context/LanguageContext';

const MIN_PASSWORD_LENGTH = 8;

export default function SignupScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

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

      Alert.alert(t('authVerifyEmailTitle'), t('authVerifyEmailBody'), [
        {
          text: t('back'),
          onPress: () => router.replace('/login'),
        },
      ]);
    } catch (error) {
      Alert.alert(t('authFailedTitle'), error instanceof Error ? error.message : t('authUnableSignIn'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#020617', '#080f1f', '#111827']} locations={[0, 0.55, 1]} style={styles.gradient}>
      <View style={styles.accentCircleLarge} />
      <View style={styles.accentCircleSmall} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('signupTitle')}</Text>
          <Text style={styles.subtitle}>{t('signupSubtitle')}</Text>

          <View style={styles.inputField}>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('signupFullNamePlaceholder')}
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputField}>
            <TextInput
              style={styles.input}
              value={companyCode}
              onChangeText={setCompanyCode}
              placeholder={t('signupCompanyCodePlaceholder')}
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputField}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('loginEmailPlaceholder')}
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={styles.inputField}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('loginPasswordPlaceholder')}
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
              ref={passwordRef}
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('loginHidePassword') : t('loginShowPassword')}
              style={styles.eyeButton}
              disabled={loading}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#cbd5f5" />
            </Pressable>
          </View>

          <View style={styles.inputField}>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('signupConfirmPasswordPlaceholder')}
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!loading}
              ref={confirmPasswordRef}
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />
            <Pressable
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showConfirmPassword ? t('loginHidePassword') : t('loginShowPassword')}
              style={styles.eyeButton}
              disabled={loading}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#cbd5f5"
              />
            </Pressable>
          </View>

          <PrimaryButton title={t('signupCreateButton')} onPress={handleSignup} loading={loading} />

          <TouchableOpacity
            style={styles.backRow}
            activeOpacity={0.7}
            onPress={() => router.replace('/login')}
            disabled={loading}
          >
            <Ionicons name="arrow-back-circle-outline" size={18} color="#94a3b8" />
            <Text style={styles.backText}>{t('signupBackToLogin')}</Text>
          </TouchableOpacity>
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
    width: '100%',
    maxWidth: 420,
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
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 20,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111629',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#e2e8f0',
  },
  eyeButton: {
    padding: 8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  backText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
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
});
