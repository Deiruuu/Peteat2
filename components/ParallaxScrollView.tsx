import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface Props {
  children: React.ReactNode;
  headerBackgroundColor?: { light: string; dark: string };
  /** React element displayed above the content */
  headerImage?: React.ReactNode;
  /** Height of the header area */
  headerHeight?: number;
}

/**
 * Very lightweight replacement for the Expo template's `ParallaxScrollView`.
 * It DOES NOT implement a real parallax effect; it simply renders an optional
 * header area followed by a ScrollView. This is enough to satisfy imports and
 * keep the template screen functional without crashes.
 */
export default function ParallaxScrollView({
  children,
  headerBackgroundColor = { light: Colors.light.section, dark: Colors.dark.section },
  headerImage,
  headerHeight = 200,
}: Props) {
  const scheme = useColorScheme();
  const backgroundColor = headerBackgroundColor[scheme ?? 'light'];

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <ThemedView style={[styles.header, { backgroundColor, height: headerHeight }]}> 
        {headerImage}
      </ThemedView>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingTop: 16,
  },
}); 