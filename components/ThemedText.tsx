import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export type ThemedTextType =
  | 'title'
  | 'default'
  | 'defaultSemiBold';

interface Props extends TextProps {
  type?: ThemedTextType;
  lightColor?: string;
  darkColor?: string;
}

const typeStyle: Record<ThemedTextType, TextStyle> = {
  title: { fontSize: 24, fontWeight: '700' },
  default: { fontSize: 16, fontWeight: '400' },
  defaultSemiBold: { fontSize: 16, fontWeight: '600' },
};

export const ThemedText: React.FC<Props> = ({
  style,
  children,
  type = 'default',
  lightColor,
  darkColor,
  ...rest
}) => {
  const theme = useColorScheme();
  const color = theme === 'light' ? lightColor ?? Colors.light.text : darkColor ?? Colors.dark.text;
  return <Text {...rest} style={[typeStyle[type], { color }, style]}>{children}</Text>;
}; 