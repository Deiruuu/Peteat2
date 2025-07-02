import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
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
  Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import LocationPicker from '../../components/LocationPicker';
import { useAuth } from '../contexts/AuthContext';
import { LoadingDialog } from '../../components/ui/LoadingDialog';
import { isValidPHPhoneNumber } from '../../utils/validation';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export default function ClinicProfileSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, completeOnboarding } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState(user?.clinicName || '');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [openTime, setOpenTime] = useState(new Date());
  const [closeTime, setCloseTime] = useState(new Date(new Date().setHours(17, 0, 0, 0)));
  const [landline, setLandline] = useState('');
  const [cellphone, setCellphone] = useState('+63');
  const [website, setWebsite] = useState('');
  const [businessPermit, setBusinessPermit] = useState<any>(null);
  const [validID, setValidID] = useState<any>(null);
  
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);
  
  // Handle input focus to scroll the view
  const handleInputFocus = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };
  
  // Format contact number with +63 prefix
  const handleContactNumberChange = (text: string) => {
    // If user deletes the +63 prefix, keep it
    if (!text.startsWith('+63')) {
      setCellphone('+63' + text.replace('+63', ''));
      return;
    }
    
    // Only allow 13 characters total (including +63)
    if (text.length <= 13) {
      // Only allow digits after +63
      const prefix = '+63';
      const numbers = text.substring(3);
      const cleaned = numbers.replace(/[^0-9]/g, '');
      setCellphone(prefix + cleaned);
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
  
  const pickDocument = async (type: 'permit' | 'id') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: type === 'permit' ? ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] : ['image/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        return;
      }
      
      if (type === 'permit') {
        setBusinessPermit(result.assets[0]);
      } else {
        setValidID(result.assets[0]);
      }
    } catch (error) {
      console.log('Error picking document:', error);
    }
  };
  
  const formatTimeString = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    return `${hours}:${minutesStr} ${ampm}`;
  };
  
  const onOpenTimeChange = (event: any, selectedDate?: Date) => {
    setShowOpenPicker(false);
    if (selectedDate) {
      setOpenTime(selectedDate);
    }
  };
  
  const onCloseTimeChange = (event: any, selectedDate?: Date) => {
    setShowClosePicker(false);
    if (selectedDate) {
      setCloseTime(selectedDate);
    }
  };
  
  const validateContactNumber = () => {
    const valid = isValidPHPhoneNumber(cellphone);
    if (!valid) {
      Alert.alert('Invalid Contact Number', 'Please enter a valid 10-digit number after +63');
    }
    return valid;
  };

  // Handle location selection
  const handleLocationSelect = (data: LocationData) => {
    setLocationData(data);
    setLocation(data.address);
  };

  // Open location picker modal
  const openLocationPicker = () => {
    setShowLocationPicker(true);
  };

  // Close location picker modal
  const closeLocationPicker = () => {
    setShowLocationPicker(false);
  };
  
  const handleNext = async () => {
    // Validate fields
    if (!clinicName || !location || !zipCode || !cellphone || cellphone === '+63') {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }
    
    if (!validateContactNumber()) {
      return;
    }
    
    if (!businessPermit) {
      Alert.alert('Missing Document', 'Please upload your business permit');
      return;
    }
    
    if (!validID) {
      Alert.alert('Missing Document', 'Please upload a valid ID');
      return;
    }

    if (!locationData) {
      Alert.alert('Missing Location', 'Please set your clinic location');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Prepare clinic profile data
      const clinicData = {
        clinicName,
        description,
        address: location,
        zipCode,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        openingHour: formatTimeString(openTime),
        closingHour: formatTimeString(closeTime),
        landline,
        phone: cellphone,
        website,
        // Don't set needsOnboarding to false yet - we still need to go through pet-managed page
        needsOnboarding: true
      };
      
      // Save clinic profile data
      await completeOnboarding(clinicData);
      
      // Add debug logs
      console.log("Navigating to pet-managed screen");
      
      navigateToPetManaged();
      
      // Add more debug logs
      console.log("Navigation completed");
    } catch (error) {
      console.error('Failed to save clinic profile:', error);
      Alert.alert('Error', 'Failed to save clinic profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Special navigation function to handle routing to pet-managed
  const navigateToPetManaged = () => {
    try {
      console.log("Using special navigation function to pet-managed");
      
      // Try multiple approaches with delays to ensure one works
      
      // Approach 1: Simple path
      router.push('/pet-managed');
      
      // Approach 2: Full path with group
      setTimeout(() => {
        router.push('/(onboarding)/pet-managed');
      }, 100);
      
      // Approach 3: Object notation
      setTimeout(() => {
        router.push({
          pathname: '/(onboarding)/pet-managed',
        });
      }, 200);
      
      // Approach 4: Use replace instead of push
      setTimeout(() => {
        router.replace('/(onboarding)/pet-managed');
      }, 300);
    } catch (error) {
      console.error("Navigation error:", error);
      
      // Final fallback - go directly to tabs if all else fails
      setTimeout(() => {
        console.log("Fallback navigation to tabs");
        router.replace('/(tabs)');
      }, 500);
    }
  };
  
  return (
    <>
      {isLoading && <LoadingDialog visible={isLoading} message="Saving clinic profile..." />}
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
            <Text style={styles.title}>Clinic Profile</Text>
            <Text style={styles.subtitle}>Set up your clinic's profile</Text>
          </View>
          
          {/* Profile Image Section */}
          <View style={styles.profileImageContainer}>
            <TouchableOpacity style={styles.profileImageWrapper} onPress={pickImage}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <IconSymbol name="building.2.fill" size={50} color={Colors.light.icon} />
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
              Tap to upload clinic logo (JPG, JPEG, PNG)
            </Text>
          </View>
          
          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Clinic Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Clinic Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your clinic name"
                value={clinicName}
                onChangeText={setClinicName}
                onFocus={() => handleInputFocus(220)}
              />
            </View>
            
            {/* Description */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Short Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Brief description of your clinic"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                onFocus={() => handleInputFocus(290)}
              />
            </View>
            
            {/* Location */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Clinic Location</Text>
              <TouchableOpacity 
                style={styles.locationInput}
                onPress={openLocationPicker}
              >
                <View style={styles.locationTextContainer}>
                  <Text style={location ? styles.locationText : styles.locationPlaceholder}>
                    {location || 'Set clinic location on map'}
                  </Text>
                </View>
                <IconSymbol name="mappin.and.ellipse" size={24} color={Colors.light.tint} />
              </TouchableOpacity>
              {locationData && (
                <Text style={styles.locationCoordinates}>
                  Lat: {locationData.latitude.toFixed(6)}, Long: {locationData.longitude.toFixed(6)}
                </Text>
              )}
            </View>
            
            {/* Zip Code */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Zip Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter postal/zip code"
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="numeric"
                maxLength={5}
                onFocus={() => handleInputFocus(380)}
              />
            </View>
            
            {/* Operating Hours */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Operating Hours</Text>
              <View style={styles.rowContainer}>
                <TouchableOpacity 
                  style={[styles.timeInput, { marginRight: 10 }]} 
                  onPress={() => setShowOpenPicker(true)}
                >
                  <Text>{formatTimeString(openTime)}</Text>
                  <IconSymbol name="clock.fill" size={18} color={Colors.light.icon} />
                </TouchableOpacity>
                
                <Text style={styles.toText}>to</Text>
                
                <TouchableOpacity 
                  style={styles.timeInput} 
                  onPress={() => setShowClosePicker(true)}
                >
                  <Text>{formatTimeString(closeTime)}</Text>
                  <IconSymbol name="clock.fill" size={18} color={Colors.light.icon} />
                </TouchableOpacity>
              </View>
              
              {showOpenPicker && (
                <DateTimePicker
                  value={openTime}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={onOpenTimeChange}
                />
              )}
              
              {showClosePicker && (
                <DateTimePicker
                  value={closeTime}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={onCloseTimeChange}
                />
              )}
            </View>
            
            {/* Contact Numbers */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Landline Number (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter landline number"
                value={landline}
                onChangeText={setLandline}
                keyboardType="phone-pad"
                maxLength={10}
                onFocus={() => handleInputFocus(520)}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Cellphone Number</Text>
              <View style={styles.phoneInputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="+63 9XX XXX XXXX"
                  value={cellphone}
                  onChangeText={handleContactNumberChange}
                  keyboardType="phone-pad"
                  maxLength={13}
                  onFocus={() => handleInputFocus(580)}
                />
                <Text style={styles.phoneHelperText}>
                  10 digits required after +63 prefix
                </Text>
              </View>
            </View>
            
            {/* Website */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Website/Social Media (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter website or social media link"
                value={website}
                onChangeText={setWebsite}
                keyboardType="url"
                autoCapitalize="none"
                onFocus={() => handleInputFocus(650)}
              />
            </View>
            
            {/* Document Requirements */}
            <View style={styles.documentSection}>
              <Text style={styles.sectionTitle}>Document Requirements</Text>
              
              {/* Business Permit */}
              <View style={styles.documentContainer}>
                <Text style={styles.documentLabel}>Business Permit (PDF, DOCX only)*</Text>
                <TouchableOpacity 
                  style={styles.documentPickerButton} 
                  onPress={() => pickDocument('permit')}
                >
                  <IconSymbol name="doc.fill" size={24} color={Colors.light.icon} style={styles.documentIcon} />
                  <Text style={styles.documentButtonText}>
                    {businessPermit ? businessPermit.name : 'Upload Business Permit'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Valid ID */}
              <View style={styles.documentContainer}>
                <Text style={styles.documentLabel}>Valid ID (JPG, JPEG, PNG only)*</Text>
                <TouchableOpacity 
                  style={styles.documentPickerButton} 
                  onPress={() => pickDocument('id')}
                >
                  <IconSymbol name="person.fill.viewfinder" size={24} color={Colors.light.icon} style={styles.documentIcon} />
                  <Text style={styles.documentButtonText}>
                    {validID ? validID.name : 'Upload Valid ID'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {/* Next Button */}
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next</Text>
            <IconSymbol name="arrow.right" size={20} color="#fff" style={styles.nextButtonIcon} />
          </TouchableOpacity>
          
          {/* Backup Navigation Button */}
          <TouchableOpacity 
            style={[styles.nextButton, { marginTop: 10, backgroundColor: '#888' }]} 
            onPress={() => {
              console.log("Using direct navigation to pet managed");
              router.push('/(onboarding)/pet-managed');
            }}
          >
            <Text style={styles.nextButtonText}>Continue to Pet Types</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Location Picker Modal */}
        <Modal
          visible={showLocationPicker}
          animationType="slide"
          transparent={false}
          onRequestClose={closeLocationPicker}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={closeLocationPicker}
              >
                <IconSymbol name="xmark" size={24} color={Colors.light.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Set Clinic Location</Text>
              <View style={styles.placeholder} />
            </View>
            
            <View style={styles.modalContent}>
              <LocationPicker 
                onLocationSelect={handleLocationSelect}
                initialLocation={locationData ? { latitude: locationData.latitude, longitude: locationData.longitude } : undefined}
                buttonTitle="Confirm Location"
              />
            </View>
            
            <TouchableOpacity 
              style={styles.modalDoneButton}
              onPress={closeLocationPicker}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  locationPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  locationCoordinates: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.light.icon,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toText: {
    marginHorizontal: 10,
    color: Colors.light.icon,
  },
  phoneInputContainer: {
    position: 'relative',
  },
  phoneHelperText: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 4,
  },
  documentSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  documentContainer: {
    marginBottom: 16,
  },
  documentLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: Colors.light.text,
    fontWeight: '500',
  },
  documentPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
  },
  documentIcon: {
    marginRight: 12,
  },
  documentButtonText: {
    flex: 1,
    fontSize: 14,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDoneButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});