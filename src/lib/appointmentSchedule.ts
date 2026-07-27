import type { ApiAppointment } from '../types'

/** Returns true once the appointment's start minute is in the past. */
export function isAppointmentPastSlot(
  appointment: Pick<ApiAppointment, 'appointment_date' | 'start_time'>,
  now = new Date()
): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointment.appointment_date)
  const timeMatch = /^(\d{2}):(\d{2})/.exec(appointment.start_time)
  if (!match || !timeMatch) return false

  const appointmentAt = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0
  )

  return appointmentAt.getTime() < now.getTime()
}
