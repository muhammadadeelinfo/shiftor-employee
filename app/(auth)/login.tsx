import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuth } from '../../hooks/useSupabaseAuth';

export default function LoginScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter the email you registered with.');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmail(email.trim());
      Alert.alert('Check your inbox', 'We sent a login link to your email.');
    } catch (error) {
      Alert.alert('Authentication failed', error instanceof Error ? error.message : 'Unable to log you in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Employee Portal</Text>
      <Text style={styles.subtitle}>Sign in with your company email.</Text>
      <TextInput
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@company.com"
        value={email}
        onChangeText={setEmail}
      />
      <PrimaryButton title="Send magic link" onPress={handleSubmit} loading={loading} />
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
});
