import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useAuth } from '@hooks/useSupabaseAuth';
import { Link } from 'expo-router';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const provider = user?.identities?.[0]?.provider ?? 'email';

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hello, {user?.email?.split('@')[0] ?? 'there'}!</Text>
      <Text style={styles.subHeader}>Manage your account details, switch environments, or sign out.</Text>

      <View style={[styles.card, styles.statusCard]}>
        <Text style={styles.badgeLabel}>{provider.toUpperCase()} ACCESS</Text>
        <Text style={styles.badgeValue}>{user?.email ?? 'No email available'}</Text>
        <Text style={styles.badgeHelper}>Member since {formatDate(user?.created_at)}</Text>
      </View>

      <View style={styles.rowGroup}>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>Role</Text>
          <Text style={styles.miniValue}>{user ? 'Employee' : 'Guest'}</Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>Status</Text>
          <Text style={styles.miniValue}>{shiftStatus(user?.user_metadata)} </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Security</Text>
        <Text style={styles.detailLabel}>Provider</Text>
        <Text style={styles.detailValue}>{provider}</Text>
        <Text style={styles.detailLabel}>Email verified</Text>
        <Text style={styles.detailValue}>{user?.email_confirmed_at ? 'Yes' : 'No'}</Text>
      </View>

      <PrimaryButton title="Sign out" onPress={signOut} style={styles.button} />
      <Link href="/login" style={styles.link}>
        Need to switch accounts? Log in again
      </Link>
    </View>
  );
}

const shiftStatus = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return 'Active';
  const customStatus = metadata?.status;
  if (typeof customStatus === 'string' && customStatus.trim()) {
    return customStatus;
  }
  return 'Active';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
  },
  subHeader: {
    marginTop: 4,
    fontSize: 14,
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  statusCard: {
    borderLeftWidth: 6,
    borderLeftColor: '#2563eb',
  },
  badgeLabel: {
    fontSize: 12,
    color: '#2563eb',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  badgeValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  badgeHelper: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
  },
  rowGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  miniCard: {
    backgroundColor: '#fff',
    flex: 1,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  miniLabel: {
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  miniValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailLabel: {
    marginTop: 8,
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 2,
  },
  button: {
    marginTop: 32,
  },
  link: {
    marginTop: 18,
    color: '#2563eb',
    textAlign: 'center',
  },
});
