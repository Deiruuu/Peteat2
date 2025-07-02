import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../ThemeProvider';

interface Prompt {
  title: string;
  message: string;
  onRetry?: () => void;
}

interface Ctx {
  show: (p: Prompt) => void;
  hide: () => void;
}

const PromptContext = createContext<Ctx>({ show: () => {}, hide: () => {} });

export const useErrorPrompt = () => useContext(PromptContext);

export const ErrorPromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const translateY = useRef(new Animated.Value(300)).current;

  const show = (p: Prompt) => {
    setPrompt(p);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const hide = () => {
    Animated.timing(translateY, {
      toValue: 300,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setPrompt(null));
  };

  return (
    <PromptContext.Provider value={{ show, hide }}>
      {children}
      {prompt && (
        <Animated.View style={[styles.container, { backgroundColor: colors.accent, transform: [{ translateY }] }]}>
          <Text style={[styles.title, { color: colors.text }]}>{prompt.title}</Text>
          <Text style={[styles.message, { color: colors.text }]}>{prompt.message}</Text>
          {prompt.onRetry && (
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.tint }]} onPress={() => { hide(); prompt.onRetry && prompt.onRetry(); }}>
              <Text style={{ color: '#FFF' }}>Try Again</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </PromptContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
  },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  message: { fontSize: 14, marginBottom: 12 },
  retryBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
}); 