/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Brand palette – warm greens on clean white
const primaryGreen = '#4CAF50';
const secondaryGreen = '#8BC34A';
const lightBg = '#FFFFFF';
const lightSection = '#F5F5F5';
const textPrimary = '#333333';
const lightAccent = '#E8F5E9';

export const Colors = {
  light: {
    text: textPrimary,
    background: lightBg,
    section: lightSection,
    tint: primaryGreen,
    icon: primaryGreen,
    tabIconDefault: secondaryGreen,
    tabIconSelected: primaryGreen,
    accent: lightAccent,
    cardBackground: lightBg,
    border: '#DDDDDD',
    shadowColor: 'rgba(0,0,0,0.05)',
    // Legacy keys used in HomeScreen – map to new palette
    babyBlue: secondaryGreen,
    mintGreen: secondaryGreen,
    lavender: secondaryGreen,
    peach: secondaryGreen,
    success: primaryGreen,
    error: '#D32F2F',
    warning: '#F57C00',
  },
  dark: {
    text: '#FFFFFF',
    background: '#121212',
    section: '#1E1E1E',
    tint: primaryGreen,
    icon: primaryGreen,
    tabIconDefault: secondaryGreen,
    tabIconSelected: primaryGreen,
    accent: '#1B5E20',
    cardBackground: '#1E1E1E',
    border: '#333333',
    shadowColor: 'rgba(0,0,0,0.6)',
    babyBlue: secondaryGreen,
    mintGreen: secondaryGreen,
    lavender: secondaryGreen,
    peach: secondaryGreen,
    success: primaryGreen,
    error: '#EF9A9A',
    warning: '#FFB74D',
  },
};
