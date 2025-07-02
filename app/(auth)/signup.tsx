import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { LoadingDialog } from '@/components/ui/LoadingDialog';
import { useAuth } from '../contexts/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { Alert as RNAlert } from 'react-native';
import { Input } from '@/components/ui/Input';
import { useErrorPrompt } from '@/components/ui/ErrorPrompt';

// This registers your app for handling redirects
WebBrowser.maybeCompleteAuthSession();

// Function to retry operations with exponential backoff
const retryOperation = async (
  operation: () => Promise<any>,
  maxRetries = 3,
  delay = 1000
): Promise<any> => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      // Only wait if we're going to retry
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
        const waitTime = delay * Math.pow(2, attempt) * jitter;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
};

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { register, loginWithGoogle } = useAuth();
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'pet_owner' | 'clinic'>('pet_owner');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { show: showError } = useErrorPrompt();

  // Password validation states
  const [isLengthValid, setIsLengthValid] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasSpecial, setHasSpecial] = useState(false);

  // Google Sign-Up setup (optional)
  const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'DUMMY';
  const isGoogleConfigured = GOOGLE_CLIENT_ID !== 'DUMMY';

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'peteat' })
  });

  // Check password validations
  useEffect(() => {
    setIsLengthValid(password.length >= 8);
    setHasNumber(/\d/.test(password));
    setHasSpecial(/[!@#$%^&*(),.?":{}|<>]/.test(password));
  }, [password]);

  const handleGoogleSignUp = async () => {
    if (!isGoogleConfigured) {
      RNAlert.alert('Google Sign-up unavailable', 'Google OAuth is not configured for this build.');
      return;
    }

      setIsLoading(true);
      setError('');
      
      const result = await promptAsync();
      
      if (result.type === 'success' && result.authentication) {
        await loginWithGoogle(result.authentication.accessToken);
      } else {
        setError('Google sign in was cancelled or failed');
    }
  };

  const handleRegister = async () => {
    // Validate fields
    if (!name || !username || !email || !password || !role) {
      showError({ title: 'Missing Info', message: 'Please fill in all required fields' });
      return;
    }
    
    // Validate additional clinic fields
    if (role === 'clinic' && !licenseNumber) {
      showError({ title: 'Missing Info', message: 'Please enter your clinic license number' });
      return;
    }
    
    // Validate clinic name for clinic users
    if (role === 'clinic' && !clinicName) {
      showError({ title: 'Missing Info', message: 'Please enter your clinic name' });
      return;
    }
    
    // Validate password
    if (!isLengthValid || !hasNumber || !hasSpecial) {
      showError({ title: 'Weak Password', message: 'Please ensure your password meets all requirements' });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Use retry mechanism for registration
      const user = await retryOperation(async () => {
        return await register({
          fullName: name,
          username: username,
          email,
          password,
          userType: role === 'clinic' ? 'clinic' : 'pet_owner',
          ...(role === 'clinic' ? { 
            licenseNumber,
            clinicName  // Add clinic name for clinic registration
          } : {})
        });
      }, 3, 2000);
      
      setIsLoading(false);
      
      // Send user to OTP verification screen
      router.replace({
        pathname: '/(auth)/verify-otp',
        params: { email, userType: role }
      });
    } catch (error) {
      setIsLoading(false);
      
      // Show a more user-friendly error message for network issues
      const errorMessage = String(error);
      if (errorMessage.includes('Network Error') || errorMessage.includes('timeout')) {
        Alert.alert(
          'Connection Error',
          'We\'re having trouble connecting to our servers. Your account may have been created, please try logging in or check your internet connection.',
          [
            { text: 'Try Login', onPress: () => router.replace('/(auth)/login') },
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Registration Error', typeof error === 'string' ? error : 'Failed to register. Please try again.');
      }
    }
  };

  const goToLogin = () => {
    router.back();
  };
  
  // Handle input focus to scroll the view
  const handleInputFocus = (y: number, isPassword = false) => {
    if (isPassword) {
      setPasswordFocused(true);
    }
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };
  
  const handlePasswordBlur = () => {
    setPasswordFocused(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.container, 
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.formContainer}>
          {/* Google Sign Up Button */}
          {isGoogleConfigured && (
          <TouchableOpacity 
            style={styles.googleButton} 
            onPress={handleGoogleSignUp}
            disabled={!request || isLoading}
          >
            <Image 
              source={require('../../assets/images/google.jpg')} 
              style={styles.googleIcon} 
              resizeMode="contain"
            />
            <Text style={styles.googleButtonText}>Sign up with Google</Text>
          </TouchableOpacity>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Error Message */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Name Input */}
          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
          />

          {/* Username Input */}
          <Input
            label="Username"
            placeholder="Choose a unique username"
            value={username}
            onChangeText={setUsername}
          />

          {/* Email Input */}
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          {/* Password Input */}
          <Input
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Password Requirements */}
          {passwordFocused && (
            <View style={styles.passwordRequirements}>
              <View style={styles.requirementRow}>
                <IconSymbol 
                  name={isLengthValid ? "checkmark.circle.fill" : "circle"} 
                  size={16} 
                  color={isLengthValid ? Colors.light.tint : Colors.light.icon} 
                />
                <Text style={[
                  styles.requirementText, 
                  isLengthValid && styles.validRequirement
                ]}>
                  At least 8 characters
                </Text>
              </View>
              
              <View style={styles.requirementRow}>
                <IconSymbol 
                  name={hasNumber ? "checkmark.circle.fill" : "circle"} 
                  size={16} 
                  color={hasNumber ? Colors.light.tint : Colors.light.icon} 
                />
                <Text style={[
                  styles.requirementText, 
                  hasNumber && styles.validRequirement
                ]}>
                  At least 1 number
                </Text>
              </View>
              
              <View style={styles.requirementRow}>
                <IconSymbol 
                  name={hasSpecial ? "checkmark.circle.fill" : "circle"} 
                  size={16} 
                  color={hasSpecial ? Colors.light.tint : Colors.light.icon} 
                />
                <Text style={[
                  styles.requirementText, 
                  hasSpecial && styles.validRequirement
                ]}>
                  At least 1 special character (e.g., !)
                </Text>
              </View>
            </View>
          )}

          {/* Role Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>I am a:</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity 
                style={[
                  styles.roleButton, 
                  role === 'pet_owner' && styles.roleButtonSelected
                ]}
                onPress={() => setRole('pet_owner')}
              >
                <IconSymbol 
                  name="person.fill" 
                  size={20} 
                  color={role === 'pet_owner' ? '#fff' : Colors.light.text} 
                />
                <Text style={[
                  styles.roleButtonText,
                  role === 'pet_owner' && styles.roleButtonTextSelected
                ]}>
                  Pet Owner
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.roleButton, 
                  role === 'clinic' && styles.roleButtonSelected
                ]}
                onPress={() => setRole('clinic')}
              >
                <IconSymbol 
                  name="building.2.fill" 
                  size={20} 
                  color={role === 'clinic' ? '#fff' : Colors.light.text} 
                />
                <Text style={[
                  styles.roleButtonText,
                  role === 'clinic' && styles.roleButtonTextSelected
                ]}>
                  Veterinary Clinic
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* License Number (only for clinics) */}
          {role === 'clinic' && (
            <Input
              label="License Number"
              placeholder="Enter your clinic license number"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
            />
          )}
          
          {/* Clinic Name (only for clinics) */}
          {role === 'clinic' && (
            <Input
              label="Clinic Name"
              placeholder="Enter your clinic name"
              value={clinicName}
              onChangeText={setClinicName}
            />
          )}

          {/* Sign Up Button */}
          <TouchableOpacity 
            style={[
              styles.signUpButton, 
              (!name || !username || !email || !password || !role || !isLengthValid || !hasNumber || !hasSpecial) && 
              styles.signUpButtonDisabled
            ]}
            onPress={handleRegister}
            disabled={!name || !username || !email || !password || !role || !isLengthValid || !hasNumber || !hasSpecial || isLoading}
          >
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>

          {/* Log In Prompt */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={goToLogin}>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading Overlay */}
        {isLoading && <LoadingDialog visible={true} message="Creating account..." />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.icon,
  },
  formContainer: {
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: Colors.light.icon,
    fontSize: 14,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordRequirements: {
    marginTop: 12,
    marginBottom: 4,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: Colors.light.icon,
    marginLeft: 8,
  },
  validRequirement: {
    color: Colors.light.tint,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  roleButtonSelected: {
    backgroundColor: Colors.light.tint,
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginLeft: 8,
  },
  roleButtonTextSelected: {
    color: '#fff',
  },
  signUpButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  loginLink: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '500',
  },
}); 