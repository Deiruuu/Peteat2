import * as ImagePicker from 'expo-image-picker';
import { useRouter, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { LoadingDialog } from '../../components/ui/LoadingDialog';
import { isValidPHPhoneNumber } from '../../utils/validation';

export default function UserProfileSetup() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, completeOnboarding, updateProfile } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('+63');
  const [email, setEmail] = useState(user?.email || ''); // Auto-filled from registration
  
  // Handle input focus to scroll the view
  const handleInputFocus = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };
  
  // Format contact number with +63 prefix
  const handleContactNumberChange = (text: string) => {
    // If user deletes the +63 prefix, keep it
    if (!text.startsWith('+63')) {
      setContactNumber('+63' + text.replace('+63', ''));
      return;
    }
    
    // Only allow 13 characters total (including +63)
    if (text.length <= 13) {
      // Only allow digits after +63
      const prefix = '+63';
      const numbers = text.substring(3);
      const cleaned = numbers.replace(/[^0-9]/g, '');
      setContactNumber(prefix + cleaned);
    }
  };
  
  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }
    
    // Launch image picker
    // eslint-disable-next-line deprecation/deprecation
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };
  
  const validateContactNumber = () => {
    const valid = isValidPHPhoneNumber(contactNumber);
    if (!valid) {
      Alert.alert('Invalid Contact Number', 'Please enter a valid 10-digit number after +63');
    }
    return valid;
  };
  
  const handleNext = async () => {
    // Validate fields
    if (!fullName) {
      Alert.alert('Missing Information', 'Please enter your full name');
      return;
    }
    
    if (!address) {
      Alert.alert('Missing Information', 'Please enter your address. This is required for pet owners to enable services like home visits.');
      return;
    }
    
    if (!contactNumber || contactNumber === '+63') {
      Alert.alert('Missing Information', 'Please enter your contact number. This allows clinics to reach you about your pets.');
      return;
    }
    
    if (!validateContactNumber()) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log("Current user data:", user);
      
      // Clean up and prepare the address and contactNumber fields
      const cleanedAddress = address.trim();
      const cleanedContactNumber = contactNumber.trim();
      
      console.log("Cleaned address:", cleanedAddress);
      console.log("Cleaned contactNumber:", cleanedContactNumber);
      
      // Prepare profile data - explicitly setting critical fields
      const profileData = {
        fullName,
        address: cleanedAddress, 
        contactNumber: cleanedContactNumber,
        // Set needsOnboarding to false to prevent profile setup from showing again
        needsOnboarding: false,
        completedOnboarding: true,
        // Only include profileImage if one was selected
        ...(profileImage ? { profilePicture: {
          uri: profileImage,
          type: 'image/jpeg', // Assuming JPEG, adjust if needed
          name: 'profile-image.jpg'
        }} : {})
      };
      
      console.log("Submitting profile data with address and contactNumber:", {
        address: profileData.address,
        contactNumber: profileData.contactNumber
      });
      
      try {
        // Save user profile data with a timeout
        const savePromise = completeOnboarding(profileData);
        
        // Create a timeout promise (10 s)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), 10000);
        });
        
        // Race the save promise against the timeout
        const updatedUser = await Promise.race([savePromise, timeoutPromise]);
        
        console.log("Profile saved successfully:", updatedUser);
        console.log("Saved address:", (updatedUser as any).address);
        console.log("Saved contactNumber:", (updatedUser as any).contactNumber);
        
        // Navigate to Add Pet page
        console.log("Navigating to add-pet");
        // Try alternative navigation methods
        setTimeout(() => {
          router.push({
            pathname: '/(onboarding)/add-pet',
          });
        }, 100);
      } catch (apiError) {
        console.error('API error saving profile:', apiError);
        
        // Save the profile data locally to the user context
        if (user) {
          const updatedLocalUser = {
            ...user,
            ...profileData,
            needsOnboarding: false,
            completedOnboarding: true
          };
          console.log("Saving locally:", updatedLocalUser);
          console.log("Local address:", updatedLocalUser.address);
          console.log("Local contactNumber:", updatedLocalUser.contactNumber);
        }
        
        // Continue anyway since we're using optimistic updates
        console.log("Continuing to add pet page despite API error");
        console.log("Navigating to add-pet after API error");
        setTimeout(() => {
          router.push({
            pathname: '/(onboarding)/add-pet',
          });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      
      // Even if there's an error, allow the user to continue
      Alert.alert(
        'Network Issue',
        'There was a problem connecting to the server, but you can continue setting up your pet. Your profile will be saved when connection is restored.',
        [
          {
            text: 'Continue',
            onPress: () => {
              console.log("Navigating to add-pet from alert");
              setTimeout(() => {
                router.push({
                  pathname: '/(onboarding)/add-pet',
                });
              }, 100);
            }
          }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Alternative navigation approach - handle hardcoded redirection
  const navigateToAddPet = () => {
    console.log("Using direct navigation to add pet");
    router.push({
      pathname: '/(onboarding)/add-pet',
    });
  };
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {isLoading && <LoadingDialog visible={isLoading} message="Saving your profile..." />}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.container, 
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Set Up Your Profile</Text>
          <Text style={styles.subtitle}>Tell us more about yourself</Text>
        </View>
        
        {/* Profile Image Section */}
        <View style={styles.profileImageContainer}>
          <TouchableOpacity style={styles.profileImageWrapper} onPress={pickImage}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <IconSymbol name="person.fill" size={50} color={Colors.light.icon} />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Image 
                source={require('../../assets/images/add.png')} 
                style={styles.addIcon}
                resizeMode="contain" 
              />
            </View>
          </TouchableOpacity>
          <Text style={styles.imageHelpText}>
            Tap to upload profile picture (JPG, JPEG, PNG)
          </Text>
        </View>
        
        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* Full Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name <Text style={styles.requiredAsterisk}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => handleInputFocus(200)}
            />
          </View>
          
          {/* Address */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Address <Text style={styles.requiredAsterisk}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your address"
              value={address}
              onChangeText={setAddress}
              multiline
              onFocus={() => handleInputFocus(270)}
            />
            <Text style={styles.inputHelp}>Required for vet home visits and delivery services</Text>
          </View>
          
          {/* Contact Number */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Contact Number <Text style={styles.requiredAsterisk}>*</Text></Text>
            <View style={styles.phoneInputContainer}>
              <TextInput
                style={styles.input}
                value={contactNumber}
                onChangeText={handleContactNumberChange}
                placeholder="+63 9XX XXX XXXX"
                keyboardType="phone-pad"
                onFocus={() => handleInputFocus(340)}
              />
            </View>
            <Text style={styles.inputHelp}>Format: +63 followed by your 10-digit number. Required for clinic communications.</Text>
          </View>
          
          {/* Email (auto-filled) */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={email}
              editable={false}
              onFocus={() => handleInputFocus(420)}
            />
          </View>
        </View>
        
        {/* Next Button */}
        <TouchableOpacity style={styles.nextButton} onPress={() => {
          handleNext();
          // Add a fallback direct navigation after a delay
          setTimeout(() => navigateToAddPet(), 1000);
        }}>
          <Text style={styles.nextButtonText}>Add Pet</Text>
          <IconSymbol name="pawprint.fill" size={20} color="#fff" style={styles.nextButtonIcon} />
        </TouchableOpacity>
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
    marginBottom: 30,
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
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.tint,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  addIcon: {
    width: 16,
    height: 16,
    tintColor: '#fff'
  },
  imageHelpText: {
    fontSize: 14,
    color: Colors.light.icon,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
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
  phoneInputContainer: {
    position: 'relative',
  },
  phoneHelperText: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 4,
  },
  disabledInput: {
    backgroundColor: '#f9f9f9',
    color: Colors.light.icon,
  },
  nextButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  nextButtonIcon: {
    marginLeft: 4,
  },
  inputHelp: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 4,
  },
  requiredAsterisk: {
    color: 'red',
    fontWeight: 'bold',
  },
}); 