// API service for connecting to backend
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Base URL - change this to your actual backend URL when deployed
// For local development with Expo:
// - Android emulator: http://10.0.2.2:5000/api
// - iOS simulator: http://localhost:5000/api
// - Physical device using Expo Go: http://YOUR_LOCAL_IP:5000/api (e.g., http://192.168.1.10:5000/api)

// Prefer explicit base URL provided via environment variable or app.config extra
const ENV_BASE_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;

// Development IP (override via EXPO_PUBLIC_DEV_IP or in app.config extra.devIp)
const DEV_IP = process.env.EXPO_PUBLIC_DEV_IP || Constants.expoConfig?.extra?.devIp || '192.168.1.15';

export const API_BASE_URL = ENV_BASE_URL || 'https://peteat-backend.onrender.com/api';

// Derive a sensible default when no env override is supplied
if (!API_BASE_URL) {
if (Platform.OS === 'android') {
    // Use custom dev IP when testing on a physical Android device; default to Android-emulator loopback
    API_BASE_URL = `http://${DEV_IP || '10.0.2.2'}:5050/api`;
} else if (Platform.OS === 'ios') {
  API_BASE_URL = 'http://localhost:5050/api';
} else {
  API_BASE_URL = 'http://localhost:5050/api';
  }
}

// Fallback URLs to try if the main one fails, starting with any explicit override
const FALLBACK_URLS = [
  ...(ENV_BASE_URL ? [ENV_BASE_URL] : []),
  `http://${DEV_IP}:5050/api`,
  `http://${DEV_IP}:5051/api`,
  'http://10.0.2.2:5050/api',
  'http://10.0.2.2:5051/api',
  'http://localhost:5050/api',
  'http://localhost:5051/api',
  'http://127.0.0.1:5050/api',
  'http://127.0.0.1:5051/api',
  // Keep the original ports as fallbacks in case the app is configured to use them
  `http://${DEV_IP}:5000/api`,
  'http://10.0.2.2:5000/api',
  'http://localhost:5000/api',
  'http://127.0.0.1:5000/api'
];

console.log('Using API URL:', API_BASE_URL);

// Function to try fallback URLs if the main one fails
const tryFallbackUrls = async () => {
  for (const url of FALLBACK_URLS) {
    if (url === API_BASE_URL) continue; // Skip the current URL
    
    try {
      console.log(`Trying fallback URL: ${url}`);
      
      // Create a timeout promise that rejects after 2 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 2000);
      });
      
      // Create the fetch promise
      const fetchPromise = fetch(`${url}/health`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      // Race the fetch against the timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (response.ok) {
        console.log(`Fallback URL ${url} is working, switching to it`);
        api.defaults.baseURL = url;
        return true;
      }
    } catch (error) {
      console.log(`Fallback URL ${url} failed:`, error.message);
    }
  }
  
  console.log('All fallback URLs failed');
  return false;
};

// Token storage keys
const AUTH_TOKEN_KEY = 'peteat_auth_token';
const REFRESH_TOKEN_KEY = 'peteat_refresh_token';
const USER_DATA_KEY = 'peteat_user_data';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds timeout
});

