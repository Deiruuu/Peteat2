import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { authAPI } from '../api/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'verification' | 'reset'>('email');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const handleSendLink = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      await authAPI.forgotPassword(email);
      
      setStep('verification');
      Alert.alert(
        'Verification Code Sent',
        `A verification code has been sent to ${email}. Please check your email.`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 
                         typeof err === 'object' && err !== null && 'message' in err ? 
                         String(err.message) : 'Failed to send verification code. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleVerifyCode = async () => {
    if (!verificationCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      const result = await authAPI.verifyResetCode(email, verificationCode);
      
      if (result.resetToken) {
        setResetToken(result.resetToken);
        setStep('reset');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 
                         typeof err === 'object' && err !== null && 'message' in err ? 
                         String(err.message) : 'Invalid or expired verification code. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please enter both password fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      await authAPI.resetPassword(resetToken, newPassword, confirmPassword);
      
      Alert.alert(
        'Password Reset Successful',
        'Your password has been reset successfully. You can now log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(auth)/login')
          }
        ]
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 
                         typeof err === 'object' && err !== null && 'message' in err ? 
                         String(err.message) : 'Failed to reset password. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const goBack = () => {
    router.back();
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
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <IconSymbol name="chevron.left" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {step === 'email' ? 'Forgot Password' : 
             step === 'verification' ? 'Verify Code' : 'Reset Password'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'email' ? 'Enter your email to receive a verification code' : 
             step === 'verification' ? 'Enter the verification code sent to your email' : 
             'Create a new password for your account'}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          {step === 'email' && (
            <>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              {/* Send Link Button */}
              <TouchableOpacity 
                style={[styles.sendButton, isLoading && styles.disabledButton]} 
                onPress={handleSendLink}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send verification code</Text>
                )}
              </TouchableOpacity>
            </>
          )}
          
          {step === 'verification' && (
            <>
              {/* Verification Code Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!isLoading}
                />
              </View>

              {/* Verify Button */}
              <TouchableOpacity 
                style={[styles.sendButton, isLoading && styles.disabledButton]} 
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Verify Code</Text>
                )}
              </TouchableOpacity>
              
              {/* Resend Code */}
              <TouchableOpacity 
                style={styles.resendButton} 
                onPress={handleSendLink}
                disabled={isLoading}
              >
                <Text style={styles.resendText}>Resend Code</Text>
              </TouchableOpacity>
            </>
          )}
          
          {step === 'reset' && (
            <>
              {/* New Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
                <Text style={styles.passwordHint}>
                  Password must be at least 8 characters and include at least one number and one special character
                </Text>
              </View>
              
              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>

              {/* Reset Button */}
              <TouchableOpacity 
                style={[styles.sendButton, isLoading && styles.disabledButton]} 
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Back to Login */}
          <TouchableOpacity style={styles.backToLoginButton} onPress={goBack}>
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 16,
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
    marginBottom: 16,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: Colors.light.text,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  disabledButton: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToLoginButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '500',
  },
  errorText: {
    color: '#E53935',
    marginBottom: 16,
    fontSize: 14,
  },
  passwordHint: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 8,
  },
  resendButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '500',
  },
});