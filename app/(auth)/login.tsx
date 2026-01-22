import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import { PrimaryButton } from '../../components/PrimaryButton';
import { supabase } from '../../lib/supabaseClient';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleAuthenticate = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Email and password required', 'Please enter both email and password.');
      return;
    }

    if (!supabase) {
      Alert.alert('Configuration missing', 'Set SUPABASE_URL and SUPABASE_ANON_KEY before logging in.');
      return;
    }

    try {
      setLoading(true);
      if (isSigningUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) {
          throw error;
        }
        Alert.alert('Verify your email', 'We sent a verification link to activate your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) {
          throw error;
        }
      }
    } catch (error) {
      Alert.alert('Authentication failed', error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Employee Portal</Text>
      <Text style={styles.subtitle}>
        {isSigningUp ? 'Create your account' : 'Sign in with your company credentials.'}
      </Text>
      <TextInput
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@company.com"
        value={email}
        onChangeText={setEmail}
        textContentType="emailAddress"
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        textContentType="password"
      />
      <PrimaryButton
        title={isSigningUp ? 'Create account' : 'Sign in'}
        onPress={handleAuthenticate}
        loading={loading}
      />
      <TouchableOpacity style={styles.switchRow} onPress={() => setIsSigningUp(!isSigningUp)}>
        <Text style={styles.switchText}>
          {isSigningUp ? 'Already have an account? Sign in' : 'Need a new account? Sign up'}
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
