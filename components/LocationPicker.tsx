import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Text,
  Alert,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import LocationService from '../utils/LocationService';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';
import { IconSymbol } from './ui/IconSymbol';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  onLocationSelect?: (location: LocationData) => void;
  initialLocation?: LocationCoordinates;
  buttonTitle?: string;
  isEditable?: boolean;
  showSearch?: boolean;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  initialLocation,
  buttonTitle = 'Save Location',
  isEditable = true,
  showSearch = true,
}) => {
  const mapRef = useRef<MapView | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [location, setLocation] = useState<Region>({
    latitude: initialLocation?.latitude || 14.6091,  // Default to Manila
    longitude: initialLocation?.longitude || 121.0223,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02
  });
  const [markerLocation, setMarkerLocation] = useState<LocationCoordinates | null>(initialLocation || null);

  const getAddressFromCoords = useCallback(async (latitude: number, longitude: number): Promise<string> => {
    try {
      const formattedAddress = await LocationService.getAddressFromCoordinates(latitude, longitude);
      setAddress(formattedAddress);
      return formattedAddress;
    } catch (error) {
      console.error('Error getting address:', error);
      return '';
    }
  }, []);

  // Initialize with user's location if available
  useEffect(() => {
    async function setupLocationServices(): Promise<void> {
      try {
        setLoading(true);
        
        // If we have an initial location, get its address
        if (initialLocation) {
          setMarkerLocation(initialLocation);
          await getAddressFromCoords(initialLocation.latitude, initialLocation.longitude);
        } else {
          // Request location permissions
          const hasPermission = await LocationService.requestPermissions();
          setLocationPermission(hasPermission);
          
          if (hasPermission) {
            try {
              // Get current position
              const position = await LocationService.getCurrentLocation();
              
              const newLocation = {
                latitude: position.latitude,
                longitude: position.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02
              };
              
              setLocation(newLocation);
              setMarkerLocation({
                latitude: position.latitude,
                longitude: position.longitude
              });
              
              // Get address from coordinates
              await getAddressFromCoords(position.latitude, position.longitude);
            } catch (error) {
              console.error('Error getting location:', error);
            }
          }
        }
      } catch (error) {
        console.error('Location service error:', error);
      } finally {
        setLoading(false);
      }
    }
    
    setupLocationServices();
  }, [initialLocation, getAddressFromCoords]);

  // Handle map press to place a marker
  const handleMapPress = async (event: any) => {
    if (!isEditable) return;
    
    const { coordinate } = event.nativeEvent;
    setMarkerLocation(coordinate);
    
    const formattedAddress = await getAddressFromCoords(coordinate.latitude, coordinate.longitude);
    
    // If callback is provided, call it with the new location
    if (onLocationSelect) {
      onLocationSelect({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        address: formattedAddress
      });
    }
  };

  // Search for location
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const coordinates = await LocationService.getCoordinatesFromAddress(searchQuery);
      
      if (coordinates) {
        const { latitude, longitude } = coordinates;
        
        // Update map location
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        };
        
        setLocation(newRegion);
        setMarkerLocation({ latitude, longitude });
        mapRef.current?.animateToRegion(newRegion);
        
        // Get address
        const formattedAddress = await getAddressFromCoords(latitude, longitude);
        
        // If callback is provided, call it with the new location
        if (onLocationSelect) {
          onLocationSelect({
            latitude,
            longitude,
            address: formattedAddress
          });
        }
      } else {
        Alert.alert('Not Found', 'No location found for the given search query.');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Unable to search for the location.');
    } finally {
      setLoading(false);
      setIsSearchFocused(false);
    }
  };

  // Get current location
  const getUserLocation = async () => {
    try {
      const hasPermission = await LocationService.requestPermissions();
      setLocationPermission(hasPermission);
      
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to use this feature.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      setLoading(true);
      const position = await LocationService.getCurrentLocation();
      
      const newLocation = {
        latitude: position.latitude,
        longitude: position.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02
      };
      
      setLocation(newLocation);
      setMarkerLocation({
        latitude: position.latitude,
        longitude: position.longitude
      });
      
      mapRef.current?.animateToRegion(newLocation);
      
      // Get address
      const formattedAddress = await getAddressFromCoords(position.latitude, position.longitude);
      
      // If callback is provided, call it with the new location
      if (onLocationSelect) {
        onLocationSelect({
          latitude: position.latitude,
          longitude: position.longitude,
          address: formattedAddress
        });
      }
    } catch (error) {
      console.error('Error getting user location:', error);
      Alert.alert('Location Error', 'Unable to get your current location.');
    } finally {
      setLoading(false);
    }
  };

  // Save button handler
  const handleSave = () => {
    if (!markerLocation) {
      Alert.alert('No Location', 'Please select a location on the map first.');
      return;
    }
    
    if (onLocationSelect) {
      onLocationSelect({
        latitude: markerLocation.latitude,
        longitude: markerLocation.longitude,
        address
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {showSearch && (
        <View style={styles.searchContainer}>
          <View style={[
            styles.searchBar,
            isSearchFocused && styles.searchBarFocused
          ]}>
            <IconSymbol name="magnifyingglass" size={20} color={Colors.light.icon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a location"
              placeholderTextColor={Colors.light.icon}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              editable={isEditable}
            />
          </View>
          
          {isEditable && (
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={handleSearch}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={location}
          region={location}
          showsUserLocation={locationPermission}
          showsMyLocationButton={false}
          showsCompass={true}
          showsPointsOfInterest={true}
          onPress={handleMapPress}
          scrollEnabled={isEditable}
          zoomEnabled={isEditable}
          rotateEnabled={isEditable}
          pitchEnabled={isEditable}
        >
          {markerLocation && (
            <Marker
              coordinate={markerLocation}
              title="Selected Location"
              description={address}
              draggable={isEditable}
              onDragEnd={(e) => {
                if (isEditable) {
                  const coordinate = e.nativeEvent.coordinate;
                  setMarkerLocation(coordinate);
                  getAddressFromCoords(
                    coordinate.latitude,
                    coordinate.longitude
                  ).then(formattedAddress => {
                    if (onLocationSelect) {
                      onLocationSelect({
                        latitude: coordinate.latitude,
                        longitude: coordinate.longitude,
                        address: formattedAddress
                      });
                    }
                  });
                }
              }}
            />
          )}
        </MapView>
        
        {loading && (
          <ActivityIndicator 
            size="large" 
            color={Colors.light.tint} 
            style={styles.loader}
          />
        )}
        
        {/* Map Control Buttons */}
        {isEditable && (
          <View style={styles.mapControls}>
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={getUserLocation}
            >
              <IconSymbol name="location.fill" size={24} color={Colors.light.babyBlue} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={() => {
                if (mapRef.current) {
                  mapRef.current.animateToRegion({
                    ...location,
                    latitudeDelta: location.latitudeDelta * 0.7,
                    longitudeDelta: location.longitudeDelta * 0.7
                  });
                }
              }}
            >
              <IconSymbol name="plus" size={24} color={Colors.light.mintGreen} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={() => {
                if (mapRef.current) {
                  mapRef.current.animateToRegion({
                    ...location,
                    latitudeDelta: location.latitudeDelta * 1.5,
                    longitudeDelta: location.longitudeDelta * 1.5
                  });
                }
              }}
            >
              <IconSymbol name="minus" size={24} color={Colors.light.peach} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <View style={styles.addressBar}>
        <IconSymbol name="mappin" size={20} color={Colors.light.babyBlue} />
        <Text style={styles.addressText}>
          {address || 'No location selected'}
        </Text>
      </View>
      
      {isEditable && (
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={!markerLocation}
        >
          <Text style={styles.saveButtonText}>{buttonTitle}</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  searchBarFocused: {
    borderColor: Colors.light.babyBlue,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.light.text,
  },
  searchButton: {
    marginLeft: 12,
    backgroundColor: Colors.light.babyBlue,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchButtonText: {
    ...Typography.nunitoBodyBold,
    color: '#FFFFFF',
  },
  mapContainer: {
    height: 300,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  mapControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  addressText: {
    ...Typography.nunitoBody,
    flex: 1,
    marginLeft: 8,
    color: Colors.light.text,
  },
  saveButton: {
    backgroundColor: Colors.light.babyBlue,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...Typography.nunitoBodyBold,
    color: '#FFFFFF',
  },
});

export default LocationPicker; 