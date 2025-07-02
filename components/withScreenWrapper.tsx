import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { BackButton } from './ui/BackButton';
import { LoadingDialog } from './ui/LoadingDialog';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

export function ScreenWrapper({
  children,
  hideBackButton = false,
  backgroundColor,
}: ScreenWrapperProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Please wait...');

  const bgColor = backgroundColor || colors.background;

  // Function to expose to wrapped components
  const showLoading = (message = 'Please wait...') => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  // Provide these functions to children
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { showLoading, hideLoading } as any);
    }
    return child;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {!hideBackButton && <BackButton />}
      <View style={styles.content}>{childrenWithProps}</View>
      <LoadingDialog visible={isLoading} message={loadingMessage} />
    </SafeAreaView>
  );
}

/**
 * Higher-order component to wrap screens with the ScreenWrapper
 */
export function withScreenWrapper(
  Component: React.ComponentType<any>,
  options: Omit<ScreenWrapperProps, 'children'> = {}
) {
  return function WrappedComponent(props: any) {
    return (
      <ScreenWrapper {...options}>
        <Component {...props} />
      </ScreenWrapper>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 48, // Space for back button
  },
});
