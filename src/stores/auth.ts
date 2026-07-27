import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { ApiUser } from '../types'
import { setSentryUser } from '../lib/sentry'
import { clearProtectedPatientPhotoCache } from '../lib/protectedPatientPhoto'
import { clearSessionQueryCache } from '../lib/sessionQueryCache'

const STORAGE_KEY = 'identa.session'

// Tokens issued by the Laravel mobile login endpoint. See AuthController
// in the backend repo — access + refresh come from `personal_access_tokens`
// scoped with the `mobile:refresh` ability.
export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  // Seconds until the access token expires. The interceptor refreshes
  // proactively on 401 rather than tracking this clock-side.
  expires_in: number
  refresh_expires_in: number
}

interface PersistedSession {
  user: ApiUser
  tokens: AuthTokens
}

interface AuthState {
  user: ApiUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isSessionPersistent: boolean
  isHydrating: boolean
  setSession: (user: ApiUser, tokens: AuthTokens, persistSession?: boolean) => void
  // Replace user without changing tokens — used after /auth/me refetch or
  // profile updates.
  setUser: (user: ApiUser) => void
  // Replace tokens after a refresh, keeping the existing user.
  setTokens: (tokens: AuthTokens) => void
  logout: () => void
  hydrate: () => Promise<void>
}

// Helper: keep the on-disk copy in sync with state. Failures are
// swallowed because SecureStore is best-effort and the in-memory store
// is still authoritative for the current session.
function persist(session: PersistedSession | null): void {
  if (session === null) {
    SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {})
    return
  }
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session)).catch(() => {})
}

function accessScopeFingerprint(user: ApiUser): string {
  return JSON.stringify({
    id: user.id,
    role: user.role,
    accountStatus: user.account_status,
    ownerId: user.dentist_owner_id ?? null,
    mustChangePassword: Boolean(user.must_change_password),
    permissions: [...(user.assistant_permissions ?? [])].sort(),
    subscriptionStatus: user.subscription?.status ?? null,
    subscriptionAccess: user.subscription?.access_mode ?? null,
    canExport: user.subscription?.can_export ?? null,
  })
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isSessionPersistent: false,
  isHydrating: true,
  setSession: (user, tokens, persistSession = true) => {
    clearSessionQueryCache()
    clearProtectedPatientPhotoCache().catch(() => {})
    persist(persistSession ? { user, tokens } : null)
    // Tag Sentry events with the user id (no name/email — see sentry.ts).
    setSentryUser(user.id)
    set({
      user,
      tokens,
      isAuthenticated: true,
      isSessionPersistent: persistSession,
      isHydrating: false,
    })
  },
  setUser: (user) => {
    const { user: currentUser, tokens, isSessionPersistent } = get()
    if (!currentUser || accessScopeFingerprint(currentUser) !== accessScopeFingerprint(user)) {
      clearSessionQueryCache()
    }
    if (tokens && isSessionPersistent) persist({ user, tokens })
    setSentryUser(user.id)
    set({ user, isAuthenticated: true, isHydrating: false })
  },
  setTokens: (tokens) => {
    const { user, isSessionPersistent } = get()
    if (user && isSessionPersistent) persist({ user, tokens })
    set({ tokens })
  },
  logout: () => {
    clearSessionQueryCache()
    clearProtectedPatientPhotoCache().catch(() => {})
    persist(null)
    // Clear user context so events captured after sign-out don't get
    // mis-attributed to the previous account.
    setSentryUser(null)
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isSessionPersistent: false,
      isHydrating: false,
    })
  },
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession | ApiUser
        // Backward-compat: older builds stored just the ApiUser. If the
        // payload lacks tokens we drop it — without a refresh token we
        // can't talk to the backend, so the user has to log in again.
        if ('tokens' in parsed && parsed.tokens) {
          setSentryUser(parsed.user.id)
          set({
            user: parsed.user,
            tokens: parsed.tokens,
            isAuthenticated: true,
            isSessionPersistent: true,
            isHydrating: false,
          })
          return
        }
      }
    } catch {
      // Corrupt blob — wipe and start fresh.
    }
    set({ isHydrating: false })
  },
}))
