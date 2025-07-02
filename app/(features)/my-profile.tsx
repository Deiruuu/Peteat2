import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { useUserRole } from '../contexts/UserRoleContext';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ImageSourcePropType
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../api/api';

// Define interfaces for user data
interface UserData {
  name: string;
  email: string;
  profilePic: ImageSourcePropType;
  phoneNumber: string;
  landline: string;
  username: string;
  address: string;
}

interface ClinicData {
  name: string;
  email: string;
  profilePic: ImageSourcePropType;
  phoneNumber: string;
  landline: string;
  address: string;
  operatingHours: string;
  numberOfStaff: string;
  role: string;
}

export default function MyProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userRole } = useUserRole();
  const { user, updateProfile } = useAuth();
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // User data state with default values
  const [userData, setUserData] = useState<UserData>({
    name: "",
    email: "",
    profilePic: require("../../assets/images/robert-pisot.jpg"),
    phoneNumber: "",
    landline: "",
    username: "",
    address: "",
  });

  const [clinicData, setClinicData] = useState<ClinicData>({
    name: "",
    email: "",
    profilePic: require("../../assets/images/peteat-logo.png"),
    phoneNumber: "",
    landline: "",
    address: "",
    operatingHours: "",
    numberOfStaff: "",
    role: ""
  });
  
  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);
  
  // Function to fetch user data from API
  const fetchUserData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get user profile from API
      const profileData = await authAPI.getProfile();
      console.log("Fetched profile data:", profileData);
      
      if (userRole === 'user') {
        setUserData({
          name: profileData.fullName || "",
          email: profileData.email || "",
          profilePic: profileData.profilePicture 
            ? { uri: profileData.profilePicture } 
            : require("../../assets/images/robert-pisot.jpg"),
          phoneNumber: profileData.contactNumber || "",
          landline: profileData.landline || "",
          username: profileData.username || profileData.email?.split('@')[0] || "",
          address: profileData.address || "",
        });
      } else {
        // Clinic data
        setClinicData({
          name: profileData.clinicName || profileData.fullName || "",
          email: profileData.email || "",
          profilePic: profileData.profilePicture 
            ? { uri: profileData.profilePicture }
            : require("../../assets/images/peteat-logo.png"),
          phoneNumber: profileData.contactNumber || "",
          landline: profileData.landline || "",
          address: profileData.address || "",
          operatingHours: `${profileData.openingHour || "9:00 AM"} - ${profileData.closingHour || "6:00 PM"}`,
          numberOfStaff: profileData.numberOfStaff?.toString() || "0",
          role: profileData.role || "Owner"
        });
      }
      
      // Log for debugging
      console.log("Profile address:", profileData.address);
      console.log("Profile contactNumber:", profileData.contactNumber);
      
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to go back to the account page
  const goBack = () => {
    router.back();
  };
  
  // Function to handle profile image change
  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (userRole === 'user') {
          setUserData({...userData, profilePic: {uri: result.assets[0].uri}});
        } else {
          setClinicData({...clinicData, profilePic: {uri: result.assets[0].uri}});
        }
      }
    } catch (err) {
      console.error("Error picking image:", err);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };
  
  // Function to save profile changes
  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Check if profile pic is a URI-based object or a required image
      const isUserProfilePicUri = typeof userData.profilePic === 'object' && 'uri' in userData.profilePic;
      const isClinicProfilePicUri = typeof clinicData.profilePic === 'object' && 'uri' in clinicData.profilePic;
      
      // Prepare data for API call
      const dataToUpdate = userRole === 'user' ? {
        fullName: userData.name,
        email: userData.email,
        contactNumber: userData.phoneNumber,
        landline: userData.landline,
        username: userData.username,
        address: userData.address,
        // Only include profilePicture if it's a URI-based image
        ...(isUserProfilePicUri && {
          profilePicture: {
            uri: (userData.profilePic as {uri: string}).uri,
            type: 'image/jpeg',
            name: 'profile-image.jpg'
          }
        })
      } : {
        clinicName: clinicData.name,
        fullName: clinicData.name, // Keep fullName in sync
        email: clinicData.email,
        contactNumber: clinicData.phoneNumber,
        landline: clinicData.landline,
        address: clinicData.address,
        // Parse operating hours
        ...(clinicData.operatingHours.includes('-') && {
          openingHour: clinicData.operatingHours.split('-')[0].trim(),
          closingHour: clinicData.operatingHours.split('-')[1].trim()
        }),
        numberOfStaff: parseInt(clinicData.numberOfStaff) || 0,
        role: clinicData.role,
        // Only include profilePicture if it's a URI-based image
        ...(isClinicProfilePicUri && {
          profilePicture: {
            uri: (clinicData.profilePic as {uri: string}).uri,
            type: 'image/jpeg',
            name: 'profile-image.jpg'
          }
        })
      };
      
      console.log("Updating profile with data:", dataToUpdate);
      
      // Call API to update profile
      await updateProfile(dataToUpdate);
      
      Alert.alert("Success", "Profile updated successfully!");
      
      // Refresh the profile data after update
      fetchUserData();
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile. Please try again.");
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine which profile data to show based on role
  const profileData = userRole === 'clinic' ? clinicData : userData;
  const updateProfileData = userRole === 'clinic' 
    ? (field: string, value: string) => setClinicData({...clinicData, [field]: value as any})
    : (field: string, value: string) => setUserData({...userData, [field]: value as any});
  
  // Show loading indicator while fetching data
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loadingText}>Loading profile data...</Text>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Section */}
        <View style={styles.topBar}>
          {/* Top Left Back Button */}
          <TouchableOpacity style={styles.iconButton} onPress={goBack}>
            <Image 
              source={require('../../assets/images/left-arrow.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <Text style={styles.screenTitle}>My Profile</Text>
          
          <TouchableOpacity style={styles.iconButton} onPress={fetchUserData}>
            <IconSymbol name="arrow.clockwise" size={20} color={Colors.light.tint} />
          </TouchableOpacity>
        </View>
        
        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.profileSection}>
            {/* Profile Picture */}
            <View style={styles.profileImageContainer}>
              <Image 
                source={profileData.profilePic}
                style={styles.profilePic}
              />
              <TouchableOpacity style={styles.editImageButton} onPress={handleImagePick}>
                <Image
                  source={require('../../assets/images/add.png')} 
                  style={styles.addIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
            
            {/* Common Editable Fields */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {userRole === 'user' ? 'Full Name' : 'Clinic Name'}
              </Text>
              <TextInput 
                style={styles.input} 
                value={userRole === 'user' ? userData.name : clinicData.name}
                onChangeText={(value) => updateProfileData('name', value)}
                placeholder={userRole === 'user' ? "Enter your name" : "Enter clinic name"}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput 
                style={styles.input} 
                value={profileData.email}
                onChangeText={(value) => updateProfileData('email', value)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput 
                style={styles.input} 
                value={profileData.phoneNumber}
                onChangeText={(value) => updateProfileData('phoneNumber', value)}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
              <Text style={styles.fieldHelp}>Format: +63 followed by your 10-digit number</Text>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Landline</Text>
              <TextInput 
                style={styles.input} 
                value={profileData.landline}
                onChangeText={(value) => updateProfileData('landline', value)}
                placeholder="Enter landline number (optional)"
                keyboardType="phone-pad"
              />
            </View>
            
            {userRole === 'user' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Username / Display Name</Text>
                <TextInput 
                  style={styles.input} 
                  value={userData.username}
                  onChangeText={(value) => updateProfileData('username', value)}
                  placeholder="Enter your username"
                  autoCapitalize="none"
                />
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Address</Text>
              <TextInput 
                style={[styles.input, styles.multilineInput]} 
                value={profileData.address}
                onChangeText={(value) => updateProfileData('address', value)}
                placeholder="Enter your address"
                multiline
              />
              <Text style={styles.fieldHelp}>Your address is important for vet home visits and delivery services</Text>
            </View>
            
            {/* Clinic-specific fields */}
            {userRole === 'clinic' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Operating Hours</Text>
                  <TextInput 
                    style={styles.input} 
                    value={clinicData.operatingHours}
                    onChangeText={(value) => updateProfileData('operatingHours', value)}
                    placeholder="Enter operating hours"
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Number of Staff</Text>
                  <TextInput 
                    style={styles.input} 
                    value={clinicData.numberOfStaff}
                    onChangeText={(value) => updateProfileData('numberOfStaff', value)}
                    placeholder="Enter staff count"
                    keyboardType="number-pad"
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Role/Designation</Text>
                  <TextInput 
                    style={styles.input} 
                    value={clinicData.role}
                    onChangeText={(value) => updateProfileData('role', value)}
                    placeholder="Enter your role (e.g., Owner, Vet)"
                  />
                </View>
              </>
            )}
            
            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
              onPress={handleSaveChanges}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// Add missing colors
const extendedColors = {
  ...Colors.light,
  disabled: '#aaaaaa',
  errorBackground: '#ffebee',
  errorText: '#d32f2f',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: Colors.light.text,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  profileSection: {
    width: '100%',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    width: 120,
    height: 120,
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  addIcon: {
    width: 18,
    height: 18,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: Colors.light.text,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    backgroundColor: extendedColors.disabled,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.light.text,
    marginTop: 16,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: extendedColors.errorBackground,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: extendedColors.errorText,
  },
  fieldHelp: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 4,
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
}); 