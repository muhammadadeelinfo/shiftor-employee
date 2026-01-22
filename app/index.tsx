import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useSupabaseAuth';

export default function RootIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    router.replace(user ? '(tabs)/my-shifts' : '/login');
  }, [loading, router, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.text}>{loading ? 'Checking your session...' : 'Preparing your workspace…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  text: {
    color: '#6b7280',
  },
});
