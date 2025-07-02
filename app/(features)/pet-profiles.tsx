import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { petAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

// Mock pet data type
type Pet = {
  id: string;
  name: string;
  type: string;
  age: number;
  breed: string;
  sex: string;
  imageUri: any;
  treatmentHistory?: {
    date: string;
    treatment: string;
    clinic: string;
    notes?: string;
  }[]
};

export default function PetProfilesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [viewingHistory, setViewingHistory] = useState(false);
  
  const goBack = () => {
    router.back();
  };
  
  const navigateToAddPet = () => {
    router.push('/(features)/add-pet');
  };
  
  // Function to fetch pets from API
  const fetchPets = async () => {
    if (!user?.id) return;
    try {
      const fetchedPets = await petAPI.getPetsByOwner(user.id);
      console.log('RAW pets from API ►', fetchedPets);    
      
      // Map to frontend-friendly structure (ensure id field & image)
      const processed = fetchedPets.map((p: any) => {
        // Debug - examine profile image data
        console.log(`Pet ${p.name} image:`, p.profileImage);
        
        let imageUri;
        try {
          // If there's a valid profile image URL, use it
          if (p.profileImage && typeof p.profileImage === 'string') {
            imageUri = { uri: p.profileImage };
          } else {
            // Fallback to default image
            imageUri = require('../../assets/images/peteat-logo.png');
          }
        } catch (error) {
          console.error(`Error handling image for pet ${p.name}:`, error);
          // Fallback to default if there's any error
          imageUri = require('../../assets/images/peteat-logo.png');
        }
        
        return {
          id: p._id || p.id,
          name: p.name,
          type: p.species,
          age: p.age,
          breed: p.breed,
          sex: p.gender,
          imageUri: imageUri,
          treatmentHistory: p.medicalHistory || []
        };
      });
      console.log('Processed pets ►', processed); 
      setPets(processed);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch pets. Please try again.');
      console.error('Error fetching pets:', error);
    }
  };
  
  // Fetch pets when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchPets();
    }, [])
  );
  
  const handleEditPet = (pet: Pet) => {
    router.push({ pathname: '/(features)/edit-pet/[id]' as any, params: { id: pet.id } });
  };
  
  const handleDeletePet = (id: string) => {
    Alert.alert(
      "Delete Pet",
      "Are you sure you want to delete this pet profile? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await petAPI.deletePet(id);
              setPets(prev => prev.filter(p => p.id !== id));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete pet. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  const handleViewHistory = (pet: Pet) => {
    setSelectedPet(pet);
    setViewingHistory(true);
  };
  
  const renderPetItem = ({ item }: { item: Pet }) => (
    <View style={styles.petCard}>
      <View style={styles.petHeader}>
        <Image 
          source={item.imageUri} 
          style={styles.petImage} 
          resizeMode="cover"
        />
        <View style={styles.petInfo}>
          <Text style={styles.petName}>{item.name}</Text>
          <Text style={styles.petDetails}>{item.breed} {item.type}</Text>
          <Text style={styles.petDetails}>{item.age} years • {item.sex}</Text>
        </View>
      </View>
      
      <View style={styles.petActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.historyButton]} 
          onPress={() => handleViewHistory(item)}
        >
          <IconSymbol name="list.clipboard" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>History</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]} 
          onPress={() => handleEditPet(item)}
        >
          <IconSymbol name="pencil" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]} 
          onPress={() => handleDeletePet(item.id)}
        >
          <IconSymbol name="trash" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderHistoryItem = ({ item }: { item: { date: string, treatment: string, clinic: string, notes?: string } }) => (
    <View style={styles.historyItem}>
      <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
      <Text style={styles.historyTreatment}>{item.treatment}</Text>
      <Text style={styles.historyClinic}>{item.clinic}</Text>
      {item.notes && <Text style={styles.historyNotes}>{item.notes}</Text>}
    </View>
  );
  
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
          
          <Text style={styles.screenTitle}>
            {viewingHistory ? `${selectedPet?.name}'s History` : 'Pet Profiles'}
          </Text>
          
          <View style={styles.iconButton} />
        </View>
        
        {/* Main Content */}
        {!viewingHistory ? (
          <>
            <FlatList
              data={pets}
              renderItem={renderPetItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <IconSymbol name="pawprint.fill" size={48} color={Colors.light.icon} />
                  <Text style={styles.emptyText}>No pets added yet</Text>
                </View>
              }
            />
            
            <TouchableOpacity style={styles.addPetButton} onPress={navigateToAddPet}>
              <IconSymbol name="plus" size={20} color="#FFF" />
              <Text style={styles.addPetButtonText}>Add New Pet</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {selectedPet?.treatmentHistory && selectedPet.treatmentHistory.length > 0 ? (
              <FlatList
                data={selectedPet.treatmentHistory}
                renderItem={renderHistoryItem}
                keyExtractor={(item, index) => `${item.date}-${index}`}
                contentContainerStyle={styles.listContainer}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <IconSymbol name="clipboard" size={48} color={Colors.light.icon} />
                <Text style={styles.emptyText}>No treatment history yet</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.backToProfileButton} 
              onPress={() => setViewingHistory(false)}
            >
              <Text style={styles.backToProfileText}>Back to Pet Profiles</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Extra padding at the bottom
  },
  petCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  petHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  petImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 12,
  },
  petInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  petName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 14,
    color: Colors.light.icon,
    marginBottom: 2,
  },
  petActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
  },
  historyButton: {
    backgroundColor: Colors.light.tint,
  },
  editButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  addPetButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addPetButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.icon,
  },
  historyItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 14,
    color: Colors.light.icon,
    marginBottom: 4,
  },
  historyTreatment: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  historyClinic: {
    fontSize: 14,
    color: Colors.light.tint,
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 14,
    color: Colors.light.text,
    marginTop: 4,
  },
  backToProfileButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backToProfileText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 