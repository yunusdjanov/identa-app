import AsyncStorage from '@react-native-async-storage/async-storage'
import { Appearance } from 'react-native'
import { useThemeStore } from '../theme'

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'auto', effective: 'light', isHydrating: true } as any)
    ;(AsyncStorage.getItem as jest.Mock).mockReset()
    ;(AsyncStorage.setItem as jest.Mock).mockReset()
  })

  describe('hydrate', () => {
    it('restores a stored "dark" mode', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('dark')
      await useThemeStore.getState().hydrate()
      const s = useThemeStore.getState()
      expect(s.mode).toBe('dark')
      expect(s.effective).toBe('dark')
      expect(s.isHydrating).toBe(false)
    })

    it('defaults to "auto" when nothing stored', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
      await useThemeStore.getState().hydrate()
      expect(useThemeStore.getState().mode).toBe('auto')
    })

    it('ignores garbage stored values and falls back to "auto"', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('purple')
      await useThemeStore.getState().hydrate()
      expect(useThemeStore.getState().mode).toBe('auto')
    })

    it('clears isHydrating even if storage throws', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage gone'))
      await useThemeStore.getState().hydrate()
      expect(useThemeStore.getState().isHydrating).toBe(false)
    })
  })

  describe('setMode', () => {
    it('persists and sets effective to mode for "dark"', async () => {
      await useThemeStore.getState().setMode('dark')
      expect(useThemeStore.getState().mode).toBe('dark')
      expect(useThemeStore.getState().effective).toBe('dark')
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@identa/theme_mode', 'dark')
    })

    it('uses system value when mode is "auto"', async () => {
      const spy = jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark')
      await useThemeStore.getState().setMode('auto')
      expect(useThemeStore.getState().effective).toBe('dark')
      spy.mockReturnValue('light')
      await useThemeStore.getState().setMode('auto')
      expect(useThemeStore.getState().effective).toBe('light')
      spy.mockRestore()
    })
  })

  describe('_syncFromSystem', () => {
    it('updates effective when in auto mode', () => {
      useThemeStore.setState({ mode: 'auto' } as any)
      useThemeStore.getState()._syncFromSystem('dark')
      expect(useThemeStore.getState().effective).toBe('dark')
      useThemeStore.getState()._syncFromSystem('light')
      expect(useThemeStore.getState().effective).toBe('light')
    })

    it('does NOT update effective when the user pinned a specific mode', () => {
      useThemeStore.setState({ mode: 'light', effective: 'light' } as any)
      useThemeStore.getState()._syncFromSystem('dark')
      // User chose light — OS going dark must not flip them.
      expect(useThemeStore.getState().effective).toBe('light')
    })
  })
})
