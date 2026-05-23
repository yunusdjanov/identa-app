import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import type { ApiSession } from '../types'

// HARDCODED MOCK: backend doesn't expose a session activity endpoint
// yet (no /sessions/activity route — only Sanctum's personal_access_tokens
// table). The Settings → Sessions sheet ships with seeded data so the UI
// stays functional. Flip this once backend adds `GET /sessions/activity`
// + `DELETE /sessions/{id}` (Sanctum already supports per-token revoke,
// just needs the listing endpoint).
const USE_MOCK = true

function mockDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

// Plausible-looking mock sessions. Real backend records every login with
// IP-derived geolocation; this seed lets us build and demo the UI before
// the endpoint exists.
function buildMockSessions(): ApiSession[] {
  const now = Date.now()
  return [
    {
      id: 'sess-1',
      device_name: 'iPhone 15 Pro',
      platform: 'ios',
      ip_address: '94.158.51.42',
      city: 'Toshkent',
      country: 'O\'zbekiston',
      last_active_at: new Date(now).toISOString(),
      is_current: true,
    },
    {
      id: 'sess-2',
      device_name: 'Samsung Galaxy S24',
      platform: 'android',
      ip_address: '213.230.69.108',
      city: 'Samarqand',
      country: 'O\'zbekiston',
      last_active_at: new Date(now - 3 * 60 * 60_000).toISOString(),
      is_current: false,
    },
    {
      id: 'sess-3',
      device_name: 'MacBook · Safari',
      platform: 'web',
      ip_address: '94.158.51.42',
      city: 'Toshkent',
      country: 'O\'zbekiston',
      last_active_at: new Date(now - 36 * 60 * 60_000).toISOString(),
      is_current: false,
    },
    {
      id: 'sess-4',
      device_name: 'iPhone 13',
      platform: 'ios',
      ip_address: '213.230.105.7',
      city: 'Buxoro',
      country: 'O\'zbekiston',
      last_active_at: new Date(now - 5 * 24 * 60 * 60_000).toISOString(),
      is_current: false,
    },
  ]
}

let MOCK_SESSIONS = buildMockSessions()

export async function listSessions(): Promise<ApiSession[]> {
  if (USE_MOCK) return mockDelay([...MOCK_SESSIONS])
  return client.get<{ data: ApiSession[] }>('/sessions/activity').then((r) => r.data.data)
}

export async function revokeSession(id: string): Promise<void> {
  requireOnline()
  if (USE_MOCK) {
    MOCK_SESSIONS = MOCK_SESSIONS.filter((s) => s.id !== id)
    return mockDelay(undefined, 300)
  }
  await client.delete(`/sessions/${id}`)
}
