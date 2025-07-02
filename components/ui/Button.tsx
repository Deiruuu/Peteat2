import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  fullWidth = false,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Calculate background color based on variant and state
  const getBackgroundColor = () => {
    if (disabled) return colors.border;
    
    switch (variant) {
      case 'primary':
        return colors.babyBlue;
      case 'secondary':
        return colors.mintGreen;
      case 'tertiary':
        return colors.peach;
      case 'outline':
        return 'transparent';
      default:
        return colors.babyBlue;
    }
  };
  
  // Calculate text color based on variant and state
  const getTextColor = () => {
    if (disabled) return colorScheme === 'dark' ? colors.icon : '#A5B1C2';
    
    switch (variant) {
      case 'outline':
        return colorScheme === 'dark' ? colors.babyBlue : colors.babyBlue;
      default:
        return colorScheme === 'dark' ? '#292F36' : '#FFFFFF';
    }
  };
  
  // Calculate border properties
  const getBorderStyle = () => {
    if (variant === 'outline') {
      return {
        borderWidth: 2,
        borderColor: disabled ? colors.border : colors.babyBlue,
      };
    }
    return {};
  };
  
  // Calculate button size styles
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'large':
        return styles.largeButton;
      case 'medium':
      default:
        return styles.mediumButton;
    }
  };
  
  // Calculate text size styles
  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return Typography.nunitoCaption;
      case 'large':
        return Typography.nunitoBodyBold;
      case 'medium':
      default:
        return Typography.nunitoBodyMedium;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        getSizeStyle(),
        getBorderStyle(),
        { backgroundColor: getBackgroundColor() },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentContainer}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text
            style={[
              getTextSizeStyle(),
              { color: getTextColor() },
              styles.text,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  text: {
    textAlign: 'center',
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
  },
  mediumButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 120,
  },
  largeButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 160,
  },
  fullWidth: {
    width: '100%',
  },
});