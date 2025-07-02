import * as ExpoLocation from 'expo-location';

/**
 * Wrapper for expo-location to handle errors and provide fallbacks
 */
class LocationService {
  /**
   * Check if location services are available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const providerStatus = await ExpoLocation.getProviderStatusAsync();
      return providerStatus.locationServicesEnabled;
    } catch (error) {
      console.error('Error checking location availability:', error);
      return false;
    }
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation() {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }
      
      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      // Return a default location (Manila, Philippines)
      return {
        latitude: 14.6091,
        longitude: 121.0223,
        accuracy: 0,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get address from coordinates
   */
  async getAddressFromCoordinates(latitude: number, longitude: number) {
    try {
      const addressResponse = await ExpoLocation.reverseGeocodeAsync({ 
        latitude, 
        longitude 
      });
      
      if (addressResponse && addressResponse.length > 0) {
        const addressData = addressResponse[0];
        const formattedAddress = [
          addressData.name,
          addressData.street,
          addressData.district,
          addressData.city,
          addressData.region,
          addressData.postalCode,
          addressData.country
        ]
          .filter(Boolean)
          .join(', ');
        
        return formattedAddress;
      }
      return '';
    } catch (error) {
      console.error('Error getting address:', error);
      return '';
    }
  }

  /**
   * Get coordinates from address
   */
  async getCoordinatesFromAddress(address: string) {
    try {
      const searchResults = await ExpoLocation.geocodeAsync(address);
      
      if (searchResults && searchResults.length > 0) {
        return {
          latitude: searchResults[0].latitude,
          longitude: searchResults[0].longitude
        };
      }
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }
}

export default new LocationService(); 