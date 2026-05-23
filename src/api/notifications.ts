import { requireOnline } from '../lib/offlineGuard'

// HARDCODED MOCK: backend doesn't expose a notification-preferences
// endpoint yet (no /settings/notifications route). UI ships with a local
// store so the Notifications sheet stays functional; flip this to a
// real call once the backend adds `GET/PUT /settings/notifications`.
// Tracking issue: pending backend follow-up.
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
  return mockDelay({ ...MOCK_PREFS })
}

export const updateNotificationPrefs = async (
  prefs: Partial<NotificationPrefs>
): Promise<NotificationPrefs> => {
  requireOnline()
  MOCK_PREFS = { ...MOCK_PREFS, ...prefs }
  return mockDelay({ ...MOCK_PREFS }, 250)
}
