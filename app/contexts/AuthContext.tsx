import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { authAPI, otpAPI, API_BASE_URL, pushTokenAPI, userAPI } from '../api/api';
import { registerForPushNotificationsAsync } from '../../utils/pushNotifications';

// Define the User type
export type User = {
  id: string;
  email: string;
  fullName: string;
  userType: 'pet_owner' | 'clinic';
  profilePicture?: string;
  phone?: string;
  isVerified?: boolean;
  [key: string]: any; // Allow for additional properties
};

// Define the context type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  loginWithGoogle: (accessToken: string) => Promise<User>;
  register: (userData: any) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (userData: any) => Promise<User>;
  completeOnboarding: (userData: any) => Promise<User>;
  requestOtp: (email: string) => Promise<any>;
  verifyOtp: (email: string, otp: string) => Promise<any>;
  resetPasswordWithOtp: (email: string, otp: string, newPassword: string) => Promise<any>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  authAPI: any; // Add authAPI to the context type
};

// Create context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {
    throw new Error('AuthContext not initialized');
  },
  loginWithGoogle: async () => {
    throw new Error('AuthContext not initialized');
  },
  register: async () => {
    throw new Error('AuthContext not initialized');
  },
  logout: async () => {
    throw new Error('AuthContext not initialized');
  },
  updateProfile: async () => {
    throw new Error('AuthContext not initialized');
  },
  completeOnboarding: async () => {
    throw new Error('AuthContext not initialized');
  },
  requestOtp: async () => {
    throw new Error('AuthContext not initialized');
  },
  verifyOtp: async () => {
    throw new Error('AuthContext not initialized');
  },
  resetPasswordWithOtp: async () => {
    throw new Error('AuthContext not initialized');
  },
  refreshProfile: async () => { throw new Error('AuthContext not initialized'); },
  isAuthenticated: false,
  authAPI: authAPI,
});

