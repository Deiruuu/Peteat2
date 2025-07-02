import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../../constants/Colors';

export default function WaitingAreaScreen() {
  const router = useRouter();
  const { user, isLoading, logout, completeOnboarding } = useAuth();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  // Poll every 10 s to see if clinic has been approved
  useEffect(() => {
    if (!user) return;
    let intervalId: any;

    const pollApproval = async () => {
      try {
        setChecking(true);
        const refreshed = await completeOnboarding({}); // pulls fresh profile
        if (refreshed.isApproved) {
          // Navigate to home tabs
          router.replace('/(tabs)');
        }
      } catch (err) {
        console.log('Approval polling error', err);
        setError('Unable to contact server, will retry…');
      } finally {
        setChecking(false);
      }
    };

    pollApproval();
    intervalId = setInterval(pollApproval, 10000);

    return () => clearInterval(intervalId);
  }, [user]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your clinic account is pending approval</Text>
      <Text style={styles.subtitle}>We will notify you once an admin approves your registration.</Text>
      {checking || isLoading ? <ActivityIndicator size="large" color={Colors.light.tint} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: Colors.light.icon,
    marginBottom: 24,
  },
  error: {
    color: 'red',
    marginTop: 8,
  },
  logoutButton: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
}); 