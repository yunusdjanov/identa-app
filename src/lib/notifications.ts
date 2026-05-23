import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { translations } from '../i18n/translations'
import { DEFAULT_LOCALE, type Locale } from '../constants'
import type { ApiAppointment } from '../types'

// Locale used when building reminder notification copy. The i18n React
// context isn't available here (scheduling can run from non-React code),
// so we read the current locale via a module-level setter the I18nProvider
// pushes into. Default is the app's DEFAULT_LOCALE until the provider
// hydrates and updates it.
let currentLocale: Locale = DEFAULT_LOCALE
export function setNotificationLocale(locale: Locale): void {
  currentLocale = locale
}

function localizedTemplate(key: 'reminderTitle' | 'reminderBody' | 'reminderFallback'): string {
  const dict = (translations[currentLocale] as any) ?? (translations[DEFAULT_LOCALE] as any)
  return dict?.notify?.[key] ?? ''
}

// Foreground behavior: show alert banner + play sound even while the app
// is open. Without this, foreground notifications would be swallowed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

const REMINDER_TAG_PREFIX = 'appt-reminder-'
const REMINDER_LEAD_MINUTES = 30

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Simulators / emulators can't receive push but local schedules still work.
    return true
  }
  const settings = await Notifications.getPermissionsAsync()
  if (settings.granted) return true
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  })
  return result.granted
}

// Fetch the device's Expo push token. Returns null if we can't get one —
// either because the user denied permission, this is a simulator, or the
// project isn't configured with an EAS project ID. The token is what a
// server hands to the Expo Push Service to deliver notifications.
//
// NOTE on Expo Go (Android): starting with SDK 53, expo-notifications no
// longer supports remote push tokens inside Expo Go on Android — calling
// `getExpoPushTokenAsync` throws and the library writes an error to the
// console which the LogBox surfaces as a red toast ("expo-notifications:
// Android Push notifications..."). We skip the call entirely in that
// environment so users don't see the toast every cold start. The token
// will resolve normally in standalone / dev-client builds.
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    // Expo Go on Android — fail silent, no log spam.
    return null
  }
  const granted = await ensureNotificationPermissions()
  if (!granted) return null
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId
    const response = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
    return response.data
  } catch {
    return null
  }
}

// Schedule a local reminder N minutes before the appointment. If the start
// time is already past (or within the lead window), no notification is
// scheduled — the moment has effectively passed.
export async function scheduleAppointmentReminder(
  apt: ApiAppointment,
  options?: { leadMinutes?: number }
): Promise<string | null> {
  const lead = options?.leadMinutes ?? REMINDER_LEAD_MINUTES
  const start = parseAppointmentDate(apt)
  if (!start) return null
  const triggerAt = new Date(start.getTime() - lead * 60_000)
  if (triggerAt.getTime() <= Date.now() + 5_000) return null

  // Cancel any pre-existing reminder for this appointment so we don't
  // stack duplicates after an edit.
  await cancelAppointmentReminder(apt.id)

  return Notifications.scheduleNotificationAsync({
    identifier: `${REMINDER_TAG_PREFIX}${apt.id}`,
    content: {
      title: apt.patient_name ?? localizedTemplate('reminderFallback'),
      body: buildReminderBody(apt, lead),
      data: { appointmentId: apt.id, type: 'appointment-reminder' },
      sound: 'default',
    },
    trigger:
      Platform.OS === 'ios'
        ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt },
  })
}

export async function cancelAppointmentReminder(appointmentId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`${REMINDER_TAG_PREFIX}${appointmentId}`)
}

export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  for (const item of scheduled) {
    if (typeof item.identifier === 'string' && item.identifier.startsWith(REMINDER_TAG_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier)
    }
  }
}

// Re-syncs reminders to match the given list of scheduled appointments.
// Cancels stale ones, schedules new ones. Idempotent — safe to call after
// list refetches.
export async function syncReminders(scheduled: ApiAppointment[]): Promise<void> {
  const existing = await Notifications.getAllScheduledNotificationsAsync()
  const wanted = new Set(
    scheduled
      .filter((a) => a.status === 'scheduled')
      .map((a) => `${REMINDER_TAG_PREFIX}${a.id}`)
  )

  // Cancel any of ours that are no longer wanted.
  for (const item of existing) {
    if (
      typeof item.identifier === 'string' &&
      item.identifier.startsWith(REMINDER_TAG_PREFIX) &&
      !wanted.has(item.identifier)
    ) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier)
    }
  }

  // Schedule any wanted ones not already on the device.
  const existingIds = new Set(
    existing
      .filter((i) => typeof i.identifier === 'string')
      .map((i) => i.identifier!)
  )
  for (const apt of scheduled) {
    if (apt.status !== 'scheduled') continue
    const id = `${REMINDER_TAG_PREFIX}${apt.id}`
    if (existingIds.has(id)) continue
    await scheduleAppointmentReminder(apt).catch(() => {})
  }
}

function parseAppointmentDate(apt: ApiAppointment): Date | null {
  // appointment_date is "YYYY-MM-DD", start_time is "HH:MM".
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(apt.appointment_date)
  if (!m) return null
  const tm = /^(\d{2}):(\d{2})$/.exec(apt.start_time)
  if (!tm) return null
  const d = new Date(
    parseInt(m[1]!, 10),
    parseInt(m[2]!, 10) - 1,
    parseInt(m[3]!, 10),
    parseInt(tm[1]!, 10),
    parseInt(tm[2]!, 10),
    0,
    0
  )
  return Number.isNaN(d.getTime()) ? null : d
}

function buildReminderBody(apt: ApiAppointment, lead: number): string {
  const template = localizedTemplate('reminderBody')
  return template
    .replace('{{time}}', apt.start_time)
    .replace('{{minutes}}', String(lead))
}
