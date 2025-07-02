import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { LoadingDialog } from './ui/LoadingDialog';
import { ErrorPromptProvider } from '@/components/ui/ErrorPrompt';

interface ThemeContextType {
  colors: typeof Colors.light;
  isLoading: boolean;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

// Create context with default values
const ThemeContext = createContext<ThemeContextType>({
  colors: Colors.light,
  isLoading: false,
  showLoading: () => {},
  hideLoading: () => {},
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Please wait...');
  const colors = Colors['light'];

  const showLoading = (message = 'Please wait...') => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  // Value to be provided to consumers
  const value: ThemeContextType = {
    colors,
    isLoading,
    showLoading,
    hideLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ErrorPromptProvider>
        {children}
      </ErrorPromptProvider>
      <LoadingDialog visible={isLoading} message={loadingMessage} />
    </ThemeContext.Provider>
  );
}