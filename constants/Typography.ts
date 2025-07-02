import { TextStyle } from 'react-native';

/**
 * Centralised text-style definitions. These mirror the names already referenced
 * across the codebase (e.g. `Typography.nunitoBodyBold`). Feel free to tweak
 * sizes or weights later – the goal here is simply to satisfy module
 * resolution and provide sensible defaults so the app renders text
 * consistently.
 */
export const Typography: Record<string, TextStyle> = {
  // Headings
  nunitoHeading1: { fontSize: 32, fontWeight: '700' },
  nunitoHeading2: { fontSize: 28, fontWeight: '700' },
  nunitoHeading3: { fontSize: 22, fontWeight: '700' },

  // Sub-heading
  nunitoSubheading: { fontSize: 18, fontWeight: '600' },

  // Body
  nunitoBody: { fontSize: 16, fontWeight: '400' },
  nunitoBodyMedium: { fontSize: 16, fontWeight: '500' },
  nunitoBodyBold: { fontSize: 16, fontWeight: '600' },

  // Caption / small text
  nunitoCaption: { fontSize: 14, fontWeight: '400' },
}; 