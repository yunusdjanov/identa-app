import AsyncStorage from '@react-native-async-storage/async-storage'
import { useThemeStore } from '../theme'

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'light', effective: 'light', isHydrating: true } as any)
    ;(AsyncStorage.getItem as jest.Mock).mockReset()
    ;(AsyncStorage.setItem as jest.Mock).mockReset()
  })

  describe('hydrate', () => {
    it('forces light mode even when dark was previously stored', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('dark')

      await useThemeStore.getState().hydrate()

      const state = useThemeStore.getState()
      expect(state.mode).toBe('light')
      expect(state.effective).toBe('light')
      expect(state.isHydrating).toBe(false)
      expect(AsyncStorage.getItem).not.toHaveBeenCalled()
    })

    it('finishes hydration without reading stored appearance', async () => {
      await useThemeStore.getState().hydrate()

      expect(useThemeStore.getState().isHydrating).toBe(false)
      expect(AsyncStorage.getItem).not.toHaveBeenCalled()
    })
  })

  describe('setMode', () => {
    it('rejects dark mode while the feature is paused', async () => {
      await useThemeStore.getState().setMode('dark')

      expect(useThemeStore.getState().mode).toBe('light')
      expect(useThemeStore.getState().effective).toBe('light')
      expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('_syncFromSystem', () => {
    it('ignores dark OS appearance while the feature is paused', () => {
      useThemeStore.setState({ mode: 'auto', effective: 'dark' } as any)

      useThemeStore.getState()._syncFromSystem('dark')

      expect(useThemeStore.getState().mode).toBe('light')
      expect(useThemeStore.getState().effective).toBe('light')
    })
  })
})
