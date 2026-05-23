import { useMemo } from 'react'
import { useThemeStore } from '../stores/theme'
import { colors as lightColors, darkColors } from '../constants/theme'

export type Colors = typeof lightColors

// Returns the active color palette. Subscribes to the theme store so
// components re-render when the user (or OS, in auto mode) switches scheme.
export function useColors(): Colors {
  const effective = useThemeStore((s) => s.effective)
  return effective === 'dark' ? (darkColors as unknown as Colors) : lightColors
}

// Helper for the common StyleSheet pattern. Memoizes the styles object so it
// only recomputes when the palette changes — usage:
//
//   const styles = useThemedStyles(c => ({
//     card: { backgroundColor: c.background, padding: 12 },
//   }))
import { StyleSheet } from 'react-native'

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: Colors) => T
): T {
  const c = useColors()
  return useMemo(() => StyleSheet.create(factory(c)), [c, factory])
}
