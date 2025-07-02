// app/_layout.tsx

import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  useFonts as useNunitoFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold
} from '@expo-google-fonts/nunito';
import {
  useFonts as usePoppinsFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold
} from '@expo-google-fonts/poppins';
import { SplashScreen, Stack, Redirect, router } from 'expo-router'; // Import 'router'
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserRoleProvider, useUserRole } from './contexts/UserRoleContext';

// Import API testing function
import { testServerConnection } from './api/api';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [basicFontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [nunitoLoaded] = useNunitoFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const [poppinsLoaded] = usePoppinsFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const fontsLoaded = basicFontsLoaded && nunitoLoaded && poppinsLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);
  
  // Test server connection on app start
  useEffect(() => {
    const checkServerConnection = async () => {
      try {
        await testServerConnection();
      } catch (error) {
        console.error("Failed to test server connection:", error);
      }
    };
    
    checkServerConnection();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <UserRoleProvider>
          <RootLayoutNav />
        </UserRoleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { setUserRole } = useUserRole();

  // Handle initial redirection using useEffect and router.replace()
  useEffect(() => {
    if (!isLoading) { // Only attempt redirect once authentication state is known
      if (isAuthenticated) {
        // Set user role from auth context - this only happens once on login
        if (user) {
          // Check if this is a new user that needs onboarding
          const needsOnboarding = user.needsOnboarding || false;
          
          // Set user role based on authenticated user type
          if (user.userType === 'clinic') {
            setUserRole('clinic');
            
            // For clinics, go to clinic onboarding flow if needed
            if (needsOnboarding) {
              router.navigate('/(onboarding)/clinic-profile');
              return;
            }
          } else {
            // Default to pet owner role (user)
            setUserRole('user');
            
            // For pet owners, go to user onboarding flow if needed
            if (needsOnboarding) {
              router.navigate('/(onboarding)/user-profile');
              return;
            }
          }
          
          // If user doesn't need onboarding, go to main tabs
          router.navigate('/(tabs)');
        } else {
          // Default to regular user tabs if user object is missing
          router.navigate('/(tabs)');
        }
      } else {
        try {
          // Use navigate instead of replace to avoid navigation errors
          // This is a safer approach when dealing with nested navigation
          router.navigate('/splash');
        } catch (error) {
          console.error("Navigation error:", error);
          // Fallback navigation if the first attempt fails
          setTimeout(() => {
            router.navigate('/');
          }, 100);
        }
      }
    }
  }, [isAuthenticated, isLoading, user]); // Re-run effect when auth state, loading changes, or user changes

  // Show a loading screen or null while authentication state is being determined
  if (isLoading || (!isAuthenticated && router.canGoBack())) {
    // Return null or a splash/loading component while redirecting
    // The `router.canGoBack()` is a small trick to ensure we don't flash content
    // before the redirect has completed, but you might need more robust loading.
    return null;
  }

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/*
          Declare ALL top-level routes that exist in your app's file system.
          These screens represent the different branches of your app's navigation tree.
          The actual navigation is now handled by router.replace() in useEffect.
        */}

        {/* Authentication Flow */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        {/* Onboarding Flow */}
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />

        {/* Main Application Tabs */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Features group (if it's a separate top-level route, not just part of tabs) */}
        <Stack.Screen name="(features)" options={{ headerShown: false }} />

        {/* The +not-found route should always be declared at the top level */}
        <Stack.Screen name="+not-found" options={{ presentation: 'modal' }} />

      </Stack>
      <StatusBar style="auto" />
    </NavigationThemeProvider>
  );
}