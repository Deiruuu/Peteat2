import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { petAPI } from '../api/api';
import { LoadingDialog } from '@/components/ui/LoadingDialog';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '@/components/ui/Input';
import { useErrorPrompt } from '@/components/ui/ErrorPrompt';
import { Picker } from '@react-native-picker/picker';
import { breedData } from '../../constants/BreedOptions';

// Define pet data interface
interface PetData {
  name: string;
  category: string;
  species: string;
  breed?: string;
  age?: number;
  gender?: string;
  weight?: number;
  profileImage?: string;
}

export default function AddPetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [species, setSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customBreed, setCustomBreed] = useState('');
  
  const { show: showError } = useErrorPrompt();
  
  const goBack = () => {
    router.back();
  };
  
  const selectImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to upload a pet photo.');
        return;
      }
      
      console.log('Opening image picker for pet photo...');
      // Launch the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1.0, // Use maximum quality
      });
      
      if (!result.canceled) {
        const selectedUri = result.assets[0].uri;
        console.log('Selected pet photo URI:', selectedUri);
        setPhoto(selectedUri);
      } else {
        console.log('Pet image selection canceled');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'There was a problem selecting the image.');
    }
  };
  
  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter your pet\'s name.');
      return false;
    }
    
    if (!category) {
      Alert.alert('Missing Information', 'Please select a category.');
      return false;
    }
    
    if (!species) {
      Alert.alert('Missing Information', 'Please select a pet type.');
      return false;
    }
    
    // Validate custom breed if "other" is selected
    if (breed === 'other' && !customBreed.trim()) {
      Alert.alert('Missing Information', 'Please specify the breed.');
      return false;
    }
    
    return true;
  };
  
  const handleAddPet = async () => {
    if (!validateForm()) return;
    
    try {
      setIsLoading(true);
      
      // Determine final breed value
      const finalBreed = breed === 'other' ? customBreed.trim() : breed;
      
      let petData: PetData = {
        name: name.trim(),
        category,
        species,
        breed: finalBreed || undefined,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender.trim() || undefined,
        weight: weight ? parseFloat(weight) : undefined,
      };
      
      // If a photo was selected, upload it first
      if (photo) {
        try {
          console.log('Uploading pet photo...');
          const imageUrl = await petAPI.uploadImage(photo);
          console.log('Pet photo uploaded successfully:', imageUrl);
          
          // Add the image URL to the pet data
          petData.profileImage = imageUrl;
        } catch (uploadErr) {
          console.error('Pet photo upload error:', uploadErr);
          Alert.alert(
            'Photo Upload Warning',
            'We had trouble uploading the photo, but can still add your pet. Continue without the photo?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setIsLoading(false);
                }
              },
              {
                text: 'Continue',
                onPress: async () => {
                  // Continue adding the pet without the photo
                  try {
                    await addPetWithData(petData);
                  } catch (err) {
                    handleAddPetError(err);
                  } finally {
                    setIsLoading(false);
                  }
                }
              }
            ]
          );
          return; // Exit early to wait for user input
        }
      }
      
      await addPetWithData(petData);
    } catch (err) {
      handleAddPetError(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to add pet with data
  const addPetWithData = async (petData: PetData) => {
    const result = await petAPI.createPet(petData);
    console.log('Pet added successfully:', result);
    
    // Success message
    Alert.alert(
      'Success',
      'Your pet has been added successfully!',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to Pet Profiles page
            router.push('/(features)/pet-profiles');
          }
        }
      ]
    );
  };
  
  // Helper function to handle errors
  const handleAddPetError = (err: unknown) => {
    console.error('Error adding pet:', err);
    // Type-safe error handling
    const errorMessage = err instanceof Error ? err.message : 
                        typeof err === 'object' && err !== null && 'message' in err ? 
                        String(err.message) : 'Failed to add pet. Please try again.';
    Alert.alert('Error', errorMessage);
  };
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Image 
              source={require('../../assets/images/left-arrow.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Add Pet</Text>
          
          <View style={{ width: 40 }} />
        </View>
        
        {/* Content */}
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Pet Photo */}
          <TouchableOpacity style={styles.photoContainer} onPress={selectImage}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.petPhoto} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <IconSymbol name="camera.fill" size={40} color={Colors.light.icon} />
                <Text style={styles.photoText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Pet Details Form */}
          <View style={styles.form}>
            {/* Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Pet Name*</Text>
              <Input
                placeholder="Enter your pet's name"
                value={name}
                onChangeText={setName}
              />
            </View>
            
            {/* Category Picker */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Category*</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={category}
                  onValueChange={(val)=>{setCategory(val); setSpecies(''); setBreed('');}}
                  style={styles.picker}
                >
                  <Picker.Item label="Select category" value="" />
                  {Object.entries(breedData).map(([key, cat])=> (
                    <Picker.Item key={key} label={cat.label} value={key} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Type Picker */}
            {category ? (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Type*</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={species}
                    onValueChange={(val)=>{setSpecies(val); setBreed('');}}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select type" value="" />
                    {breedData[category].types.map(t=>(
                      <Picker.Item key={t.value} label={t.label} value={t.value} />
                    ))}
                  </Picker>
                </View>
              </View>
            ):null}

            {/* Breed Picker */}
            {species ? (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Breed</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={breed}
                    onValueChange={setBreed}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select breed" value="" />
                    {breedData[category]?.types.find(t=>t.value===species)?.breeds.map(b=>(
                      <Picker.Item key={b.value} label={b.label} value={b.value} />
                    ))}
                    <Picker.Item label="Other" value="other" />
                  </Picker>
                </View>
              </View>
            ):null}
            
            {/* Custom breed input when "Other" is selected */}
            {breed === 'other' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Specify Breed*</Text>
                <Input
                  placeholder="Enter breed"
                  value={customBreed}
                  onChangeText={setCustomBreed}
                />
              </View>
            )}
            
            {/* Age and Gender in same row */}
            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Age</Text>
                <Input
                  placeholder="Years"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Gender</Text>
                <Input
                  placeholder="male/female"
                  value={gender}
                  onChangeText={setGender}
                />
              </View>
            </View>
            
            {/* Weight */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Weight (kg)</Text>
              <Input
                placeholder="Enter weight in kg"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
              />
            </View>
            
            {/* Additional info field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Additional Information</Text>
              <Input
                placeholder="Any additional details about your pet"
                value={''}
                onChangeText={() => {}}
                multiline
              />
            </View>
            
            {/* Add Pet Button */}
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={handleAddPet}
            >
              <Text style={styles.addButtonText}>Add Pet</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Loading Overlay */}
        {isLoading && <LoadingDialog visible={true} message="Adding your pet..." />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginRight: 48, // space for back button
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  photoContainer: {
    alignSelf: 'center',
    marginVertical: 16,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  petPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoText: {
    marginTop: 8,
    color: Colors.light.icon,
    fontSize: 14,
  },
  form: {
    marginTop: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  picker: {
    width: '100%',
    height: 50,
  },
}); 