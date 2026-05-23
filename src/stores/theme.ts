import { create } from 'zustand'
import { Appearance, type ColorSchemeName } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@identa/theme_mode'

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

function resolveEffective(mode: ThemeMode, system: ColorSchemeName): EffectiveScheme {
  if (mode === 'auto') return system === 'dark' ? 'dark' : 'light'
  return mode
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'auto',
  effective: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  isHydrating: true,
  hydrate: async () => {
    try {
      const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as ThemeMode | null
      const mode: ThemeMode =
        stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto'
      const system = Appearance.getColorScheme()
      set({ mode, effective: resolveEffective(mode, system), isHydrating: false })
    } catch {
      set({ isHydrating: false })
    }
  },
  setMode: async (mode) => {
    const system = Appearance.getColorScheme()
    set({ mode, effective: resolveEffective(mode, system) })
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Ignore persist errors — user will just see a re-prompt next launch.
    }
  },
  _syncFromSystem: (system) => {
    const { mode } = get()
    if (mode !== 'auto') return
    set({ effective: resolveEffective(mode, system) })
  },
}))

// Subscribe to OS appearance changes so 'auto' mode tracks system changes.
Appearance.addChangeListener(({ colorScheme }) => {
  useThemeStore.getState()._syncFromSystem(colorScheme)
})
