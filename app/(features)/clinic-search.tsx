import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  Linking,
  Platform,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import LocationService from '../../utils/LocationService';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { calculateDistance, formatDistance, getBoundingBox } from '../../utils/locationUtils';

// Define clinic type
interface Clinic {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviews: number;
  distance: number;
  specialty: string[];
  image: any;
  openingHours: {
    open: boolean;
    hours: string;
  };
  nextAvailable: string;
  location: {
    latitude: number;
    longitude: number;
  };
  description: string;
  phoneNumber: string;
  website: string;
}

// Mock data for clinics
const MOCK_CLINICS: Clinic[] = [
  {
    id: '1',
    name: 'PawCare Veterinary Clinic',
    address: '123 Pet Street, Pet City',
    rating: 4.8,
    reviews: 42,
    distance: 1.2,
    specialty: ['General Care', 'Surgery', 'Dental'],
    image: require('../../assets/images/peteat-logo.png'),
    openingHours: {
      open: true,
      hours: '8:00 AM - 7:00 PM'
    },
    nextAvailable: 'Today, 3:30 PM',
    location: {
      latitude: 14.6091,
      longitude: 121.0223
    },
    description: 'A full-service veterinary clinic providing comprehensive care for all types of pets.',
    phoneNumber: '+63 (2) 8123 4567',
    website: 'https://pawcare.example.com'
  },
  {
    id: '2',
    name: 'Healthy Pets Center',
    address: '456 Animal Avenue, Vet District',
    rating: 4.5,
    reviews: 38,
    distance: 2.5,
    specialty: ['Dermatology', 'Nutrition', 'Wellness'],
    image: require('../../assets/images/peteat-logo.png'),
    openingHours: {
      open: true,
      hours: '9:00 AM - 6:00 PM'
    },
    nextAvailable: 'Tomorrow, 10:00 AM',
    location: {
      latitude: 14.6292,
      longitude: 121.0345
    },
    description: 'Specializing in preventive care and wellness programs for pets of all ages.',
    phoneNumber: '+63 (2) 8987 6543',
    website: 'https://healthypets.example.com'
  },
  {
    id: '3',
    name: 'Cat Care Specialists',
    address: '789 Feline Road, Cat Town',
    rating: 4.9,
    reviews: 56,
    distance: 3.7,
    specialty: ['Feline Medicine', 'Grooming', 'Behavior'],
    image: require('../../assets/images/peteat-logo.png'),
    openingHours: {
      open: false,
      hours: '10:00 AM - 5:00 PM'
    },
    nextAvailable: 'Friday, 2:15 PM',
    location: {
      latitude: 14.5984,
      longitude: 121.0112
    },
    description: 'A cat-focused clinic with specialists in feline medicine and behavior.',
    phoneNumber: '+63 (2) 8765 4321',
    website: 'https://catcare.example.com'
  },
  {
    id: '4',
    name: 'Emergency Pet Hospital',
    address: '321 Urgent Lane, Quick Response City',
    rating: 4.7,
    reviews: 89,
    distance: 4.1,
    specialty: ['Emergency Care', 'Critical Care', 'Surgery'],
    image: require('../../assets/images/peteat-logo.png'),
    openingHours: {
      open: true,
      hours: '24/7'
    },
    nextAvailable: 'Now',
    location: {
      latitude: 14.6143,
      longitude: 121.0437
    },
    description: '24/7 emergency veterinary services for all pet emergencies.',
    phoneNumber: '+63 (2) 8911 1234',
    website: 'https://emergencypet.example.com'
  },
  {
    id: '5',
    name: 'Exotic Pets Clinic',
    address: '567 Rare Species Blvd, Exotic Gardens',
    rating: 4.6,
    reviews: 29,
    distance: 5.3,
    specialty: ['Exotic Animals', 'Birds', 'Reptiles'],
    image: require('../../assets/images/peteat-logo.png'),
    openingHours: {
      open: true,
      hours: '9:30 AM - 4:30 PM'
    },
    nextAvailable: 'Thursday, 11:45 AM',
    location: {
      latitude: 14.5872,
      longitude: 121.0278
    },
    description: 'Specialized care for exotic pets including birds, reptiles, and small mammals.',
    phoneNumber: '+63 (2) 8543 2109',
    website: 'https://exoticpets.example.com'
  }
];