// Create provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        const isInitialized = await authAPI.initialize();
        
        if (isInitialized) {
          const currentUser = authAPI.getCurrentUser();
          setUser(currentUser ? normalizeUser(currentUser) : null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
    
    // Set up listener for auth changes
    const removeListener = authAPI.addAuthListener((currentUser: User | null) => {
      setUser(currentUser ? normalizeUser(currentUser) : null);
    });
    
    return () => {
      if (removeListener) removeListener();
    };
  }, []);
  
  // Login function
  const login = async (email: string, password: string, rememberMe = false): Promise<User> => {
    try {
      const loggedInUser = await authAPI.login(email, password, rememberMe);
      
      // Convert admin users to regular pet owners for mobile app
      if (loggedInUser.userType === 'admin') {
        loggedInUser.userType = 'pet_owner';
      }
      
      setUser(normalizeUser(loggedInUser));
      
      // Register push token in background (fail silently)
      (async () => {
        const token = await registerForPushNotificationsAsync();
        if (token) await pushTokenAPI.register(token, Platform.OS as any);
      })();
      
      return loggedInUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  // Login with Google function
  const loginWithGoogle = async (accessToken: string): Promise<User> => {
    try {
      const loggedInUser = await authAPI.loginWithGoogle(accessToken);
      
      // Convert admin users to regular pet owners for mobile app
      if (loggedInUser.userType === 'admin') {
        loggedInUser.userType = 'pet_owner';
      }
      
      setUser(normalizeUser(loggedInUser));
      
      // Register push token in background (fail silently)
      (async () => {
        const token = await registerForPushNotificationsAsync();
        if (token) await pushTokenAPI.register(token, Platform.OS as any);
      })();
      
      return loggedInUser;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };
  
  // Register function
  const register = async (userData: any): Promise<User> => {
    try {
      // Ensure user is registered as pet_owner or clinic only
      if (userData.userType === 'admin') {
        userData.userType = 'pet_owner';
      }
      
      // Add needsOnboarding flag for new users
      userData.needsOnboarding = true;
      
      const newUser = await authAPI.register(userData);
      
      // Make sure the needsOnboarding flag is set on the user object
      const userWithOnboarding = {
        ...newUser,
        needsOnboarding: true
      };
      
      setUser(normalizeUser(userWithOnboarding));
      
      // Register push token in background (fail silently)
      (async () => {
        const token = await registerForPushNotificationsAsync();
        if (token) await pushTokenAPI.register(token, Platform.OS as any);
      })();
      
      // Request OTP for the new user
      await requestOtp(userData.email);
      
      return userWithOnboarding;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };
  
  // OTP request function
  const requestOtp = async (email: string): Promise<any> => {
    try {
      return await otpAPI.requestOtp(email);
    } catch (error) {
      console.error('OTP request error:', error);
      throw error;
    }
  };
  
  // OTP verification function
  const verifyOtp = async (email: string, otp: string): Promise<any> => {
    try {
      const result = await otpAPI.verifyOtp(email, otp);
      
      // If this is the current user, update their verification status
      if (user && user.email === email) {
        setUser({
          ...user,
          isVerified: true
        });
      }
      
      return result;
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
    }
  };
  
  // Reset password with OTP function
  const resetPasswordWithOtp = async (email: string, otp: string, newPassword: string): Promise<any> => {
    try {
      return await otpAPI.resetPasswordWithOtp(email, otp, newPassword);
    } catch (error) {
      console.error('Password reset with OTP error:', error);
      throw error;
    }
  };
  
  // Fetch latest profile from backend and update context
  const refreshProfile = async (): Promise<void> => {
    try {
      const latest = await userAPI.getProfile();
      if (latest) {
        setUser(prev => normalizeUser({ ...(prev || {}), ...(latest as any) }));
      }
    } catch (err) {
      console.warn('Unable to refresh profile:', err?.message || err);
    }
  };
  
  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();
      // Clear user data
      setUser(null);
      // No navigation here - let the component handle navigation
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };
  
  // Update profile function
  const updateProfile = async (userData: any): Promise<User> => {
    try {
      // Ensure user can't become admin through profile update
      if (userData.userType === 'admin') {
        userData.userType = 'pet_owner';
      }
      
      // Handle phone field conversion to contactNumber
      if (userData.phone && !userData.contactNumber) {
        userData.contactNumber = userData.phone;
        delete userData.phone;
      }
      
      // Ensure we explicitly handle the needsOnboarding flag
      // If it's not explicitly set, don't change it
      // If it is explicitly set to false, include it in the update
      const updatedUserData = { ...userData };
      
      // Ensure address and contactNumber are handled properly
      if (updatedUserData.address === '') {
        delete updatedUserData.address; // Remove empty string to prevent overwriting existing value
      }
      
      if (updatedUserData.contactNumber === '' || updatedUserData.contactNumber === '+63') {
        delete updatedUserData.contactNumber;
      }
      
      // Log for debugging
      console.log("Updating profile with data:", updatedUserData);
      
      const updatedUser = await authAPI.updateProfile(updatedUserData);
      
      // Create a new user object with updated fields
      const mergedUser = { 
        ...user, 
        ...updatedUser,
        // If the update explicitly set needsOnboarding to false, ensure it's kept
        needsOnboarding: userData.needsOnboarding === false ? false : (updatedUser.needsOnboarding ?? user?.needsOnboarding),
        // Ensure address and contactNumber are preserved
        address: updatedUser.address || user?.address,
        contactNumber: updatedUser.contactNumber || user?.contactNumber
      };
      
      console.log("Updated user object:", mergedUser);
      
      // Update the user state
      setUser(normalizeUser(mergedUser));
      
      return mergedUser;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };
  
  // Complete onboarding function
  const completeOnboarding = async (userData: any): Promise<User> => {
    try {
      const updatedUser = await authAPI.completeOnboarding(userData);
      setUser(prev => normalizeUser(prev ? { ...prev, ...updatedUser } : updatedUser));
      return updatedUser;
    } catch (error) {
      console.error('Complete onboarding error:', error);
      throw error;
    }
  };
  
  // Context value
  const value: AuthContextType = {
    user,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    completeOnboarding,
    requestOtp,
    verifyOtp,
    resetPasswordWithOtp,
    refreshProfile,
    isAuthenticated: !!user,
    authAPI: authAPI,
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

const normalizeUser = (u: User): User => {
  if (!u) return u;
  if (typeof u.profilePicture === 'string' && u.profilePicture !== '' && !u.profilePicture.startsWith('http')) {
    return { ...u, profilePicture: `${API_BASE_URL}/${u.profilePicture.replace(/^\/+/,'')}` };
  }
  return u;
}; 