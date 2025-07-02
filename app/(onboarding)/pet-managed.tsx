import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { LoadingDialog } from '../../components/ui/LoadingDialog';

// Pet categories and subcategories (same as in add-pet.tsx)
const petCategories = [
  { id: 'mammals', label: 'Mammals' },
  { id: 'birds', label: 'Birds' },
  { id: 'fish', label: 'Fish' },
  { id: 'reptiles', label: 'Reptiles' },
  { id: 'amphibians', label: 'Amphibians' },
];

const petSubcategories: Record<string, Array<{ id: string; label: string }>> = {
  mammals: [
    { id: 'dog', label: '🐕Dogs' },
    { id: 'cat', label: '🐈Cats' },
    { id: 'rabbit', label: '🐇Rabbits' },
    { id: 'guinea_pig', label: '🐹Guinea Pigs' },
    { id: 'hamster', label: '🐹Hamsters' },
    { id: 'mouse', label: '🐁Mice' },
    { id: 'rat', label: '🐀Rats' },
    { id: 'pig', label: '🐷Pigs' },
  ],
  birds: [
    { id: 'lovebird', label: '💕Lovebirds' },
    { id: 'parakeet', label: '🦜Parakeets' },
    { id: 'maya', label: '🦜Maya' },
    { id: 'cockatiel', label: '🦜Cockatiels' },
    { id: 'dove', label: '🕊️Doves' },
    { id: 'pigeon', label: '🕊️Pigeons' },
  ],
  fish: [
    { id: 'goldfish', label: '🐟Goldfish & Koi' },
    { id: 'betta', label: '🐠Betta Fish' },
    { id: 'tilapia', label: '🐟Tilapia' },
    { id: 'tetra', label: '🐠Tetras' },
    { id: 'guppy', label: '🐠Guppies' },
    { id: 'molly', label: '🐠Mollies' },
  ],
  reptiles: [
    { id: 'turtle', label: '🐢Turtles (Pagong)' },
    { id: 'gecko', label: '🦎Geckos (Tuko / House Gecko)' },
    { id: 'snake', label: '🐍Snakes' },
    { id: 'lizard', label: '🦖Lizards' },
  ],
  amphibians: [
    { id: 'frog', label: '🐸Frogs' },
    { id: 'toad', label: '🐸Toads' },
    { id: 'newt', label: '🐸Newts' },
    { id: 'salamander', label: '🐸Salamanders' },
  ],
};

export default function PetManagedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // State to track selected categories and subcategories
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({});
  const [selectedSubcategories, setSelectedSubcategories] = useState<Record<string, boolean>>({});
  
  const toggleCategory = (categoryId: string) => {
    const newSelectedCategories = {
      ...selectedCategories,
      [categoryId]: !selectedCategories[categoryId],
    };
    
    // If unchecking a category, uncheck all its subcategories too
    if (!newSelectedCategories[categoryId]) {
      const newSelectedSubcategories = { ...selectedSubcategories };
      petSubcategories[categoryId].forEach((subcat) => {
        newSelectedSubcategories[subcat.id] = false;
      });
      setSelectedSubcategories(newSelectedSubcategories);
    }
    
    setSelectedCategories(newSelectedCategories);
  };
  
  const toggleSubcategory = (subcategoryId: string, categoryId: string) => {
    const newSelectedSubcategories = {
      ...selectedSubcategories,
      [subcategoryId]: !selectedSubcategories[subcategoryId],
    };
    
    // Make sure parent category is checked if any subcategory is checked
    let anySubcategorySelected = false;
    petSubcategories[categoryId].forEach((subcat) => {
      if (subcat.id === subcategoryId ? newSelectedSubcategories[subcategoryId] : selectedSubcategories[subcat.id]) {
        anySubcategorySelected = true;
      }
    });
    
    const newSelectedCategories = {
      ...selectedCategories,
      [categoryId]: anySubcategorySelected,
    };
    
    setSelectedSubcategories(newSelectedSubcategories);
    setSelectedCategories(newSelectedCategories);
  };
  
  const handleRegister = async () => {
    // Check if at least one subcategory is selected
    const hasSelection = Object.values(selectedSubcategories).some((selected) => selected);
    
    if (!hasSelection) {
      Alert.alert('Selection Required', 'Please select at least one pet type');
      return;
    }
    
    // Get all selected subcategories
    const managedPets = Object.entries(selectedSubcategories)
      .filter(([id, selected]) => selected)
      .map(([id]) => id);
    
    console.log('Clinic registered with managed pets:', managedPets);
    
    try {
      setIsLoading(true);
      
      // Now finally complete the onboarding process by setting needsOnboarding to false
      await completeOnboarding({
        managedPets,
        needsOnboarding: false, // This is the key part - mark onboarding as complete
        completedOnboarding: true
      });
      
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to save managed pets:', error);
      Alert.alert('Error', 'Failed to complete registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      {isLoading && <LoadingDialog visible={isLoading} message="Completing registration..." />}
      <ScrollView 
        contentContainerStyle={[
          styles.container, 
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Pet Types Managed</Text>
          <Text style={styles.subtitle}>Select the types of pets your clinic caters to</Text>
        </View>
        
        <View style={styles.formContainer}>
          {/* Category Selection */}
          {petCategories.map((category) => (
            <View key={category.id} style={styles.categoryContainer}>
              <TouchableOpacity 
                style={styles.categoryHeader} 
                onPress={() => toggleCategory(category.id)}
              >
                <View style={styles.checkboxRow}>
                  <View style={[styles.checkbox, selectedCategories[category.id] && styles.checkboxChecked]}>
                    {selectedCategories[category.id] && <IconSymbol name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={styles.categoryTitle}>{category.label}</Text>
                </View>
                <IconSymbol 
                  name={selectedCategories[category.id] ? "chevron.down" : "chevron.right"} 
                  size={16} 
                  color={Colors.light.icon} 
                />
              </TouchableOpacity>
              
              {/* Subcategory Selection - only show if category is selected */}
              {selectedCategories[category.id] && (
                <View style={styles.subcategoriesContainer}>
                  {petSubcategories[category.id].map((subcategory) => (
                    <TouchableOpacity 
                      key={subcategory.id}
                      style={styles.subcategoryRow}
                      onPress={() => toggleSubcategory(subcategory.id, category.id)}
                    >
                      <View style={[styles.checkbox, selectedSubcategories[subcategory.id] && styles.checkboxChecked]}>
                        {selectedSubcategories[subcategory.id] && <IconSymbol name="checkmark" size={12} color="#fff" />}
                      </View>
                      <Text style={styles.subcategoryText}>{subcategory.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
        
        {/* Register Button */}
        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>Complete Registration</Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: 8,
  },
  formContainer: {
    width: '100%',
    marginBottom: 30,
  },
  categoryContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.light.icon,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  subcategoriesContainer: {
    padding: 16,
    paddingTop: 0,
  },
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  subcategoryText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  registerButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 