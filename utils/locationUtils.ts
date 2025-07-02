/**
 * Location utility functions
 */

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  // Earth's radius in kilometers
  const R = 6371;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Return distance with 1 decimal place
  return Math.round(distance * 10) / 10;
};

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
export const toRadians = (degrees: number): number => {
  return degrees * Math.PI / 180;
};

/**
 * Format a distance in kilometers to a readable string
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    // Convert to meters if less than 1 km
    const meters = Math.round(distance * 1000);
    return `${meters} m`;
  } else {
    return `${distance.toFixed(1)} km`;
  }
};

/**
 * Get the center coordinates between multiple points
 * @param points Array of coordinate objects with latitude and longitude properties
 * @returns Object with latitude and longitude for the center point
 */
export const getCenterCoordinates = (
  points: Array<{ latitude: number; longitude: number }>
): { latitude: number; longitude: number } => {
  if (points.length === 0) {
    // Default to Manila, Philippines if no points
    return { latitude: 14.6091, longitude: 121.0223 };
  }
  
  if (points.length === 1) {
    return { ...points[0] };
  }
  
  // Calculate the center of all points
  let x = 0;
  let y = 0;
  let z = 0;
  
  points.forEach(point => {
    const lat = toRadians(point.latitude);
    const lon = toRadians(point.longitude);
    
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  });
  
  x = x / points.length;
  y = y / points.length;
  z = z / points.length;
  
  const centralLongitude = Math.atan2(y, x);
  const centralSquareRoot = Math.sqrt(x * x + y * y);
  const centralLatitude = Math.atan2(z, centralSquareRoot);
  
  return {
    latitude: centralLatitude * 180 / Math.PI,
    longitude: centralLongitude * 180 / Math.PI
  };
};

/**
 * Calculate the bounding box that contains all given points with additional padding
 * @param points Array of coordinate objects with latitude and longitude properties
 * @param paddingPercent Percentage of padding to add around the bounding box (0-1)
 * @returns Object with bounds information including latitudeDelta and longitudeDelta
 */
export const getBoundingBox = (
  points: Array<{ latitude: number; longitude: number }>,
  paddingPercent: number = 0.1
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } => {
  if (points.length === 0) {
    // Default to Manila with some arbitrary span
    return { 
      latitude: 14.6091, 
      longitude: 121.0223, 
      latitudeDelta: 0.05, 
      longitudeDelta: 0.05 
    };
  }
  
  let minLat = Number.MAX_VALUE;
  let maxLat = Number.MIN_VALUE;
  let minLon = Number.MAX_VALUE;
  let maxLon = Number.MIN_VALUE;
  
  // Find min and max of lat and lon
  points.forEach(point => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  });
  
  // Calculate center
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  
  // Calculate deltas
  let latDelta = (maxLat - minLat) * (1 + paddingPercent);
  let lonDelta = (maxLon - minLon) * (1 + paddingPercent);
  
  // Ensure minimum delta for a reasonable zoom level
  latDelta = Math.max(latDelta, 0.01);
  lonDelta = Math.max(lonDelta, 0.01);
  
  return {
    latitude: centerLat,
    longitude: centerLon,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta
  };
}; 