import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { LoadingDialog } from '@/components/ui/LoadingDialog';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

export default function VerifyOTPScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email, userType } = useLocalSearchParams();
  const { requestOtp, verifyOtp } = useAuth();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(180); // 3 minutes countdown
  
  const inputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);

  useEffect(() => {
    // Start countdown timer
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    // When countdown reaches 0, you can enable a "Resend OTP" button
  }, [countdown]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle OTP input changes
  const handleOtpChange = (text: string, index: number) => {
    if (/^[0-9]?$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      
      // Auto-focus to next input if this one is filled
      if (text !== '' && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  // Handle backspace key press
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      await requestOtp(email as string);
      
      setCountdown(180); // Reset countdown to 3 minutes
      Alert.alert('Success', 'A new verification code has been sent to your email');
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      setError(error.response?.data?.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    try {
      const otpValue = otp.join('');
      
      if (otpValue.length !== 6) {
        setError('Please enter the complete 6-digit verification code');
        return;
      }
      
      setIsLoading(true);
      setError('');
      
      const response = await verifyOtp(email as string, otpValue);
      
      // Handle successful verification
      Alert.alert('Success', response.message, [
        { 
          text: 'OK', 
          onPress: () => {
            // Navigate based on user type - temporarily bypassing approval flow
            if (userType === 'pet_owner') {
              router.replace('/(onboarding)/user-profile' as any);
            } else {
              router.replace('/(onboarding)/clinic-profile' as any);
            }
          }
        }
      ]);
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      setError(error.response?.data?.message || 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <IconSymbol name="arrow.left" size={24} color={Colors.light.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit verification code to {email}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Error message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* OTP input boxes */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.otpInput}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                testID={`otp-input-${index}`}
              />
            ))}
          </View>

          {/* Timer */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              {countdown > 0 ? `Code expires in: ${formatTime(countdown)}` : 'Code expired'}
            </Text>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              otp.some(digit => digit === '') && styles.verifyButtonDisabled
            ]}
            onPress={handleVerifyOtp}
            disabled={otp.some(digit => digit === '') || isLoading}
          >
            <Text style={styles.verifyButtonText}>Verify</Text>
          </TouchableOpacity>

          {/* Resend Code */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity 
              onPress={handleResendOtp}
              disabled={countdown > 0 || isLoading}
            >
              <Text 
                style={[
                  styles.resendLink,
                  countdown > 0 && styles.resendLinkDisabled
                ]}
              >
                Resend
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Loading Overlay */}
        {isLoading && <LoadingDialog visible={true} message="Verifying..." />}
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
  backButton: {
    marginBottom: 20,
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
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    fontSize: 14,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpInput: {
    width: 45,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    fontSize: 20,
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  timerText: {
    fontSize: 14,
    color: Colors.light.icon,
  },
  verifyButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  resendText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  resendLink: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '500',
  },
  resendLinkDisabled: {
    color: Colors.light.icon,
  },
});
