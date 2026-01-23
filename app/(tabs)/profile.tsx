import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useAuth } from '@hooks/useSupabaseAuth';
import { Link } from 'expo-router';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const profileName = (user: ReturnType<typeof useAuth>['user'] | null) => {
  if (!user) return 'Guest';
  const metadataName = user.user_metadata?.full_name;
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName;
  }
  return user.email?.split('@')[0] ?? 'Employee';
};

const shiftStatus = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return 'Active';
  const customStatus = metadata?.status;
  if (typeof customStatus === 'string' && customStatus.trim()) {
    return customStatus;
  }
  return 'Active';
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const provider = user?.identities?.[0]?.provider ?? 'email';
  const status = shiftStatus(user?.user_metadata);
  const handleSignOut = () => {
    signOut();
  };

  return (
    <ScrollView
      style={[styles.container, styles.containerLight]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerBlock}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{provider.toUpperCase()} ACCESS</Text>
          <Text style={styles.badgeDate}>Member since {formatDate(user?.created_at)}</Text>
        </View>
        <Text style={[styles.header, styles.headerLight]}>Hello, {profileName(user)}!</Text>
        <Text style={[styles.subHeader, styles.subHeaderLight]}>
          Profile settings are synced across web and Expo.
        </Text>
      </View>

      <View style={[styles.card, styles.cardLight]}>
        <Text style={[styles.title, styles.titleLight]}>Contact</Text>
        <Text style={styles.detailLabel}>Email</Text>
        <Text style={[styles.detailValue, styles.detailValueLight]}>{user?.email ?? 'Not signed in'}</Text>
        <View style={[styles.divider, styles.dividerLight]} />
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.miniLabel}>Role</Text>
            <Text style={[styles.miniValue, styles.miniValueLight]}>{user ? 'Employee' : 'Guest'}</Text>
          </View>
          <View>
            <Text style={styles.miniLabel}>Status</Text>
            <Text style={[styles.miniValue, styles.miniValueLight]}>{status}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, styles.cardLight]}>
        <Text style={[styles.title, styles.titleLight]}>Security</Text>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Provider</Text>
          <Text style={[styles.detailValue, styles.detailValueLight]}>{provider}</Text>
        </View>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Email verified</Text>
          <Text style={[styles.detailValue, styles.detailValueLight]}>
            {user?.email_confirmed_at ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      <PrimaryButton title="Sign out" onPress={handleSignOut} style={styles.button} />
      <TouchableOpacity onPress={handleSignOut}>
        <Text style={[styles.link, styles.linkLight]}>Need to switch accounts? Log in again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  content: {
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 28,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: '#0284c7',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  badgeDate: {
    color: '#64748b',
    fontSize: 11,
  },
  header: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
  },
  subHeader: {
    marginTop: 4,
    fontSize: 14,
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  detailLabel: {
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 2,
  },
  detailBlock: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniLabel: {
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  miniValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 4,
  },
  button: {
    marginTop: 18,
  },
  link: {
    marginTop: 18,
    color: '#2563eb',
    textAlign: 'center',
    fontSize: 14,
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },
  cardLight: {
    backgroundColor: '#fff',
  },
  headerLight: {
    color: '#0f172a',
  },
  subHeaderLight: {
    color: '#475569',
  },
  detailValueLight: {
    color: '#0f172a',
  },
  linkLight: {
    color: '#2563eb',
  },
});
