import React from 'react';
import { View, ViewProps } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface Props extends ViewProps {
  lightColor?: string;
  darkColor?: string;
}

export const ThemedView: React.FC<Props> = ({
  style,
  lightColor,
  darkColor,
  children,
  ...rest
}) => {
  const theme = useColorScheme();
  const backgroundColor =
    theme === 'light' ? lightColor ?? Colors.light.background : darkColor ?? Colors.dark.background;
  return (
    <View {...rest} style={[{ backgroundColor }, style]}>
      {children}
    </View>
  );
}; 