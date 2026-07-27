import { isAppointmentPastSlot } from '../appointmentSchedule'

describe('isAppointmentPastSlot', () => {
  const now = new Date(2026, 6, 15, 14, 30, 0, 0)

  it('detects a start time that has already passed', () => {
    expect(isAppointmentPastSlot({
      appointment_date: '2026-07-15',
      start_time: '14:29',
    }, now)).toBe(true)
  })

  it('keeps the current and future minute editable', () => {
    expect(isAppointmentPastSlot({
      appointment_date: '2026-07-15',
      start_time: '14:30',
    }, now)).toBe(false)
    expect(isAppointmentPastSlot({
      appointment_date: '2026-07-16',
      start_time: '09:00',
    }, now)).toBe(false)
  })

  it('does not invent a past date from malformed API values', () => {
    expect(isAppointmentPastSlot({
      appointment_date: 'invalid',
      start_time: '09:00',
    }, now)).toBe(false)
  })
})
