import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../auth'
import type { ApiUser } from '../../types'
import { bindSessionQueryCache } from '../../lib/sessionQueryCache'

const clearQueryCache = jest.fn()

const user: ApiUser = {
  id: 'u-1',
  name: 'Dr Demo',
  email: 'd@t',
  role: 'dentist',
  account_status: 'active',
}
const tokens = {
  access_token: 'a',
  refresh_token: 'r',
  token_type: 'Bearer' as const,
  expires_in: 900,
  refresh_expires_in: 2592000,
}

describe('useAuthStore', () => {
  beforeEach(() => {
    bindSessionQueryCache(clearQueryCache)
    clearQueryCache.mockReset()
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isSessionPersistent: false,
      isHydrating: true,
    } as any)
    ;(SecureStore.setItemAsync as jest.Mock).mockClear()
    ;(SecureStore.deleteItemAsync as jest.Mock).mockClear()
    ;(SecureStore.getItemAsync as jest.Mock).mockReset()
  })

  afterAll(() => {
    bindSessionQueryCache(null)
  })

  describe('setSession', () => {
    it('stores user + tokens and flags authenticated', () => {
      useAuthStore.getState().setSession(user, tokens)
      const s = useAuthStore.getState()
      expect(s.user).toBe(user)
      expect(s.tokens).toBe(tokens)
      expect(s.isAuthenticated).toBe(true)
      expect(s.isHydrating).toBe(false)
      expect(clearQueryCache).toHaveBeenCalledTimes(1)
    })

    it('persists the session to SecureStore', () => {
      useAuthStore.getState().setSession(user, tokens)
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'identa.session',
        expect.stringContaining('"id":"u-1"')
      )
    })

    it('keeps a non-remembered session in memory only', () => {
      useAuthStore.getState().setSession(user, tokens, false)

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.isSessionPersistent).toBe(false)
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('identa.session')
    })
  })

  describe('setUser', () => {
    it('updates user while preserving existing tokens', () => {
      useAuthStore.getState().setSession(user, tokens)
      const updated: ApiUser = { ...user, name: 'Dr Updated' }
      useAuthStore.getState().setUser(updated)
      const s = useAuthStore.getState()
      expect(s.user?.name).toBe('Dr Updated')
      expect(s.tokens).toBe(tokens)
    })

    it('clears protected queries when the authorization scope changes', () => {
      useAuthStore.getState().setSession({
        ...user,
        role: 'assistant',
        assistant_permissions: ['patients.view'],
      }, tokens)
      clearQueryCache.mockReset()

      useAuthStore.getState().setUser({
        ...user,
        role: 'assistant',
        assistant_permissions: [],
      })

      expect(clearQueryCache).toHaveBeenCalledTimes(1)
    })

    it('keeps query data when only profile fields change', () => {
      useAuthStore.getState().setSession(user, tokens)
      clearQueryCache.mockReset()

      useAuthStore.getState().setUser({ ...user, name: 'Renamed' })

      expect(clearQueryCache).not.toHaveBeenCalled()
    })
  })

  describe('setTokens', () => {
    it('replaces tokens after refresh, keeps user', () => {
      useAuthStore.getState().setSession(user, tokens)
      const newTokens = { ...tokens, access_token: 'new-a' }
      useAuthStore.getState().setTokens(newTokens)
      const s = useAuthStore.getState()
      expect(s.tokens?.access_token).toBe('new-a')
      expect(s.user).toBe(user)
    })

    it('does not persist refreshed tokens for an in-memory session', () => {
      useAuthStore.getState().setSession(user, tokens, false)
      ;(SecureStore.setItemAsync as jest.Mock).mockClear()

      useAuthStore.getState().setTokens({ ...tokens, access_token: 'memory-only' })

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('clears all session state and removes the on-disk blob', () => {
      useAuthStore.getState().setSession(user, tokens)
      useAuthStore.getState().logout()
      const s = useAuthStore.getState()
      expect(s.user).toBeNull()
      expect(s.tokens).toBeNull()
      expect(s.isAuthenticated).toBe(false)
      expect(s.isSessionPersistent).toBe(false)
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('identa.session')
      expect(clearQueryCache).toHaveBeenCalledTimes(2)
    })
  })

  describe('hydrate', () => {
    it('restores user + tokens from a valid persisted blob', async () => {
      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ user, tokens })
      )
      await useAuthStore.getState().hydrate()
      const s = useAuthStore.getState()
      expect(s.user?.id).toBe('u-1')
      expect(s.tokens?.access_token).toBe('a')
      expect(s.isAuthenticated).toBe(true)
      expect(s.isSessionPersistent).toBe(true)
      expect(s.isHydrating).toBe(false)
    })

    it('drops backward-compat blobs that lack tokens (forces re-login)', async () => {
      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(user))
      await useAuthStore.getState().hydrate()
      const s = useAuthStore.getState()
      expect(s.isAuthenticated).toBe(false)
      expect(s.isHydrating).toBe(false)
    })

    it('survives a corrupt blob without throwing', async () => {
      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('{{ not json }}')
      await expect(useAuthStore.getState().hydrate()).resolves.not.toThrow()
      const s = useAuthStore.getState()
      expect(s.isAuthenticated).toBe(false)
      expect(s.isHydrating).toBe(false)
    })

    it('finishes hydration even when SecureStore has nothing', async () => {
      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null)
      await useAuthStore.getState().hydrate()
      expect(useAuthStore.getState().isHydrating).toBe(false)
    })
  })
})
