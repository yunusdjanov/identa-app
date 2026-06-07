import client from './client'
import { requireOnline } from '../lib/offlineGuard'

// The backend route (GET/PUT /settings/notifications) now exists on the
// `feat/mobile-backend-endpoints` branch. Keep USE_MOCK=true until that is
// merged + deployed, then flip to false — the real call path below already
// matches the deployed contract (envelope `{ data: NotificationPrefs }`).
const USE_MOCK = true

function mockDelay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export interface NotificationPrefs {
  push_enabled: boolean
  appointment_reminder: boolean
  new_appointment: boolean
  payment_received: boolean
  daily_summary: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  appointment_reminder: true,
  new_appointment: true,
  payment_received: false,
  daily_summary: false,
}

let MOCK_PREFS: NotificationPrefs = { ...DEFAULT_PREFS }

export const getNotificationPrefs = async (): Promise<NotificationPrefs> => {
  if (USE_MOCK) return mockDelay({ ...MOCK_PREFS })
  return client
    .get<{ data: NotificationPrefs }>('/settings/notifications')
    .then((r) => r.data.data)
}

export const updateNotificationPrefs = async (
  prefs: Partial<NotificationPrefs>
): Promise<NotificationPrefs> => {
  requireOnline()
  if (USE_MOCK) {
    MOCK_PREFS = { ...MOCK_PREFS, ...prefs }
    return mockDelay({ ...MOCK_PREFS }, 250)
  }
  return client
    .put<{ data: NotificationPrefs }>('/settings/notifications', prefs)
    .then((r) => r.data.data)
}
