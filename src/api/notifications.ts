import { requireOnline } from '../lib/offlineGuard'

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

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
  throw new Error('Real backend not implemented')
}

export const updateNotificationPrefs = async (
  prefs: Partial<NotificationPrefs>
): Promise<NotificationPrefs> => {
  requireOnline()
  if (USE_MOCK) {
    MOCK_PREFS = { ...MOCK_PREFS, ...prefs }
    return mockDelay({ ...MOCK_PREFS }, 250)
  }
  throw new Error('Real backend not implemented')
}
