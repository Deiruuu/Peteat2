import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { treatmentAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

// Mock pet data type
type Pet = {
  id: string;
  name: string;
  type: string;
  age: number;
  breed: string;
  sex: string;
  ownerName: string;
  ownerContact: string;
  imageUri: any;
  condition: string;
  status: 'Critical' | 'Stable' | 'Improving' | 'Recovered';
  admissionDate: string;
  lastUpdate: string;
  room?: string;
  assignedTo?: string;
};

export default function ManageCuringPetsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  
  const [pets, setPets] = useState<Pet[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'record' | 'update' | 'prescribe' | 'followUp'>('record');
  
  const goBack = () => {
    router.back();
  };
  
  // Function to fetch pets from API
  const fetchPets = async () => {
    if (!user?.id) return;
    try {
      const data = await treatmentAPI.getClinicTreatments(user.id);
      // Map API data to Pet type structure expected by UI
      const formatted = data.map((t: any) => ({
        id: t._id,
        name: t.pet?.name || 'Unknown',
        type: t.pet?.species || 'Unknown',
        age: t.pet?.age || 0,
        breed: t.pet?.breed || 'Unknown',
        sex: t.pet?.gender || 'Unknown',
        ownerName: t.petOwner?.fullName || 'Unknown',
        ownerContact: t.petOwner?.contactNumber || t.petOwner?.email || 'Unknown',
        imageUri: t.pet?.profileImage ? { uri: t.pet.profileImage } : require('../../assets/images/peteat-logo.png'),
        condition: t.diagnosis || 'Not specified',
        status: t.status || 'Stable',
        admissionDate: new Date(t.admissionDate).toLocaleDateString(),
        lastUpdate: new Date(t.lastUpdate).toLocaleDateString(),
        room: t.room || 'Not assigned',
        assignedTo: t.assignedTo || 'Not assigned'
      }));
      setPets(formatted);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch pets under treatment. Please try again.');
      console.error('Error fetching pets:', error);
    }
  };
  
  // Fetch pets when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchPets();
    }, [])
  );
  
  // Filter pets based on search query and status filter
  const filteredPets = pets.filter(pet => {
    // Filter by search query (name, owner, or condition)
    const matchesSearch = 
      searchQuery === '' || 
      pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pet.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pet.condition.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by status
    const matchesStatus = filterStatus === null || pet.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });
  
  // Handle pet status update
  const handleUpdateStatus = async (petId: string, newStatus: Pet['status']) => {
    try {
      await treatmentAPI.updateStatus(petId, newStatus);
      
      setPets(pets.map(pet => 
        pet.id === petId 
          ? { ...pet, status: newStatus, lastUpdate: new Date().toLocaleDateString() }
          : pet
      ));
      
      Alert.alert('Status Updated', `Pet status has been updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update pet status. Please try again.');
    }
  };
  
  // Handle pet discharge
  const handleDischarge = async (petId: string) => {
    Alert.alert(
      "Discharge Pet",
      "Are you sure you want to discharge this pet? This will mark them as recovered and remove them from active treatment.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Discharge", 
          onPress: async () => {
            try {
              // Update status to Recovered first
              await treatmentAPI.updateStatus(petId, 'Recovered');
              
              // Then discharge the pet
              await treatmentAPI.dischargePet(petId);
              
              // Update local state
              setPets(pets.filter(pet => pet.id !== petId));
              
              Alert.alert('Pet Discharged', 'Pet has been discharged successfully');
            } catch (error) {
              console.error('Error discharging pet:', error);
              Alert.alert('Error', 'Failed to discharge pet. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  // Handle view pet details
  const handleViewDetails = (pet: Pet) => {
    setSelectedPet(pet);
    // In a real app, you might navigate to a detailed view
    Alert.alert(
      `${pet.name}'s Details`,
      `Owner: ${pet.ownerName}\nContact: ${pet.ownerContact}\nCondition: ${pet.condition}\nRoom: ${pet.room}\nAssigned To: ${pet.assignedTo}\nAdmitted: ${pet.admissionDate}`,
      [{ text: "OK" }]
    );
  };
  
  // Handle contact owner
  const handleContactOwner = (pet: Pet) => {
    Alert.alert(
      `Contact ${pet.ownerName}`,
      `Call ${pet.ownerContact} or send a message?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Call", 
          onPress: () => console.log(`Calling ${pet.ownerContact}`)
        },
        { 
          text: "Message", 
          onPress: () => console.log(`Messaging ${pet.ownerContact}`)
        }
      ]
    );
  };
  
  // Render individual pet item
  const renderPetItem = ({ item }: { item: Pet }) => {
    // Function to get status color
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'Stable': return '#FFC107';
        case 'Improving': return '#4CAF50';
        case 'Critical': return '#F44336';
        case 'Recovered': return '#2196F3';
        default: return Colors.light.icon;
      }
    };
    
    return (
      <View style={[
        styles.petCard,
        item.status === 'Critical' && styles.criticalCard
      ]}>
        <View style={styles.petHeader}>
          <Image 
            source={item.imageUri} 
            style={styles.petImage} 
            resizeMode="cover"
          />
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{item.name}</Text>
            <Text style={styles.petDetails}>{item.breed} {item.type} • {item.age} years</Text>
            <Text style={styles.petOwner}>Owner: {item.ownerName}</Text>
            
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(item.status) }
              ]} />
              <Text style={[
                styles.statusText,
                { color: getStatusColor(item.status) }
              ]}>
                {item.status}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.conditionContainer}>
          <Text style={styles.conditionLabel}>Condition:</Text>
          <Text style={styles.conditionText}>{item.condition}</Text>
        </View>
        
        <View style={styles.metaInfo}>
          <Text style={styles.metaText}>Room: {item.room}</Text>
          <Text style={styles.metaText}>Admitted: {item.admissionDate}</Text>
          <Text style={styles.metaText}>Last Update: {item.lastUpdate}</Text>
        </View>
        
        <View style={styles.petActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.detailsButton]} 
            onPress={() => handleViewDetails(item)}
          >
            <IconSymbol name="doc.text.fill" size={16} color="#FFF" />
            <Text style={styles.actionButtonText}>Details</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.contactButton]} 
            onPress={() => handleContactOwner(item)}
          >
            <IconSymbol name="phone.fill" size={16} color="#FFF" />
            <Text style={styles.actionButtonText}>Contact</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.updateButton]} 
            onPress={() => {
              Alert.alert(
                "Update Status",
                "Select new status:",
                [
                  { text: "Critical", onPress: () => handleUpdateStatus(item.id, 'Critical') },
                  { text: "Stable", onPress: () => handleUpdateStatus(item.id, 'Stable') },
                  { text: "Improving", onPress: () => handleUpdateStatus(item.id, 'Improving') },
                  { text: "Recovered", onPress: () => handleUpdateStatus(item.id, 'Recovered') },
                  { text: "Cancel", style: "cancel" }
                ]
              );
            }}
          >
            <IconSymbol name="arrow.triangle.2.circlepath" size={16} color="#FFF" />
            <Text style={styles.actionButtonText}>Update</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.dischargeButton]} 
            onPress={() => handleDischarge(item.id)}
          >
            <IconSymbol name="square.and.arrow.up" size={16} color="#FFF" />
            <Text style={styles.actionButtonText}>Discharge</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Section */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={goBack}>
            <Image 
              source={require('../../assets/images/left-arrow.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <Text style={styles.screenTitle}>Pets Under Treatment</Text>
          
          <View style={styles.iconButton} />
        </View>
        
        {/* Search and Filter Section */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <IconSymbol name="magnifyingglass" size={20} color={Colors.light.icon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search pets, owners, or conditions"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity 
              style={[
                styles.filterButton,
                filterStatus === null && styles.activeFilter
              ]}
              onPress={() => setFilterStatus(null)}
            >
              <Text style={[
                styles.filterButtonText,
                filterStatus === null && styles.activeFilterText
              ]}>All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                filterStatus === 'Critical' && styles.activeFilter
              ]}
              onPress={() => setFilterStatus('Critical')}
            >
              <View style={[styles.statusDot, { backgroundColor: '#F44336' }]} />
              <Text style={[
                styles.filterButtonText,
                filterStatus === 'Critical' && styles.activeFilterText
              ]}>Critical</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                filterStatus === 'Stable' && styles.activeFilter
              ]}
              onPress={() => setFilterStatus('Stable')}
            >
              <View style={[styles.statusDot, { backgroundColor: '#FFC107' }]} />
              <Text style={[
                styles.filterButtonText,
                filterStatus === 'Stable' && styles.activeFilterText
              ]}>Stable</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                filterStatus === 'Improving' && styles.activeFilter
              ]}
              onPress={() => setFilterStatus('Improving')}
            >
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={[
                styles.filterButtonText,
                filterStatus === 'Improving' && styles.activeFilterText
              ]}>Improving</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                filterStatus === 'Recovered' && styles.activeFilter
              ]}
              onPress={() => setFilterStatus('Recovered')}
            >
              <View style={[styles.statusDot, { backgroundColor: '#2196F3' }]} />
              <Text style={[
                styles.filterButtonText,
                filterStatus === 'Recovered' && styles.activeFilterText
              ]}>Recovered</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {/* Pet List */}
        <FlatList
          data={filteredPets}
          renderItem={renderPetItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="pawprint.fill" size={48} color={Colors.light.icon} />
              <Text style={styles.emptyText}>No pets under treatment</Text>
            </View>
          }
        />
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    fontSize: 16,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  activeFilter: {
    backgroundColor: Colors.light.tint + '20',
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  activeFilterText: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 20,
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
  criticalCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
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
  petOwner: {
    fontSize: 14,
    color: Colors.light.icon,
    marginBottom: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  conditionContainer: {
    marginBottom: 12,
  },
  conditionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 2,
  },
  conditionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  metaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: Colors.light.icon,
    marginRight: 12,
    marginBottom: 4,
  },
  petActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  detailsButton: {
    backgroundColor: Colors.light.tint,
  },
  contactButton: {
    backgroundColor: '#4CAF50',
  },
  updateButton: {
    backgroundColor: '#FF9800',
  },
  dischargeButton: {
    backgroundColor: '#9C27B0',
  },
  actionButtonText: {
    color: '#FFF',
    marginLeft: 4,
    fontWeight: '500',
    fontSize: 12,
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
}); 