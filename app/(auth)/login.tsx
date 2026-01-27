import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { supabase } from '@lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useLanguage } from '@shared/context/LanguageContext';

const REMEMBER_KEY = 'employee-portal-remember-me';
const EMAIL_KEY = 'employee-portal-remembered-email';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
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

      if (isSigningUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) {
          throw error;
        }
        Alert.alert(t('authVerifyEmailTitle'), t('authVerifyEmailBody'));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) {
          throw error;
        }
        router.replace('(tabs)/my-shifts');
      }
    } catch (error) {
      Alert.alert(
        t('authFailedTitle'),
        error instanceof Error ? error.message : t('authUnableSignIn')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('loginTitle')}</Text>
      <Text style={styles.subtitle}>
        {isSigningUp ? t('loginCreateTitle') : t('loginSignInSubtitle')}
      </Text>
      <View style={styles.emailField}>
        <TextInput
          style={styles.emailInput}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={t('loginEmailPlaceholder')}
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
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.passwordField}>
        <TextInput
          style={styles.passwordInput}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          placeholder={t('loginPasswordPlaceholder')}
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
            color="#6b7280"
          />
        </Pressable>
      </View>
      <View style={styles.rememberRow}>
        <Text style={styles.rememberLabel}>{t('keepSignedIn')}</Text>
        <Switch value={rememberMe} onValueChange={setRememberMe} />
      </View>
      <PrimaryButton
        title={isSigningUp ? t('loginCreateButton') : t('loginSignInButton')}
        onPress={handleAuthenticate}
        loading={loading}
      />
      <TouchableOpacity style={styles.switchRow} onPress={() => setIsSigningUp(!isSigningUp)}>
        <Text style={styles.switchText}>
          {isSigningUp ? t('loginAlreadyHaveAccount') : t('loginNeedAccount')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
  },
  passwordToggle: {
    padding: 8,
  },
  emailField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emailInput: {
    flex: 1,
    paddingVertical: 14,
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
    color: '#475569',
  },
  switchRow: {
    marginTop: 12,
  },
  switchText: {
    color: '#2563eb',
    textAlign: 'center',
    fontWeight: '600',
  },
});
