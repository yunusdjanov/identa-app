import { create } from 'zustand'
import type { ColorSchemeName } from 'react-native'

// Dark mode is intentionally paused for the current release. Keep the small
// store contract consumed by screens while every active path resolves to
// light and no appearance listener or persisted preference is loaded.
export const DARK_MODE_ENABLED: boolean = false

export type ThemeMode = 'light' | 'dark' | 'auto'
export type EffectiveScheme = 'light' | 'dark'

interface ThemeState {
  // What the user explicitly chose. 'auto' follows the OS.
  mode: ThemeMode
  // What we actually render with. Always concrete — never 'auto'.
  effective: EffectiveScheme
  isHydrating: boolean
  hydrate: () => Promise<void>
  setMode: (mode: ThemeMode) => Promise<void>
  // Called by the Appearance listener when the OS color scheme changes.
  _syncFromSystem: (system: ColorSchemeName) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  effective: 'light',
  isHydrating: true,
  hydrate: async () => {
    set({ mode: 'light', effective: 'light', isHydrating: false })
  },
  setMode: async (_mode) => {
    set({ mode: 'light', effective: 'light' })
  },
  _syncFromSystem: (_system) => {
    set({ mode: 'light', effective: 'light' })
  },
}))
