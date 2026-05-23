import client from './client'
import { acquireCsrf, clearCsrf, csrfHeaders } from './csrf'
import { DEVICE_NAME } from '../constants'
import type { ApiUser } from '../types'
import type { AuthTokens } from '../stores/auth'

// Per-resource mock flag. `EXPO_PUBLIC_USE_MOCK_API=false` disables ALL
// mocks app-wide; `EXPO_PUBLIC_MOCK_AUTH=false` flips just the auth slice
// while the rest stay mocked. Useful for incremental migration where
// auth lands first and the rest follow.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_AUTH !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

function mockDelay<T>(value: T, ms = 700): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

// Login returns the user merged with tokens — when device_name is sent
// the backend adds the tokens object to the user payload. The shape is
// flattened on the server (UserResource fields + tokens), so we split
// it back out for the auth store.
export interface LoginResult {
  user: ApiUser
  tokens: AuthTokens
}

function mockUser(email: string, name: string): ApiUser {
  return {
    id: 'dev-1',
    name,
    email,
    role: 'dentist',
    account_status: 'active',
    avatar_url: undefined,
    subscription: {
      is_configured: true,
      plan: 'trial',
      status: 'trialing',
      access_mode: 'full',
      days_remaining: 30,
      staff_limit: 3,
      active_staff_count: 1,
      trial_ends_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    },
  }
}

function mockTokens(): AuthTokens {
  return {
    access_token: `mock-access-${Date.now()}`,
    refresh_token: `mock-refresh-${Date.now()}`,
    token_type: 'Bearer',
    expires_in: 15 * 60,
    refresh_expires_in: 30 * 24 * 60 * 60,
  }
}

export const login = async (email: string, password: string): Promise<LoginResult> => {
  if (USE_MOCK) {
    if (password.length < 4) {
      throw new Error('Invalid credentials')
    }
    return mockDelay<LoginResult>({
      user: mockUser(email, email.split('@')[0] || 'Test Doctor'),
      tokens: mockTokens(),
    })
  }
  // `/auth/login` is on the backend's `web` middleware group → needs CSRF.
  // See src/api/csrf.ts for the protocol details.
  const handshake = await acquireCsrf()
  const response = await client.post<{
    data: ApiUser & { tokens: AuthTokens }
  }>(
    '/auth/login',
    {
      email,
      password,
      device_name: DEVICE_NAME,
    },
    { headers: csrfHeaders(handshake) }
  )
  // After login Laravel rotates the session id, so the cached handshake's
  // session cookie is stale. Drop it; the next CSRF-protected call (logout,
  // change-password) will fetch a fresh one.
  clearCsrf()
  // Server returns user fields + tokens flattened. Pull tokens off the
  // user object so the store gets a clean ApiUser.
  const { tokens, ...user } = response.data.data
  return { user: user as ApiUser, tokens }
}

export const logout = async () => {
  if (USE_MOCK) return mockDelay(undefined, 300)
  // `/auth/logout` is also under the `web` middleware so it needs CSRF.
  // Failures here are tolerated — the caller still clears the local store.
  try {
    const handshake = await acquireCsrf()
    await client.post('/auth/logout', undefined, {
      headers: csrfHeaders(handshake),
    })
  } catch {
    // Swallow — local sign-out proceeds regardless.
  } finally {
    clearCsrf()
  }
}

export const getCurrentUser = async (): Promise<ApiUser> => {
  if (USE_MOCK) {
    return mockDelay(mockUser('me@identa.uz', 'Identa User'))
  }
  return client.get<{ data: ApiUser }>('/auth/me').then((r) => r.data.data)
}

interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

// Note: register on the backend does NOT issue mobile tokens by default
// (only login does). So after a successful register the caller must
// explicitly log in to obtain tokens. The mock skips this nuance.
export const register = async (payload: RegisterPayload): Promise<ApiUser> => {
  if (USE_MOCK) {
    if (!payload.email || payload.password.length < 8) {
      throw new Error('Invalid input')
    }
    return mockDelay<ApiUser>(mockUser(payload.email, payload.name))
  }
  // `web` middleware → CSRF required. Same dance as login.
  const handshake = await acquireCsrf()
  const response = await client.post<{ data: ApiUser }>('/auth/register', payload, {
    headers: csrfHeaders(handshake),
  })
  return response.data.data
}

export const requestPasswordReset = async (email: string) => {
  if (USE_MOCK) {
    if (!email) throw new Error('Email required')
    return mockDelay(undefined, 700)
  }
  const handshake = await acquireCsrf()
  return client.post('/auth/forgot-password', { email }, { headers: csrfHeaders(handshake) })
}

export const resetPassword = async (
  token: string,
  email: string,
  password: string,
  password_confirmation: string
) => {
  const handshake = await acquireCsrf()
  return client.post(
    '/auth/reset-password',
    { token, email, password, password_confirmation },
    { headers: csrfHeaders(handshake) }
  )
}

interface ChangePasswordPayload {
  current_password?: string
  new_password: string
  new_password_confirmation: string
}

export const changeCurrentPassword = async (payload: ChangePasswordPayload) => {
  if (USE_MOCK) {
    if (payload.new_password.length < 8) {
      throw new Error('Password too short')
    }
    if (payload.new_password !== payload.new_password_confirmation) {
      throw new Error('Mismatch')
    }
    return mockDelay(undefined, 600)
  }
  // Also `web` middleware. Fresh handshake — the post-login session cookie
  // was cleared on login; cached value (if any) is from this user's session
  // boundary and may already be invalid.
  const handshake = await acquireCsrf(true)
  return client.post('/auth/change-password', payload, {
    headers: csrfHeaders(handshake),
  })
}
