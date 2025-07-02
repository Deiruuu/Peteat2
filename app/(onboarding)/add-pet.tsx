import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import {
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
import { IconSymbol } from '../../components/ui/IconSymbol';
import { BackButton } from '../../components/ui/BackButton';
import { Colors } from '../../constants/Colors';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { LoadingDialog } from '../../components/ui/LoadingDialog';
import { petAPI } from '../api/api';
import { breedData } from '../../constants/BreedOptions';

// Pet type categories and subcategories
const petCategories = [
  { label: 'Select a category', value: '' },
  { label: 'Mammals', value: 'mammals' },
  { label: 'Birds', value: 'birds' },
  { label: 'Fish', value: 'fish' },
  { label: 'Reptiles', value: 'reptiles' },
  { label: 'Amphibians', value: 'amphibians' },
];

const petSubcategories: Record<string, Array<{ label: string; value: string }>> = {
  mammals: [
    { label: 'Select type', value: '' },
    { label: 'Dog', value: 'dog' },
    { label: 'Cat', value: 'cat' },
    { label: 'Rabbit', value: 'rabbit' },
    { label: 'Guinea Pig', value: 'guinea_pig' },
    { label: 'Hamster', value: 'hamster' },
    { label: 'Mouse', value: 'mouse' },
    { label: 'Rat', value: 'rat' },
    { label: 'Pig', value: 'pig' },
  ],
  birds: [
    { label: 'Select type', value: '' },
    { label: 'Lovebird', value: 'lovebird' },
    { label: 'Parakeet', value: 'parakeet' },
    { label: 'Maya', value: 'maya' },
    { label: 'Cockatiel', value: 'cockatiel' },
    { label: 'Dove', value: 'dove' },
    { label: 'Pigeon', value: 'pigeon' },
  ],
  fish: [
    { label: 'Select type', value: '' },
    { label: 'Goldfish', value: 'goldfish' },
    { label: 'Koi', value: 'koi' },
    { label: 'Betta Fish', value: 'betta' },
    { label: 'Tilapia', value: 'tilapia' },
    { label: 'Tetra', value: 'tetra' },
    { label: 'Guppy', value: 'guppy' },
    { label: 'Molly', value: 'molly' },
  ],
  reptiles: [
    { label: 'Select type', value: '' },
    { label: 'Turtle (Pagong)', value: 'turtle' },
    { label: 'Gecko (Tuko)', value: 'gecko' },
    { label: 'Snake', value: 'snake' },
    { label: 'Lizard', value: 'lizard' },
  ],
  amphibians: [
    { label: 'Select type', value: '' },
    { label: 'Frog', value: 'frog' },
    { label: 'Toad', value: 'toad' },
    { label: 'Newt', value: 'newt' },
    { label: 'Salamander', value: 'salamander' },
  ],
};

// Pet genders
const petGenders = [
  { label: 'Select gender', value: '' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Unknown', value: 'unknown' },
];

// Pet interface
interface Pet {
  id: string;
  name: string;
  category: string;
  type: string;
  gender: string;
  age: string;
  breed: string;
  color: string;
  weight: string;
  allergies: string;
  medications: string;
  notes: string;
  vaccinations: string[];
  profileImage: ImagePicker.ImagePickerResult | null;
  customBreed?: string;
}

// Helper to get breed list for a given category/type
const getBreeds = (category: string, type: string) => {
  const cat = breedData[category as keyof typeof breedData];
  if (!cat) return [];
  const typeObj = cat.types.find(t => t.value === type);
  return typeObj ? typeObj.breeds : [];
};

export default function AddPetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { completeOnboarding } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Debug: log when add-pet component mounts
  useEffect(() => {
    console.log("Add Pet screen mounted");
    return () => console.log("Add Pet screen unmounted");
  }, []);
  
  // Initial pet state
  const [pets, setPets] = useState<Pet[]>([
    {
      id: '1',
      name: '',
      category: '',
      type: '',
      gender: '',
      age: '',
      breed: '',
      color: '',
      weight: '',
      allergies: '',
      medications: '',
      notes: '',
      vaccinations: [],
      profileImage: null,
      customBreed: ''
    }
  ]);
  
  // Current pet being edited
  const [currentPetIndex, setCurrentPetIndex] = useState(0);
  
  // Handle input focus to scroll the view
  const handleInputFocus = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };
  
  // Update current pet's field
  const updatePetField = (field: keyof Pet, value: string) => {
    const updatedPets = [...pets];
    updatedPets[currentPetIndex] = {
      ...updatedPets[currentPetIndex],
      [field]: value,
    };
    
    // If updating category, reset type and breed
    if (field === 'category') {
      updatedPets[currentPetIndex].type = '';
      updatedPets[currentPetIndex].breed = '';
    }
    
    if (field === 'type') {
      updatedPets[currentPetIndex].breed = '';
    }
    
    // Reset customBreed when breed changes
    if (field === 'breed') {
      updatedPets[currentPetIndex].customBreed = '';
    }
    
    setPets(updatedPets);
  };
  
  // Add another pet
  const addAnotherPet = () => {
    // Validate current pet first
    if (!validateCurrentPet()) {
      return;
    }
    
    const newPet: Pet = {
      id: Date.now().toString(),
      name: '',
      category: '',
      type: '',
      gender: '',
      age: '',
      breed: '',
      color: '',
      weight: '',
      allergies: '',
      medications: '',
      notes: '',
      vaccinations: [],
      profileImage: null,
      customBreed: ''
    };
    
    setPets([...pets, newPet]);
    setCurrentPetIndex(pets.length);
    
    // Scroll to top of form
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 200, animated: true });
    }, 100);
  };
  
  // Validate current pet
  const validateCurrentPet = () => {
    const currentPet = pets[currentPetIndex];
    
    if (!currentPet.name || !currentPet.category || !currentPet.type || !currentPet.gender || !currentPet.age) {
      Alert.alert('Missing Information', 'Please fill in all required fields for the current pet');
      return false;
    }
    
    // If breed is other, ensure customBreed entered
    if (currentPet.breed === 'other' && !currentPet.customBreed?.trim()) {
      Alert.alert('Missing Information', 'Please specify the breed');
      return false;
    }
    
    return true;
  };
  
  // Switch to a specific pet
  const switchToPet = (index: number) => {
    if (!validateCurrentPet()) {
      return;
    }
    
    setCurrentPetIndex(index);
  };
  
  // Register all pets
  const handleRegister = async () => {
    // Validate current pet
    if (!validateCurrentPet()) {
      return;
    }
    
    // Check if all pets are valid
    for (const pet of pets) {
      if (!pet.name || !pet.category || !pet.type || !pet.gender || !pet.age) {
        Alert.alert('Missing Information', 'Please fill in all required fields for all pets');
        return;
      }
      
      if (pet.breed === 'other' && !pet.customBreed?.trim()) {
        Alert.alert('Missing Information', 'Please specify the breed for pets with Other breed');
        return;
      }
    }
    
    try {
      setIsLoading(true);
      
      // Ensure onboarding is marked as complete first (so user has full access)
      await completeOnboarding({
        needsOnboarding: false,
        completedOnboarding: true,
        // Include pet data if needed by your backend
        pets: pets.map(pet => ({
          name: pet.name,
          category: pet.category,
          type: pet.type,
          gender: pet.gender,
          age: pet.age,
          breed: pet.breed === 'other' ? (pet.customBreed || '') : pet.breed || ''
        }))
      });
      
      // Now create each pet record in the dedicated Pet collection
      await Promise.all(
        pets.map(async (pet) => {
          try {
            const petData = {
              name: pet.name,
              category: pet.category,
              species: pet.type,
              breed: pet.breed === 'other' ? pet.customBreed : pet.breed,
              age: pet.age ? parseInt(pet.age, 10) : undefined,
              gender: pet.gender,
              // No weight, profileImage yet – extend later if needed
            };
            console.log('Creating pet with data:', JSON.stringify(petData));
            await petAPI.createPet(petData);
          } catch (err) {
            console.error('Error creating pet during onboarding:', err);
            throw err; // Re-throw to catch in the outer try/catch
          }
        })
      );
      
      // If only one pet, go to home
      if (pets.length === 1) {
        console.log('Pet registered:', pets[0]);
        router.replace('/(tabs)');
      } else {
        // If multiple pets, go to confirmation page (for now, just show alert and go home)
        console.log('Multiple pets registered:', pets);
        Alert.alert(
          'Pets Added Successfully',
          `You've added ${pets.length} pets to your profile!`,
          [
            {
              text: 'View Summary',
              onPress: () => {
                // In a real app, navigate to a confirmation page
                // For now, we'll just show another alert with pet names
                const petNames = pets.map(pet => pet.name).join(', ');
                Alert.alert(
                  'Your Pets',
                  `You've registered: ${petNames}`,
                  [
                    {
                      text: 'Continue to Home',
                      onPress: () => router.replace('/(tabs)')
                    }
                  ]
                );
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Even if there's an error, allow the user to continue
      router.replace('/(tabs)');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get current pet
  const currentPet = pets[currentPetIndex];
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {isLoading && <LoadingDialog visible={isLoading} message="Saving pet information..." />}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.container, 
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button for easier navigation */}
        <View style={styles.backButtonContainer}>
          <BackButton />
        </View>
        
        <View style={styles.header}>
          <Text style={styles.title}>Add Your Pet</Text>
          <Text style={styles.subtitle}>Tell us about your furry friend</Text>
        </View>
        
        {/* Pet Selection Tabs (if multiple pets) */}
        {pets.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.petsTabsContainer}
          >
            {pets.map((pet, index) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petTab,
                  currentPetIndex === index && styles.activePetTab
                ]}
                onPress={() => switchToPet(index)}
              >
                <Text 
                  style={[
                    styles.petTabText,
                    currentPetIndex === index && styles.activePetTabText
                  ]}
                >
                  {pet.name || `Pet ${index + 1}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        
        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* Pet Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Pet Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your pet's name"
              value={currentPet.name}
              onChangeText={(value) => updatePetField('name', value)}
              onFocus={() => handleInputFocus(200)}
            />
          </View>
          
          {/* Pet Category Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Pet Category</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={currentPet.category}
                onValueChange={(value: string) => updatePetField('category', value)}
                style={styles.picker}
              >
                {petCategories.map((category) => (
                  <Picker.Item 
                    key={category.value} 
                    label={category.label} 
                    value={category.value} 
                  />
                ))}
              </Picker>
            </View>
          </View>
          
          {/* Pet Type Selection (based on category) */}
          {currentPet.category ? (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Pet Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={currentPet.type}
                  onValueChange={(value: string) => updatePetField('type', value)}
                  style={styles.picker}
                >
                  {petSubcategories[currentPet.category]?.map((type) => (
                    <Picker.Item 
                      key={type.value} 
                      label={type.label} 
                      value={type.value} 
                    />
                  ))}
                </Picker>
              </View>
            </View>
          ) : null}
          
          {/* Pet Breed */}
          {currentPet.type ? (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Breed</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={currentPet.breed}
                  onValueChange={(value: string) => updatePetField('breed', value)}
                  style={styles.picker}
                >
                  {getBreeds(currentPet.category, currentPet.type).map((breed) => (
                    <Picker.Item 
                      key={breed.value} 
                      label={breed.label} 
                      value={breed.value} 
                    />
                  ))}
                  <Picker.Item label="Other" value="other" />
                </Picker>
              </View>
            </View>
          ) : null}
          
          {/* Custom breed input */}
          {currentPet.breed === 'other' ? (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Specify Breed*</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter breed"
                value={currentPet.customBreed}
                onChangeText={(val)=>updatePetField('customBreed', val)}
              />
            </View>
          ) : null}
          
          {/* Pet Gender */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Sex</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={currentPet.gender}
                onValueChange={(value: string) => updatePetField('gender', value)}
                style={styles.picker}
              >
                {petGenders.map((gender) => (
                  <Picker.Item 
                    key={gender.value} 
                    label={gender.label} 
                    value={gender.value} 
                  />
                ))}
              </Picker>
            </View>
          </View>
          
          {/* Pet Age */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your pet's age (e.g., 2 years)"
              value={currentPet.age}
              onChangeText={(value) => updatePetField('age', value)}
              onFocus={() => handleInputFocus(500)}
            />
          </View>
        </View>
        
        {/* Register Button */}
        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>
            {pets.length > 1 ? 'Register All Pets' : 'Register Pet'}
          </Text>
        </TouchableOpacity>
        
        {/* Add another pet option */}
        <TouchableOpacity style={styles.addAnotherButton} onPress={addAnotherPet}>
          <IconSymbol name="plus.circle.fill" size={20} color={Colors.light.tint} style={styles.addIcon} />
          <Text style={styles.addAnotherText}>Add another pet</Text>
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
  petsTabsContainer: {
    paddingBottom: 16,
    marginBottom: 16,
  },
  petTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activePetTab: {
    backgroundColor: Colors.light.tint,
  },
  petTabText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  activePetTabText: {
    color: '#fff',
    fontWeight: '500',
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  registerButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  addIcon: {
    marginRight: 8,
  },
  addAnotherText: {
    color: Colors.light.tint,
    fontSize: 16,
    marginLeft: 8,
  },
  backButtonContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
  },
}); 