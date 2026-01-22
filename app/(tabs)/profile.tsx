import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuth } from '../../hooks/useSupabaseAuth';
import { Link } from 'expo-router';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Profile</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? 'Not signed in'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>User ID</Text>
        <Text style={styles.value}>{user?.id ?? '—'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Auth Provider</Text>
        <Text style={styles.value}>{user?.identities?.[0]?.provider ?? 'email'}</Text>
      </View>
      <PrimaryButton title="Sign out" onPress={signOut} style={styles.button} />
      <Link href="/login" style={styles.link}>
        Need to switch accounts? Log in again
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  button: {
    marginTop: 24,
  },
  link: {
    marginTop: 16,
    color: '#2563eb',
    textAlign: 'center',
  },
});