// Add token to requests if available
api.interceptors.request.use(
  async (config) => {
    // First try to use the in-memory token for better performance
    if (_token) {
      config.headers['x-auth-token'] = _token;
    } else {
      // Fall back to storage if in-memory token is not available
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (token) {
        _token = token; // Update in-memory token
        config.headers['x-auth-token'] = token;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration errors and network issues
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      if (error.response.data.message === 'Token expired') {
        // Attempt to refresh the token once
        try {
          const success = await tryRefreshToken();
          if (success) {
            // Retry the original request with new token
            error.config.headers['x-auth-token'] = _token;
            return api(error.config);
          }
        } catch (e) {
          console.log('Refresh token attempt failed:', e.message);
        }
        // If refresh fails – clear auth
        await clearAuthData();
      }
    }
    
    // Handle network errors by trying fallback URLs
    if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      console.log('Network error detected, trying fallback URLs...');
      const fallbackSuccess = await tryFallbackUrls();
      
      if (fallbackSuccess && error.config) {
        console.log('Retrying request with new base URL');
        // Retry the request with the new base URL
        return axios(error.config);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth state management
let _user = null;
let _token = null;
let _authListeners = [];

const notifyAuthListeners = () => {
  _authListeners.forEach(listener => listener(_user));
};

// Save auth data
const saveAuthData = async (token, user, refreshToken) => {
  // Ensure user has a proper id field
  if (user && user._id && !user.id) {
    user.id = user._id.toString();
    console.log("Fixed missing id field:", user.id);
  }
  
  // Ensure we have a valid user with id before saving
  if (user && !user.id) {
    console.error("Warning: Attempting to save user without id field:", user);
    // Don't save invalid user data
    return;
  }
  
  if (token) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  if (user) await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(user));
  
  _token = token;
  _user = user;
  notifyAuthListeners();
};

// Clear auth data
const clearAuthData = async () => {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_DATA_KEY);
  
  _token = null;
  _user = null;
  notifyAuthListeners();
};

// Initialize auth from storage
const initializeAuth = async () => {
  try {
    const [token, userData] = await Promise.all([
      SecureStore.getItemAsync(AUTH_TOKEN_KEY),
      SecureStore.getItemAsync(USER_DATA_KEY),
    ]);
    
    if (token && userData) {
      _token = token;
      
      try {
        const parsedUser = JSON.parse(userData);
        
        // Ensure user has a proper id field
        if (parsedUser && parsedUser._id && !parsedUser.id) {
          parsedUser.id = parsedUser._id.toString();
          console.log("Fixed missing id field during initialization:", parsedUser.id);
          
          // Save the fixed user data back to storage
          await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(parsedUser));
        }
        
        // Validate that we have a proper user object with ID
        if (!parsedUser || !parsedUser.id) {
          console.error("Invalid user data in storage, missing id field:", parsedUser);
          await clearAuthData(); // Clear invalid data
          return false;
        }
        
        _user = parsedUser;
        console.log("Auth initialized successfully with user:", _user.email);
        notifyAuthListeners();

        // Once baseline auth is loaded, fire-and-forget pending onboarding sync in background
        setTimeout(() => {
          authAPI.syncPendingOnboarding();
        }, 500);

        return true;
      } catch (parseError) {
        console.error('Error parsing user data:', parseError);
        await clearAuthData(); // Clear invalid data
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error('Error initializing auth:', error);
    return false;
  }
};

// Function to test server connection directly
export const testServerConnection = async () => {
  console.log("Testing direct server connection...");
  
  // Try the hardcoded IP first
  try {
    console.log(`Testing connection to http://${DEV_IP}:5000/api/health`);
    // Create a timeout that will abort the fetch after 5 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`http://${DEV_IP}:5000/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log("Server connection successful!");
      return true;
    } else {
      console.log("Server returned error:", await response.text());
      return false;
    }
  } catch (error) {
    console.error("Server connection test failed:", error.message);
    return false;
  }
};

// Authentication APIs
export const authAPI = {
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/users/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  verifyResetCode: async (email, code) => {
    try {
      const response = await api.post('/users/verify-reset-code', { email, code });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  resetPassword: async (resetToken, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/users/reset-password', {
        resetToken,
        newPassword,
        confirmPassword
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  login: async (email, password, rememberMe = false) => {
    try {
      const response = await api.post('/users/login', { email, password, rememberMe });
      const { token, refreshToken, user } = response.data;
      
      // Ensure user object has correct user type (pet_owner or clinic only)
      const processedUser = {
        ...user,
        // Ensure we have an id field (frontend uses id, backend uses _id)
        id: user._id || user.id,
        // Convert any admin users to pet_owner for mobile app
        userType: user.userType === 'admin' ? 'pet_owner' : user.userType || 'pet_owner',
        // Make sure isVerified field is passed through
        isVerified: user.isVerified !== undefined ? user.isVerified : true
      };
      
      console.log("Login successful, user data:", {
        id: processedUser.id,
        email: processedUser.email,
        userType: processedUser.userType,
        isVerified: processedUser.isVerified
      });
      
      await saveAuthData(token, processedUser, refreshToken);
      return processedUser;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  loginWithGoogle: async (accessToken) => {
    try {
      const response = await api.post('/users/auth/google/mobile', { accessToken });
      const { token, refreshToken, user } = response.data;
      
      // Ensure user has correct user type (pet_owner or clinic only)
      const processedUser = {
        ...user,
        userType: user.userType === 'admin' ? 'pet_owner' : user.userType || 'pet_owner',
      };
      
      await saveAuthData(token, processedUser, refreshToken);
      return processedUser;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  register: async (userData) => {
    try {
      console.log("Registration called with userData:", userData);
      
      // Normalize address and contactNumber if they exist
      if (userData.address) {
        userData.address = userData.address.trim();
        console.log("Including address in registration:", userData.address);
      }
      
      if (userData.contactNumber) {
        userData.contactNumber = userData.contactNumber.trim();
        console.log("Including contactNumber in registration:", userData.contactNumber);
      }
      
      // Ensure username is properly handled
      if (userData.username) {
        userData.username = userData.username.trim();
        console.log("Including username in registration:", userData.username);
      } else {
        // Remove username field completely if not provided (don't set to null/undefined)
        delete userData.username;
        console.log("No username provided, removing field from request");
      }
      
      // Determine which registration endpoint to use based on userType
      let endpoint = userData.userType === 'clinic' 
        ? '/users/register/clinic' 
        : '/users/register/pet-owner';
      
      // Use fallback endpoint if there are no file uploads
      if (userData.userType === 'pet_owner' && !userData.profilePicture) {
        endpoint = '/users/register/pet-owner-fallback';
      }
      
      // Ensure we're registering as pet_owner or clinic only
      const sanitizedUserData = {
        ...userData,
        userType: userData.userType === 'admin' ? 'pet_owner' : userData.userType,
      };
      
      console.log("Using endpoint:", endpoint);
      console.log("Registration data being sent:", {
        email: sanitizedUserData.email,
        fullName: sanitizedUserData.fullName,
        userType: sanitizedUserData.userType,
        contactNumber: sanitizedUserData.contactNumber,
        address: sanitizedUserData.address
      });
      
      // Create a timeout promise that rejects after 15 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Registration request timed out')), 15000);
      });
      
      // For form data with file uploads
      let formData;
      let requestPromise;
      
      if (userData.profilePicture || userData.businessPermit || userData.identificationCard) {
        // Create form data for file uploads
        formData = new FormData();
        
        // Debug log
        console.log("Creating FormData for registration with files");
        
        // Add all non-file fields
        Object.keys(sanitizedUserData).forEach(key => {
          if (key !== 'profilePicture' && key !== 'businessPermit' && key !== 'identificationCard') {
            console.log(`Adding form field: ${key} = ${sanitizedUserData[key]}`);
            formData.append(key, sanitizedUserData[key]);
          }
        });
        
        // Add file fields if they exist
        if (userData.profilePicture) {
          console.log("Adding profile picture to FormData");
          formData.append('profilePicture', userData.profilePicture);
        }
        
        if (userData.businessPermit) {
          console.log("Adding business permit to FormData");
          formData.append('businessPermit', userData.businessPermit);
        }
        
        if (userData.identificationCard) {
          console.log("Adding ID card to FormData");
          formData.append('identificationCard', userData.identificationCard);
        }
        
        console.log("FormData created, posting to endpoint:", endpoint);
        
        // Make request with form data - Important: don't set Content-Type manually for FormData
        requestPromise = api.post(endpoint, formData, {
          headers: {
            "Accept": "application/json",
          },
          transformRequest: (data, headers) => {
            // Remove Content-Type header - axios will set it with correct boundary
            delete headers['Content-Type']; 
            return data;
          },
        });
      } else {
        // Standard JSON request
        console.log("Sending JSON request with data:", sanitizedUserData);
        requestPromise = api.post(endpoint, sanitizedUserData);
      }
      
      // Race the request against the timeout
      const response = await Promise.race([requestPromise, timeoutPromise]);
      
      const { token, refreshToken, user } = response.data;
      
      // Ensure consistent user type and ID field
      const processedUser = {
        ...user,
        // Ensure we have an id field (frontend uses id, backend uses _id)
        id: user._id || user.id,
        userType: user.userType === 'admin' ? 'pet_owner' : user.userType || 'pet_owner',
        // Preserve address and contactNumber
        address: user.address || '',
        contactNumber: user.contactNumber || '',
      };
      
      console.log("Registration successful, user data:", {
        id: processedUser.id,
        email: processedUser.email,
        userType: processedUser.userType,
        address: processedUser.address,
        contactNumber: processedUser.contactNumber
      });
      
      await saveAuthData(token, processedUser, refreshToken);
      return processedUser;
    } catch (error) {
      console.error("Registration error details:", error);
      
      // Check if this is a network error
      if (error.message === 'Network Error' || error.message.includes('timeout')) {
        // Try to connect to the server directly
        try {
          console.log("Trying direct connection to server...");
          await tryFallbackUrls();
        } catch (fallbackError) {
          console.error("Fallback connection failed:", fallbackError);
        }
      }
      
      throw error.response?.data || error.message;
    }
  },
  
  logout: async () => {
    await clearAuthData();
  },
  
  getCurrentUser: () => {
    if (_user) {
      // Ensure user is never admin in mobile app
      return {
        ..._user,
        userType: _user.userType === 'admin' ? 'pet_owner' : _user.userType || 'pet_owner',
      };
    }
    return null;
  },
  
  isAuthenticated: () => !!_user,
  
  getUserType: () => {
    if (!_user) return null;
    // Convert admin to pet_owner for consistency
    return _user.userType === 'admin' ? 'pet_owner' : _user.userType;
  },
  
  addAuthListener: (listener) => {
    _authListeners.push(listener);
    return () => {
      _authListeners = _authListeners.filter(l => l !== listener);
    };
  },
  
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  getClinicsByPetType: async (petType) => {
    try {
      const response = await api.get(`/users/clinics/by-pet/${petType}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  updateProfile: async (userData) => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      // Normalize fields - convert phone to contactNumber if needed
      if (userData.phone && !userData.contactNumber) {
        userData.contactNumber = userData.phone;
        delete userData.phone;
      }

      // Handle empty fields
      if (userData.contactNumber === '' || userData.contactNumber === '+63') {
        delete userData.contactNumber;
      }
      
      if (userData.address === '') {
        delete userData.address;
      }

      if (userData.landline === '') {
        delete userData.landline;
      }

      let response;
      if (userData.profilePicture && userData.profilePicture.uri) {
        const formData = new FormData();
        Object.keys(userData).forEach(key => {
          if (key !== 'profilePicture') {
            formData.append(key, userData[key]);
          }
        });
        formData.append('profilePicture', {
          uri: userData.profilePicture.uri,
          type: userData.profilePicture.type || 'image/jpeg',
          name: userData.profilePicture.name || 'profile-image.jpg'
        });

        response = await api.put(`/users/${_user.id}`, formData, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000,
        });
      } else {
        response = await api.put(`/users/${_user.id}`, userData, { timeout: 15000 });
      }

      const updatedUser = response.data;
      
      // Create a merged user with preserved fields
      const mergedUser = {
        ..._user,
        ...updatedUser,
        // Preserve address and contactNumber if they exist
        address: updatedUser.address || _user.address,
        contactNumber: updatedUser.contactNumber || _user.contactNumber
      };
      
      await saveAuthData(_token, mergedUser);
      return mergedUser;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  // Complete onboarding for a user
  completeOnboarding: async (userData) => {
    try {
      // Ensure we have authentication
      if (!_user?.id) {
        console.log("No user ID found in memory, checking secure storage...");
        // Try to retrieve from storage
        const storedUserData = await SecureStore.getItemAsync(USER_DATA_KEY);
        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        
        if (!storedUserData || !storedToken) {
          console.error("Authentication data not found in storage");
          throw new Error('Not authenticated');
        }
        
        try {
          // Restore auth state from storage
          const parsedUser = JSON.parse(storedUserData);
          
          // Ensure we have an id field
          if (parsedUser && parsedUser._id && !parsedUser.id) {
            parsedUser.id = parsedUser._id.toString();
            console.log("Fixed missing id field from storage:", parsedUser.id);
            
            // Save the fixed user data back to storage
            await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(parsedUser));
          }
          
          _user = parsedUser;
          _token = storedToken;
          
          if (!_user?.id) {
            console.error("User ID still not available after restore");
            throw new Error('Invalid user data');
          }
          
          console.log("Auth state restored from storage, user ID:", _user.id);
        } catch (parseError) {
          console.error("Error parsing stored user data:", parseError);
          throw new Error('Invalid user data format');
        }
      }
      
      console.log("Completing onboarding for user:", _user.id);
      console.log("Current auth token:", _token ? "Present" : "Missing");
      
      // Normalize fields - convert phone to contactNumber if needed
      if (userData.phone && !userData.contactNumber) {
        userData.contactNumber = userData.phone;
        delete userData.phone;
      }

      // Handle empty fields
      if (userData.contactNumber === '' || userData.contactNumber === '+63') {
        delete userData.contactNumber;
      }
      
      if (userData.address === '') {
        delete userData.address;
      }
      
      // Update the user data locally first (optimistic update)
      const updatedLocalUser = {
        ..._user,
        ...userData,
        needsOnboarding: false,
        completedOnboarding: true,
        // Preserve existing fields if they're not in the update
        address: userData.address || _user.address,
        contactNumber: userData.contactNumber || _user.contactNumber
      };
      
      // Save the local update immediately so user can continue even if API fails
      await saveAuthData(_token, updatedLocalUser);
      
      try {
        // Mark onboarding as completed in the user data
        userData.needsOnboarding = false;
        userData.completedOnboarding = true;
        
        // Use FormData if there are file uploads
        let formData;
        let response;
        
        if (userData.profilePicture) {
          console.log("Preparing FormData with profile picture");
          // Create form data for file uploads
          formData = new FormData();
          
          // Add all non-file fields
          Object.keys(userData).forEach(key => {
            if (key !== 'profilePicture') {
              formData.append(key, userData[key]);
            }
          });
          
          // Add profile picture if it exists
          formData.append('profilePicture', userData.profilePicture);
          
          // Make request with form data with timeout
          response = await api.put(`/users/${_user.id}/complete-onboarding`, formData, {
            headers: {
              "Accept": "application/json",
              "Content-Type": "multipart/form-data",
              "x-auth-token": _token
            },
            timeout: 30000
          });
        } else {
          console.log("Making standard JSON request");
          // Standard JSON request if no files
          response = await api.put(`/users/${_user.id}/complete-onboarding`, userData, {
            headers: {
              "x-auth-token": _token // Explicitly include token
            },
            timeout: 10000 // 10 second timeout
          });
        }
        
        console.log("Onboarding completion response:", response.status);
        const updatedUser = response.data;
        
        // Merge with existing data
        const mergedUser = {
          ..._user,
          ...updatedUser,
          needsOnboarding: false,
          completedOnboarding: true,
          // Preserve address and contactNumber
          address: updatedUser.address || _user.address,
          contactNumber: updatedUser.contactNumber || _user.contactNumber
        };
        
        // Update stored user data with server response
        await saveAuthData(_token, mergedUser);
        
        // Successful server sync – ensure any previously stored unsynced payload is cleared
        try {
          await SecureStore.deleteItemAsync('peteat_unsynced_onboarding');
        } catch {}

        return mergedUser;
      } catch (apiError) {
        console.error("API error during onboarding completion:", apiError);
        
        // Persist the unsynced payload so we can retry later
        try {
          await SecureStore.setItemAsync('peteat_unsynced_onboarding', JSON.stringify(userData));
          console.log('Saved unsynced onboarding payload for later retry');
        } catch (e) {
          console.warn('Failed to cache unsynced onboarding data:', e);
        }

        // Return the locally updated user data so the app can continue
        console.log("Returning locally updated user data instead");
        return updatedLocalUser;
      }
    } catch (error) {
      console.error("Complete onboarding error details:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      throw error.response?.data || error.message;
    }
  },
  
  initialize: initializeAuth,

  // Expose manual trigger for syncing any pending onboarding data
  syncPendingOnboarding: async () => {
    const pending = await SecureStore.getItemAsync('peteat_unsynced_onboarding');
    if (!pending) return; // nothing to do
    try {
      const parsed = JSON.parse(pending);
      console.log('Attempting to sync pending onboarding payload');
      await authAPI.completeOnboarding(parsed);
      // If we reach here – success, clear the pending record
      await SecureStore.deleteItemAsync('peteat_unsynced_onboarding');
      console.log('Pending onboarding sync succeeded');
    } catch (err) {
      console.warn('Pending onboarding sync failed:', err?.message || err);
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      console.log('Calling change-password endpoint');
      let tokenToUse = _token;
      if (!tokenToUse) {
        try {
          tokenToUse = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        } catch (e) {
          console.log('Unable to fetch token from secure store:', e?.message);
        }
      }
      const response = await api.put(
        '/users/change-password',
        { currentPassword, newPassword },
        { headers: tokenToUse ? { 'x-auth-token': tokenToUse } : undefined }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Pet APIs
export const petAPI = {
  getBaseUrl: () => {
    return api.defaults.baseURL;
  },
  
  uploadImage: async (imageUri) => {
    try {
      if (!imageUri) {
        throw new Error('No image URI provided');
      }
      
      console.log('Uploading image:', imageUri);
      
      // Create form data for the image
      const formData = new FormData();
      // Using any type to bypass type checking for React Native's FormData
      const fileObject = {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      };
      formData.append('image', fileObject);
      
      // Try multiple possible URLs for the server
      // This addresses the "Network request failed" error
      const possibleUrls = [
        `${api.defaults.baseURL}/pets/upload`,
        'http://10.0.2.2:5000/api/pets/upload',
        'http://localhost:5000/api/pets/upload',
        'http://127.0.0.1:5000/api/pets/upload',
        'http://192.168.1.15:5000/api/pets/upload' // From .env file
      ];
      
      let lastError = null;
      
      // Try each URL in order until one works
      for (const url of possibleUrls) {
        try {
          console.log('Trying upload to:', url);
          
          // Make a direct fetch call to avoid Content-Type header issues
          const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
            },
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.log(`Upload to ${url} failed with status ${response.status}: ${errorText}`);
            continue; // Try next URL
          }
          
          const data = await response.json();
          console.log('Upload succeeded to:', url);
          return data.imageUrl;
        } catch (err) {
          console.log(`Upload to ${url} failed:`, err.message);
          lastError = err;
          // Continue to the next URL
        }
      }
      
      // If we get here, all URLs failed
      throw new Error(`All upload attempts failed: ${lastError?.message}`);
    } catch (error) {
      console.error("Image upload error:", error);
      throw error;
    }
  },
  
  getAllPets: async () => {
    try {
      const response = await api.get('/pets');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  getPetsByOwner: async (ownerId) => {
    try {
      const response = await api.get(`/pets/owner/${ownerId || _user?.id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  getPet: async (petId) => {
    try {
      const response = await api.get(`/pets/${petId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  createPet: async (petData) => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      let response;
      if (petData.profileImage) {
        const formData = new FormData();
        Object.keys(petData).forEach(key => {
          if (key !== 'profileImage') {
            formData.append(key, petData[key]);
          }
        });
        formData.append('owner', _user.id);
        formData.append('profileImage', {
          uri: petData.profileImage,
          type: 'image/jpeg',
          name: 'pet-photo.jpg'
        });
        response = await api.post('/pets', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });
      } else {
        const payload = { owner: _user.id, ...petData };
        response = await api.post('/pets', payload);
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  updatePet: async (petId, petData) => {
    try {
      let response;
      if (petData.profileImage && typeof petData.profileImage === 'string' && 
          (petData.profileImage.startsWith('file') || 
           petData.profileImage.startsWith('content://') || 
           petData.profileImage.includes('/storage/') ||
           !petData.profileImage.startsWith('http'))) {
        const formData = new FormData();
        Object.keys(petData).forEach(key => {
          if (key !== 'profileImage') {
            formData.append(key, petData[key]);
          }
        });
        
        // Create file object based on URI
        formData.append('profileImage', {
          uri: petData.profileImage,
          type: 'image/jpeg',
          name: 'pet-photo.jpg',
        });
        
        // Special handling: delete Content-Type header to let axios set it with correct boundary
        const headers = { };
        
        response = await api.put(`/pets/${petId}`, formData, {
          headers,
          timeout: 30000,
        });
      } else {
        response = await api.put(`/pets/${petId}`, petData);
      }
      return response.data;
    } catch (error) {
      console.error("Pet update error:", error);
      throw error.response?.data || error.message;
    }
  },
  
  addMedicalHistory: async (petId, medicalData) => {
    try {
      const response = await api.post(`/pets/${petId}/medical-history`, medicalData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  deletePet: async (petId) => {
    try {
      const response = await api.delete(`/pets/${petId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Booking APIs
export const bookingAPI = {
  getAllBookings: async () => {
    try {
      const response = await api.get('/bookings');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  getBookingsByPetOwner: async (ownerId) => {
    try {
      const response = await api.get(`/bookings/pet-owner/${ownerId || _user?.id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  getBookingsByClinic: async (clinicId) => {
    try {
      const response = await api.get(`/bookings/clinic/${clinicId || _user?.id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  getBooking: async (bookingId) => {
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  createBooking: async (bookingData) => {
    try {
      // Auto-set petOwner field if not provided
      if (!bookingData.petOwner && _user?.userType === 'pet_owner') {
        bookingData.petOwner = _user.id;
      }
      
      const response = await api.post('/bookings', bookingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  updateBookingStatus: async (bookingId, status) => {
    try {
      const response = await api.put(`/bookings/${bookingId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  updateBooking: async (bookingId, bookingData) => {
    try {
      const response = await api.put(`/bookings/${bookingId}`, bookingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  deleteBooking: async (bookingId) => {
    try {
      const response = await api.delete(`/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Message APIs
export const messageAPI = {
  // Website-compatible methods
  getConversations: async () => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      const response = await api.get('/messages/conversations');
      return response.data?.data || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  startConversation: async (partnerId) => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      // Validate partnerId
      if (!partnerId || partnerId === 'undefined') {
        throw new Error('Valid partner ID is required');
      }
      
      // Determine if current user is clinic or pet owner
      const isClinic = _user.userType === 'clinic';
      const payload = isClinic ? { ownerId: partnerId } : { clinicId: partnerId };
      
      console.log('Starting conversation with payload:', JSON.stringify(payload));
      console.log('Current user:', _user.id, 'userType:', _user.userType);
      
      try {
        // Try the website-compatible method first
        const response = await api.post('/messages/conversations', payload);
        
        if (!response.data?.success) {
          console.error('Conversation creation failed:', response.data);
          throw new Error(response.data?.message || 'Failed to create conversation');
        }
        
        return response.data?.data || {};
      } catch (err) {
        console.log('Falling back to legacy conversation creation');
        
        // If website method fails, try creating a simple message as fallback
        // This will implicitly create a conversation in most cases
        if (!partnerId) {
          throw new Error('Partner ID is required');
        }
        
        await api.post('/messages', {
          sender: _user.id,
          receiver: partnerId,
          content: 'Hello!' // Need non-empty content to satisfy validation
        });
        
        // Return a minimal conversation object
        return { 
          participants: [_user.id, partnerId],
          _id: 'pending' // This will be replaced when messages are loaded
        };
      }
    } catch (error) {
      console.error('Error in startConversation:', error);
      throw error.response?.data || error.message;
    }
  },
  
  getConversationMessages: async (conversationId) => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      const response = await api.get(`/messages/conversations/${conversationId}/messages`);
      return response.data?.data || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  sendConversationMessage: async (conversationId, text) => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      const response = await api.post(`/messages/conversations/${conversationId}/messages`, { text });
      return response.data?.data || {};
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  // Original mobile app methods
  getConversation: async (otherUserId) => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      // Validate IDs
      if (!otherUserId || otherUserId === 'undefined') {
        console.error('Invalid partner ID:', otherUserId);
        throw new Error('Invalid partner ID');
      }
      
      console.log('Getting conversation between', _user.id, 'and', otherUserId);
      
      const response = await api.get(`/messages/conversation?user1=${_user.id}&user2=${otherUserId}`);
      return response.data;
    } catch (error) {
      console.error('Error in getConversation:', error);
      throw error.response?.data || error.message;
    }
  },
  
  getUserConversations: async () => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      const response = await api.get(`/messages/user-conversations/${_user.id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  getUnreadCount: async () => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      const response = await api.get(`/messages/unread-count/${_user.id}`);
      return response.data.count;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  sendMessage: async (receiverId, content, attachments = []) => {
    try {
      if (!_user?.id) throw new Error('Not authenticated');
      
      const messageData = {
        sender: _user.id,
        receiver: receiverId,
        content,
        attachments
      };
      
      const response = await api.post('/messages', messageData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  markMessagesAsRead: async (messageIds) => {
    try {
      const response = await api.put('/messages/mark-read', { messageIds });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  deleteMessage: async (messageId) => {
    try {
      const response = await api.delete(`/messages/${messageId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

// ----------------------------------
// User APIs
// ----------------------------------
export const userAPI = {
  getApprovedClinics: async () => {
    try {
      const response = await api.get('/users/clinics/approved');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // For clinic users: list pet owners that can be messaged
  getPetOwners: async (search = '') => {
    try {
      const response = await api.get('/users/pet-owners/list', { params: { q: search } });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Fetch the current authenticated user's latest profile from backend
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getNearbyClinics: async (lat, lng, distance = 5000) => {
    try {
      const response = await api.get(`/users/clinics/nearby`, { params: { lat, lng, distance } });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Add OTP API functions at the appropriate place in the file

// Add to the export section of the file, near other user authentication functions
export const otpAPI = {
  requestOtp: async (email) => {
    try {
      const response = await api.post('/otp/request', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  verifyOtp: async (email, otp) => {
    try {
      const response = await api.post('/otp/verify', { email, otp });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  resetPasswordWithOtp: async (email, otp, newPassword) => {
    try {
      const response = await api.post('/otp/reset-password', { 
        email, 
        otp, 
        newPassword 
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

// ============================================================
//                Video Consultation API 
// ============================================================
export const videoConsultationAPI = {
  // Get consultations for a pet owner
  getOwnerConsultations: async (ownerId) => {
    try {
      const response = await api.get(`/video-consultations/pet-owner/${ownerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching owner consultations:', error);
      throw error;
    }
  },
  
  // Get consultations for a clinic
  getClinicConsultations: async (clinicId) => {
    try {
      const response = await api.get(`/video-consultations/clinic/${clinicId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching clinic consultations:', error);
      throw error;
    }
  },
  
  // Get single consultation
  getConsultation: async (id) => {
    try {
      const response = await api.get(`/video-consultations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching consultation:', error);
      throw error;
    }
  },
  
  // Create new consultation
  createConsultation: async (consultationData) => {
    try {
      const response = await api.post('/video-consultations', consultationData);
      return response.data;
    } catch (error) {
      console.error('Error creating consultation:', error);
      throw error;
    }
  },
  
  // Update consultation status
  updateStatus: async (id, status) => {
    try {
      const response = await api.patch(`/video-consultations/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Error updating consultation status:', error);
      throw error;
    }
  },
  
  // Update consultation details
  updateConsultation: async (id, updateData) => {
    try {
      const response = await api.patch(`/video-consultations/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating consultation:', error);
      throw error;
    }
  },
  
  // Create a Zoom meeting for a consultation
  createZoomMeeting: async (consultationId) => {
    try {
      const response = await api.post(`/video-consultations/${consultationId}/zoom-meeting`);
      return response.data;
    } catch (error) {
      console.error('Error creating Zoom meeting:', error);
      throw error;
    }
  },
  
  // Update clinical notes
  updateClinicalNotes: async (id, clinicalNotes) => {
    try {
      const response = await api.patch(`/video-consultations/${id}`, { clinicalNotes });
      return response.data;
    } catch (error) {
      console.error('Error updating clinical notes:', error);
      throw error;
    }
  }
};

// ============================================================
//                Inventory Management API
// ============================================================
export const inventoryAPI = {
  // Get all inventory items for a clinic
  getItems: async (clinicId) => {
    try {
      const response = await api.get(`/inventory/clinic/${clinicId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      throw error;
    }
  },
  
  // Get low stock items for a clinic
  getLowStockItems: async (clinicId) => {
    try {
      const response = await api.get(`/inventory/clinic/${clinicId}/low-stock`);
      return response.data;
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      throw error;
    }
  },
  
  // Get items by category for a clinic
  getItemsByCategory: async (clinicId, category) => {
    try {
      const response = await api.get(`/inventory/clinic/${clinicId}/category/${category}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching items by category:', error);
      throw error;
    }
  },
  
  // Get expiring items for a clinic
  getExpiringItems: async (clinicId) => {
    try {
      const response = await api.get(`/inventory/clinic/${clinicId}/expiring`);
      return response.data;
    } catch (error) {
      console.error('Error fetching expiring items:', error);
      throw error;
    }
  },
  
  // Get single inventory item
  getItem: async (id) => {
    try {
      const response = await api.get(`/inventory/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      throw error;
    }
  },
  
  // Create new inventory item
  createItem: async (itemData) => {
    try {
      const response = await api.post('/inventory', itemData);
      return response.data;
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  },
  
  // Update inventory item
  updateItem: async (id, updateData) => {
    try {
      const response = await api.put(`/inventory/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }
  },
  
  // Update inventory item quantity
  updateQuantity: async (id, change, isRestock = false) => {
    try {
      const response = await api.patch(`/inventory/${id}/quantity`, { change, isRestock });
      return response.data;
    } catch (error) {
      console.error('Error updating inventory quantity:', error);
      throw error;
    }
  },
  
  // Delete inventory item
  deleteItem: async (id) => {
    try {
      const response = await api.delete(`/inventory/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  }
};

// ============================================================
//                     NFC Tag API
// ============================================================
export const nfcTagAPI = {
  // Get NFC tags by pet owner
  getOwnerTags: async (ownerId) => {
    try {
      const response = await api.get(`/nfc-tags/owner/${ownerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching owner NFC tags:', error);
      throw error;
    }
  },
  
  // Get lost pets
  getLostPets: async () => {
    try {
      const response = await api.get('/nfc-tags/lost-pets');
      return response.data;
    } catch (error) {
      console.error('Error fetching lost pets:', error);
      throw error;
    }
  },
  
  // Get single NFC tag
  getTag: async (id) => {
    try {
      const response = await api.get(`/nfc-tags/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching NFC tag:', error);
      throw error;
    }
  },
  
  // Get tag by NFC ID (for scanning)
  scanTag: async (tagId, coordinates = null) => {
    try {
      let url = `/nfc-tags/tag/${tagId}`;
      
      // Add coordinates if available - handle both null and undefined
      if (coordinates && coordinates.longitude !== undefined && coordinates.latitude !== undefined) {
        url += `?longitude=${coordinates.longitude}&latitude=${coordinates.latitude}`;
      }
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error scanning NFC tag:', error);
      throw error;
    }
  },
  
  // Register new NFC tag
  registerTag: async (tagData) => {
    try {
      const response = await api.post('/nfc-tags', tagData);
      return response.data;
    } catch (error) {
      console.error('Error registering NFC tag:', error);
      throw error;
    }
  },
  
  // Report lost pet
  reportLostPet: async (id, lostPetData) => {
    try {
      const response = await api.post(`/nfc-tags/${id}/report-lost`, lostPetData);
      return response.data;
    } catch (error) {
      console.error('Error reporting lost pet:', error);
      throw error;
    }
  },
  
  // Mark pet as found
  markPetFound: async (id) => {
    try {
      const response = await api.post(`/nfc-tags/${id}/mark-found`, {});
      return response.data;
    } catch (error) {
      console.error('Error marking pet as found:', error);
      throw error;
    }
  },
  
  // Update NFC tag
  updateTag: async (id, updateData) => {
    try {
      const response = await api.put(`/nfc-tags/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating NFC tag:', error);
      throw error;
    }
  },
  
  // Delete NFC tag
  deleteTag: async (id) => {
    try {
      const response = await api.delete(`/nfc-tags/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting NFC tag:', error);
      throw error;
    }
  }
};

// ============================================================
//                 Push Token API
// ============================================================
export const pushTokenAPI = {
  register: async (token, platform = null) => {
    try {
      const response = await api.post('/push-tokens', { token, platform });
      return response.data;
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  },
  getMine: async () => {
    try {
      const response = await api.get('/push-tokens');
      return response.data;
    } catch (error) {
      console.error('Error fetching push tokens:', error);
    }
  },
  delete: async (id) => {
    try {
      const response = await api.delete(`/push-tokens/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting push token:', error);
    }
  }
};

// ============================================================
//                 Video Token API
// ============================================================
export const videoTokenAPI = {
  getToken: async (room) => {
    try {
      const res = await api.post('/video-token', { room });
      return res.data.token;
    } catch (err) {
      console.error('Error fetching video token', err);
      throw err;
    }
  },
};

// Initialize auth on import
initializeAuth().catch(console.error);

export const notificationsAPI = {
  getAll: async () => {
    try { const res = await api.get('/notifications'); return res.data; } catch (e) { throw e.response?.data || e.message; }
  },
  markRead: async (id) => { try { const res = await api.patch(`/notifications/${id}/read`); return res.data; } catch (e){ throw e.response?.data || e.message;} },
  getAnnouncements: async () => {
    try { const res = await api.get('/notifications/announcements'); return res.data; } catch(e){ throw e.response?.data || e.message; }
  },
};

// ============================================================
//                 Pet Treatment API
// ============================================================
export const petTreatmentAPI = {
  // Get all treatments for a clinic
  getClinicTreatments: async (clinicId) => {
    try {
      const response = await api.get(`/pet-treatments/clinic/${clinicId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching clinic treatments:', error);
      throw error;
    }
  },
  
  // Get all treatments for a pet owner
  getOwnerTreatments: async (ownerId) => {
    try {
      const response = await api.get(`/pet-treatments/pet-owner/${ownerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching owner treatments:', error);
      throw error;
    }
  },
  
  // Get a single treatment
  getTreatment: async (treatmentId) => {
    try {
      const response = await api.get(`/pet-treatments/${treatmentId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching treatment:', error);
      throw error;
    }
  },
  
  // Create a treatment from a booking
  createFromBooking: async (bookingId, data) => {
    try {
      const response = await api.post(`/pet-treatments/from-booking/${bookingId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating treatment:', error);
      throw error;
    }
  },
  
  // Update treatment status
  updateStatus: async (treatmentId, status) => {
    try {
      const response = await api.patch(`/pet-treatments/${treatmentId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Error updating treatment status:', error);
      throw error;
    }
  },
  
  // Add a note to a treatment
  addNote: async (treatmentId, content) => {
    try {
      const response = await api.post(`/pet-treatments/${treatmentId}/notes`, { content });
      return response.data;
    } catch (error) {
      console.error('Error adding treatment note:', error);
      throw error;
    }
  },
  
  // Discharge a pet
  dischargePet: async (treatmentId, note) => {
    try {
      const response = await api.patch(`/pet-treatments/${treatmentId}/discharge`, { note });
      return response.data;
    } catch (error) {
      console.error('Error discharging pet:', error);
      throw error;
    }
  }
};

// Try to refresh access token using stored refresh token
async function tryRefreshToken() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;
  try {
    const response = await axios.post(`${api.defaults.baseURL.replace(/\/api$/, '')}/auth/refresh`, {
      refreshToken,
    }, { timeout: 10000 });
    const { accessToken, refreshToken: newRefresh } = response.data;
    if (accessToken) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken);
      if (newRefresh) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefresh);
      }
      _token = accessToken;
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error refreshing token:', err?.message || err);
    return false;
  }
}

// -------------------------------
// Pet Treatment APIs
// -------------------------------
export const treatmentAPI = {
  // Owner's view – server deduces owner from auth
  getOwnerTreatments: async () => {
    try {
      const response = await api.get('/pet-treatments/pet-owner/' + _user.id);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Clinic view – pass current clinic id
  getClinicTreatments: async (clinicId) => {
    try {
      const response = await api.get(`/pet-treatments/clinic/${clinicId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateStatus: async (treatmentId, status) => {
    try {
      const response = await api.patch(`/pet-treatments/${treatmentId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  addNote: async (treatmentId, content) => {
    try {
      const response = await api.post(`/pet-treatments/${treatmentId}/notes`, { content });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  dischargePet: async (treatmentId) => {
    try {
      const response = await api.patch(`/pet-treatments/${treatmentId}/discharge`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

export default {
  authAPI,
  petAPI,
  bookingAPI,
  messageAPI,
  userAPI,
  petTreatmentAPI,
}; 