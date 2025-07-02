import { ColorSchemeName, useColorScheme as _useDeviceColorScheme } from 'react-native';

/**
 * A wrapper around React Native's `useColorScheme` that always returns a non-null
 * value ("light" | "dark"). If the device/user has not selected a preference
 * this hook will fall back to **"light"** so the rest of the app can rely on a
 * concrete string.
 */
export function useColorScheme(): NonNullable<ColorSchemeName> {
  const scheme = _useDeviceColorScheme();
  return scheme ?? 'light';
} 