import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

export default function OnboardingLayout() {
  // Debug: log when onboarding layout mounts
  useEffect(() => {
    console.log("Onboarding layout mounted");
    return () => console.log("Onboarding layout unmounted");
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="user-profile" />
        <Stack.Screen name="add-pet" />
        <Stack.Screen name="clinic-profile" />
        <Stack.Screen name="pet-managed" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
} 