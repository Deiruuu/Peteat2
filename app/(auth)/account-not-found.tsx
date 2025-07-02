import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';

export default function AccountNotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Not Found</Text>
      <Text style={styles.subtitle}>We couldn't find an account associated with that email address.</Text>
      <TouchableOpacity style={styles.signupButton} onPress={() => router.replace('/(auth)/signup' as any)}>
        <Text style={styles.signupText}>Go to Sign-Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.icon,
    textAlign: 'center',
    marginBottom: 24,
  },
  signupButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  signupText: {
    color: '#fff',
    fontWeight: '700',
  },
}); 