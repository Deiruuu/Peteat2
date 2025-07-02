import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert as RNAlert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { LoadingDialog } from '@/components/ui/LoadingDialog';
import { useAuth } from '../contexts/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import { Input } from '@/components/ui/Input';
import { useErrorPrompt } from '@/components/ui/ErrorPrompt';

// This registers your app for handling redirects
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { login, loginWithGoogle, requestOtp } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { show: showError } = useErrorPrompt();
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      const user = await login(email, password, rememberMe);
      
      setIsLoading(false);
      
      // Check if user is verified
      if (user && !user.isVerified) {
        // User is not verified, send to OTP verification
        RNAlert.alert(
          'Email Not Verified',
          'Your email has not been verified. We will send you a verification code.',
          [
            {
              text: 'OK',
              onPress: async () => {
                try {
                  // Request a new OTP for the user
                  await requestOtp(email);
                  
                  // Navigate to the OTP verification screen
                  router.replace({
                    pathname: '/(auth)/verify-otp',
                    params: { email, userType: user.userType }
                  });
                } catch (error) {
                  RNAlert.alert('Error', 'Failed to send verification code. Please try again later.');
                }
              }
            }
          ]
        );
        return;
      }
      
      // Handle users need profile completion
      if (user.needsOnboarding) {
        // Direct to onboarding flows based on user type
        if (user.userType === 'pet_owner') {
          router.replace('/(onboarding)/user-profile');
        } else if (user.userType === 'clinic') {
          router.replace('/(onboarding)/clinic-profile');
        }
      } else {
        // User already completed onboarding, go to main app
        router.replace('/(tabs)/' as any);
      }
    } catch (error) {
      setIsLoading(false);
      
      // Handle specific error messages
      if (typeof error === 'object' && error !== null && 'message' in error) {
        const errorMessage = error.message;
        
        if (typeof errorMessage === 'string') {
          if (errorMessage.includes('credentials')) {
            setError('Invalid email or password');
          } else if (errorMessage.includes('not approved')) {
            setError('Your account is pending approval');
          } else {
            setError(errorMessage);
          }
        } else {
          setError('An error occurred. Please try again.');
        }
      } else {
        setError('Login failed. Please check your credentials.');
      }
    }
  };

  const goToSignUp = () => {
    router.push('/(auth)/signup');
  };
  
  const goToForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };
  
  // Handle input focus to scroll the view
  const handleInputFocus = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.formContainer}>
          {/* Error Message */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <Input
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <Input
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Remember Me and Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity 
              style={styles.rememberMeContainer} 
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <IconSymbol name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={goToForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity 
            style={[styles.loginButton, (!email || !password) && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={!email || !password || isLoading}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>

          {/* Sign Up Prompt */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={goToSignUp}>
              <Text style={styles.signUpLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading Overlay */}
        {isLoading && <LoadingDialog visible={true} message="Logging in..." />}
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: Colors.light.icon,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  rememberMeText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  signUpLink: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '500',
  },
}); 