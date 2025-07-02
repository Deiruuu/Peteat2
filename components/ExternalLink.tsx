import React from 'react';
import { Linking, Text, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface Props {
  href: string;
  children: React.ReactNode;
}

/**
 * A very small wrapper that renders its children as a link and opens the
 * supplied URL with React-Native's `Linking` API when pressed. This was missing
 * from the codebase and caused a "Unable to resolve module" bundling error.
 */
export const ExternalLink: React.FC<Props> = ({ href, children }) => {
  const theme = useColorScheme();
  const color = Colors[theme ?? 'light'].tint;

  return (
    <Text style={[styles.link, { color }]} onPress={() => Linking.openURL(href)}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
}); 