// Sort options
const SORT_OPTIONS = [
  { label: 'Nearest', value: 'nearest' },
  { label: 'Farthest', value: 'farthest' },
  { label: 'Highest Rated', value: 'highest' },
  { label: 'Most Reviewed', value: 'most_reviewed' },
  { label: 'Earliest Available', value: 'earliest' },
  { label: 'Open Now', value: 'open_now' },
];

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export default function ClinicSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClinics, setFilteredClinics] = useState<Clinic[]>(MOCK_CLINICS);
  const [sortBy, setSortBy] = useState('nearest');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Region>({
    latitude: 14.6091,  // Default to Manila, Philippines
    longitude: 121.0223,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05
  });
  const [showClinicDetails, setShowClinicDetails] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Request location permission on component mount
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const isAvailable = await LocationService.isAvailable();
        if (!isAvailable) {
          Alert.alert(
            "Location Services Unavailable",
            "Location services are not available. Map features will be limited.",
            [{ text: "OK" }]
          );
          return;
        }
        
        const hasPermission = await LocationService.requestPermissions();
        setLocationPermission(hasPermission);
        
        if (hasPermission) {
          getUserLocation();
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        Alert.alert(
          "Location Error", 
          "There was a problem accessing your location. Map features will be limited.",
          [{ text: "OK" }]
        );
      }
    };
    
    requestLocationPermission();
  }, []);

  // Calculate and update clinic distances based on user location
  const updateClinicDistances = (userLat: number, userLng: number) => {
    const updatedClinics = MOCK_CLINICS.map(clinic => ({
      ...clinic,
      distance: calculateDistance(
        userLat, 
        userLng, 
        clinic.location.latitude, 
        clinic.location.longitude
      )
    }));
    
    setFilteredClinics(updatedClinics);
    return updatedClinics;
  };

  // Get user's location
  const getUserLocation = async () => {
    try {
      setLoading(true);
      const position = await LocationService.getCurrentLocation();
      
      const userLat = position.latitude;
      const userLng = position.longitude;
      
      const newLocation = {
        latitude: userLat,
        longitude: userLng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      
      setLocation(newLocation);
      mapRef.current?.animateToRegion(newLocation);
      
      // Update distances and sort by nearest
      const updatedClinics = updateClinicDistances(userLat, userLng);
      sortClinicsByOption(updatedClinics, 'nearest');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        "Location Error", 
        "Couldn't get your current location. Using default location instead.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle search input
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      const updatedClinics = updateClinicDistances(location.latitude, location.longitude);
      setFilteredClinics(updatedClinics);
      sortClinicsByOption(updatedClinics, sortBy);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = MOCK_CLINICS.filter(clinic => 
      clinic.name.toLowerCase().includes(query) || 
      clinic.address.toLowerCase().includes(query) ||
      clinic.specialty.some(s => s.toLowerCase().includes(query))
    ).map(clinic => ({
      ...clinic,
      distance: calculateDistance(
        location.latitude, 
        location.longitude, 
        clinic.location.latitude, 
        clinic.location.longitude
      )
    }));
    
    setFilteredClinics(filtered);
    sortClinicsByOption(filtered, sortBy);
    
    // If we found results, adjust map to show them
    if (filtered.length > 0) {
      const points = filtered.map(c => c.location);
      const region = getBoundingBox(points);
      mapRef.current?.animateToRegion(region);
    }
  };

  // Sort clinics based on selected option
  const sortClinicsByOption = (clinics: Clinic[], option: string) => {
    let sorted = [...clinics];
    
    switch (option) {
      case 'nearest':
        sorted.sort((a, b) => a.distance - b.distance);
        break;
      case 'farthest':
        sorted.sort((a, b) => b.distance - a.distance);
        break;
      case 'highest':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'most_reviewed':
        sorted.sort((a, b) => b.reviews - a.reviews);
        break;
      case 'earliest':
        // Mock sort by next available (would need real data)
        sorted.sort((a, b) => a.nextAvailable.includes('Today') ? -1 : 1);
        break;
      case 'open_now':
        sorted.sort((a, b) => (a.openingHours.open === b.openingHours.open) 
          ? 0 
          : a.openingHours.open ? -1 : 1);
        break;
      default:
        break;
    }
    
    setFilteredClinics(sorted);
  };

  // Handle sort selection
  const handleSortSelect = (option: string) => {
    setSortBy(option);
    setShowSortOptions(false);
    sortClinicsByOption(filteredClinics, option);
  };

  // Handle clinic selection
  const handleClinicSelect = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setShowClinicDetails(true);
    
    // Animate map to selected clinic
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: clinic.location.latitude,
        longitude: clinic.location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02
      });
    }
  };

  // Get sort option display name
  const getSortOptionLabel = (value: string): string => {
    const option = SORT_OPTIONS.find(opt => opt.value === value);
    return option ? option.label : 'Sort By';
  };

  // Navigate back
  const goBack = () => {
    router.back();
  };

  // Toggle map expanded state
  const toggleMapSize = () => {
    setMapExpanded(!mapExpanded);
  };

  // Render clinic list item
  const renderClinicItem = ({ item }: { item: Clinic }) => (
    <TouchableOpacity 
      style={styles.clinicItem} 
      onPress={() => handleClinicSelect(item)}
    >
      <Image source={item.image} style={styles.clinicImage} />
      
      <View style={styles.clinicInfo}>
        <Text style={styles.clinicName}>{item.name}</Text>
        <Text style={styles.clinicAddress}>{item.address}</Text>
        
        <View style={styles.clinicMetaRow}>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>{item.rating}</Text>
            <IconSymbol name="star.fill" size={12} color="#FFD700" />
            <Text style={styles.reviewCount}>({item.reviews})</Text>
          </View>
          
          <Text style={styles.distanceText}>{formatDistance(item.distance)}</Text>
          
          <View style={[
            styles.statusBadge, 
            item.openingHours.open ? styles.openStatus : styles.closedStatus
          ]}>
            <Text style={styles.statusText}>
              {item.openingHours.open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
        
        <View style={styles.specialtyContainer}>
          {item.specialty.slice(0, 2).map((spec, index) => (
            <View key={index} style={styles.specialtyBadge}>
              <Text style={styles.specialtyText}>{spec}</Text>
            </View>
          ))}
          {item.specialty.length > 2 && (
            <Text style={styles.moreSpecialty}>+{item.specialty.length - 2} more</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const mapHeight = mapExpanded ? { height: 400 } : { height: 200 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Clinics</Text>
        <View style={styles.spacer} />
      </View>
      
      {/* Search and Filter Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputContainer}>
          <IconSymbol name="magnifyingglass" size={20} color={Colors.light.icon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinics by name, address, or specialty"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setFilteredClinics(MOCK_CLINICS);
              }}
              style={styles.clearButton}
            >
              <IconSymbol name="xmark.circle.fill" size={16} color={Colors.light.icon} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Sort Dropdown */}
        <TouchableOpacity 
          style={styles.sortButton} 
          onPress={() => setShowSortOptions(!showSortOptions)}
        >
          <Text style={styles.sortButtonText}>{getSortOptionLabel(sortBy)}</Text>
          <IconSymbol 
            name={showSortOptions ? "chevron.up" : "chevron.down"} 
            size={16} 
            color={Colors.light.text}
          />
        </TouchableOpacity>
      </View>
      
      {/* Sort Options Dropdown */}
      {showSortOptions && (
        <View style={styles.sortOptionsContainer}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.selectedSortOption
              ]}
              onPress={() => handleSortSelect(option.value)}
            >
              <Text style={[
                styles.sortOptionText,
                sortBy === option.value && styles.selectedSortText
              ]}>
                {option.label}
              </Text>
              {sortBy === option.value && (
                <IconSymbol name="checkmark" size={16} color={Colors.light.tint} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Map View */}
      <View style={[styles.mapContainer, mapHeight]}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={location}
          showsUserLocation={locationPermission}
          showsMyLocationButton={false}
          showsPointsOfInterest={true}
          showsCompass={true}
        >
          {filteredClinics.map((clinic) => (
            <Marker
              key={clinic.id}
              coordinate={clinic.location}
              title={clinic.name}
              description={formatDistance(clinic.distance) + ' • ' + (clinic.openingHours.open ? 'Open Now' : 'Closed')}
              onPress={() => handleClinicSelect(clinic)}
            >
              <Callout tooltip>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{clinic.name}</Text>
                  <Text style={styles.calloutAddress}>{clinic.address}</Text>
                  <View style={styles.calloutRow}>
                    <Text style={styles.calloutDistance}>{formatDistance(clinic.distance)}</Text>
                    <View style={[
                      styles.calloutStatusBadge, 
                      clinic.openingHours.open ? styles.openStatus : styles.closedStatus
                    ]}>
                      <Text style={styles.calloutStatusText}>
                        {clinic.openingHours.open ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.calloutTapText}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
        
        {/* Map Control Buttons */}
        <View style={styles.mapControlsContainer}>
          {/* Toggle Map Size Button */}
          <TouchableOpacity 
            style={styles.mapControlButton}
            onPress={toggleMapSize}
          >
            <IconSymbol 
              name={mapExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"} 
              size={20} 
              color={Colors.light.tint} 
            />
          </TouchableOpacity>
          
          {/* User Location Button */}
          {locationPermission && (
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={getUserLocation}
            >
              <IconSymbol name="location" size={20} color={Colors.light.tint} />
            </TouchableOpacity>
          )}
        </View>
        
        {loading && (
          <ActivityIndicator 
            size="large" 
            color={Colors.light.tint} 
            style={styles.loader}
          />
        )}
      </View>
      
      {/* Bottom Clinic List */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>
          {filteredClinics.length} {filteredClinics.length === 1 ? 'Clinic' : 'Clinics'} Found
        </Text>
        
        <FlatList
          data={filteredClinics}
          renderItem={renderClinicItem}
          keyExtractor={(item) => item.id}
          horizontal={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.clinicsList}
          ListEmptyComponent={
            <View style={styles.noResultsContainer}>
              <IconSymbol name="magnifyingglass" size={40} color={Colors.light.icon} />
              <Text style={styles.noResultsText}>No clinics found matching your search</Text>
              <TouchableOpacity 
                style={styles.resetSearchButton}
                onPress={() => {
                  setSearchQuery('');
                  setFilteredClinics(MOCK_CLINICS);
                  sortClinicsByOption(MOCK_CLINICS, sortBy);
                }}
              >
                <Text style={styles.resetSearchText}>Reset Search</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
      
      {/* Clinic Details Modal */}
      <Modal
        visible={showClinicDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowClinicDetails(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowClinicDetails(false)}
              >
                <IconSymbol name="xmark" size={20} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            
            {selectedClinic && (
              <ScrollView style={styles.clinicDetailsContainer}>
                {/* Clinic Image */}
                <Image 
                  source={selectedClinic.image} 
                  style={styles.clinicDetailImage}
                  resizeMode="cover"
                />
                
                {/* Clinic Name and Rating */}
                <View style={styles.clinicDetailHeader}>
                  <Text style={styles.clinicDetailName}>{selectedClinic.name}</Text>
                  <View style={styles.ratingContainer}>
                    <Text style={styles.ratingText}>{selectedClinic.rating}</Text>
                    <IconSymbol name="star.fill" size={14} color="#FFD700" />
                    <Text style={styles.reviewCount}>({selectedClinic.reviews} reviews)</Text>
                  </View>
                </View>
                
                {/* Status Badge */}
                <View style={styles.detailRow}>
                  <View style={[
                    styles.statusBadge, 
                    selectedClinic.openingHours.open ? styles.openStatus : styles.closedStatus,
                  ]}>
                    <Text style={styles.statusText}>
                      {selectedClinic.openingHours.open ? 'Open Now' : 'Closed'}
                    </Text>
                  </View>
                  <Text style={styles.distanceDetailText}>
                    {formatDistance(selectedClinic.distance)} away
                  </Text>
                </View>
                
                {/* Description */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailText}>{selectedClinic.description}</Text>
                </View>
                
                {/* Opening Hours */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Opening Hours</Text>
                  <Text style={styles.detailText}>{selectedClinic.openingHours.hours}</Text>
                </View>
                
                {/* Next Available */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Next Available</Text>
                  <Text style={styles.detailText}>{selectedClinic.nextAvailable}</Text>
                </View>
                
                {/* Address */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailText}>{selectedClinic.address}</Text>
                  <TouchableOpacity 
                    style={styles.directionButton}
                    onPress={() => {
                      const url = Platform.select({
                        ios: `maps:?q=${selectedClinic.name}&ll=${selectedClinic.location.latitude},${selectedClinic.location.longitude}`,
                        android: `geo:${selectedClinic.location.latitude},${selectedClinic.location.longitude}?q=${selectedClinic.name}`
                      });
                      Linking.openURL(url || '');
                    }}
                  >
                    <IconSymbol name="location.fill" size={16} color="#FFFFFF" />
                    <Text style={styles.directionButtonText}>Get Directions</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Contact Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Contact</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${selectedClinic.phoneNumber}`)}
                    style={styles.contactButton}
                  >
                    <IconSymbol name="phone.fill" size={16} color={Colors.light.tint} />
                    <Text style={styles.contactButtonText}>{selectedClinic.phoneNumber}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => Linking.openURL(selectedClinic.website)}
                    style={styles.contactButton}
                  >
                    <IconSymbol name="globe" size={16} color={Colors.light.tint} />
                    <Text style={styles.contactButtonText}>{selectedClinic.website}</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Specialties */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Specialties</Text>
                  <View style={styles.specialtyRow}>
                    {selectedClinic.specialty.map((spec, index) => (
                      <View key={index} style={styles.specialtyBadgeLarge}>
                        <Text style={styles.specialtyText}>{spec}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                
                {/* Book Button */}
                <TouchableOpacity 
                  style={styles.bookButton}
                  onPress={() => {
                    setShowClinicDetails(false);
                    router.push('/(features)/booking');
                  }}
                >
                  <Text style={styles.bookButtonText}>Book Appointment</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  spacer: {
    width: 40,
  },
  searchBarContainer: {
    padding: 16,
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
    height: 40,
    paddingHorizontal: 8,
  },
  clearButton: {
    padding: 4,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  sortButtonText: {
    fontSize: 14,
    color: Colors.light.text,
    marginRight: 8,
  },
  sortOptionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  selectedSortOption: {
    backgroundColor: '#f0f7ff',
  },
  sortOptionText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  selectedSortText: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  mapContainer: {
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControlsContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  clinicsList: {
    paddingBottom: 16,
  },
  clinicItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  clinicImage: {
    width: 100,
    height: 100,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  clinicInfo: {
    flex: 1,
    padding: 12,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  clinicAddress: {
    fontSize: 13,
    color: Colors.light.icon,
    marginBottom: 8,
  },
  clinicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: Colors.light.icon,
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 13,
    color: Colors.light.icon,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  openStatus: {
    backgroundColor: '#e6f7e6',
  },
  closedStatus: {
    backgroundColor: '#ffebeb',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  specialtyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specialtyBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  specialtyText: {
    fontSize: 12,
    color: Colors.light.text,
  },
  moreSpecialty: {
    fontSize: 12,
    color: Colors.light.icon,
    alignSelf: 'center',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noResultsText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.icon,
    textAlign: 'center',
  },
  resetSearchButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginTop: 16,
  },
  resetSearchText: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  clinicDetailsContainer: {
    flex: 1,
  },
  clinicDetailImage: {
    width: '100%',
    height: 200,
  },
  clinicDetailHeader: {
    padding: 16,
  },
  clinicDetailName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  distanceDetailText: {
    fontSize: 14,
    color: Colors.light.icon,
  },
  detailSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.light.icon,
    lineHeight: 22,
  },
  specialtyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  specialtyBadgeLarge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    margin: 4,
  },
  directionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  directionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactButtonText: {
    marginLeft: 8,
    color: Colors.light.tint,
  },
  bookButton: {
    backgroundColor: Colors.light.tint,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  calloutContainer: {
    width: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: Colors.light.text,
  },
  calloutAddress: {
    fontSize: 12,
    color: Colors.light.icon,
    marginBottom: 6,
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calloutDistance: {
    fontSize: 11,
    color: Colors.light.icon,
  },
  calloutStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  calloutStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  calloutTapText: {
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
    color: Colors.light.tint,
    marginTop: 4,
  },
}); 