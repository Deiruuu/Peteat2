import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BackButtonProps {
  color?: string;
  size?: number;
}

export function BackButton({ color, size = 24 }: BackButtonProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const buttonColor = color || colors.babyBlue;
  
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.back();
    }
  };

  return (
    <TouchableOpacity 
      onPress={handleGoBack}
      style={styles.container}
      activeOpacity={0.7}
    >
      <View style={[styles.buttonWrapper, { backgroundColor: colors.background }]}>
        <Ionicons 
          name="arrow-back-outline" 
          size={size} 
          color={buttonColor} 
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 100,
  },
  buttonWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  }
});
