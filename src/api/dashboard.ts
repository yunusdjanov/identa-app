import client from './client'
import type { DashboardSnapshot, DashboardAppointmentView } from '../types'

// Per-resource override: `EXPO_PUBLIC_MOCK_DASHBOARD=false` flips this
// slice to real backend while keeping global `USE_MOCK_API` for any
// resource that hasn't been migrated yet.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_DASHBOARD !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

function mockDelay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

const MOCK_PATIENTS = [
  'Aziz Karimov',
  'Dilshod Akhmedov',
  'Sevara Yusupova',
  'Rustam Tashkenboev',
  'Madina Saidova',
  'Bekzod Rasulov',
  'Nilufar Karimova',
  'Sardor Ergashev',
  'Iroda Mirzaeva',
  'Jasur Holikov',
]

const MOCK_REASONS = [
  'Tish davolash',
  'Konsultatsiya',
  'Pulpit davolash',
  "Plomba qo'yish",
  'Tish tozalash',
  'Krongina',
  'Tish olib tashlash',
  'Implant',
  'Tish to\'g\'rilash',
  'Ortodontiya',
]

const MOCK_DURATIONS = [30, 45, 60]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function buildMockAppointments(date: string): DashboardAppointmentView[] {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const appointments: DashboardAppointmentView[] = []
  const dayStart = 8 * 60       // 08:00
  const dayEnd = 20 * 60        // 20:00

  // 3 past appointments (completed)
  for (let i = 3; i >= 1; i--) {
    const startMin = nowMinutes - i * 70
    if (startMin < dayStart) continue
    appointments.push(makeAppointment(date, startMin, 'completed', appointments.length))
  }

  // Always produce ~5 upcoming. If "now" is late, generate slots wrapping forward
  // so demo data is never empty (mock-only behavior — real backend returns truth).
  let cursor = Math.max(nowMinutes + 20, dayStart + 30)
  cursor = Math.ceil(cursor / 5) * 5

  for (let i = 0; i < 5; i++) {
    // If we'd overflow the day, wrap into a pseudo-evening slot so user always
    // sees upcoming items in the dev mock.
    if (cursor + 60 > dayEnd) {
      cursor = dayEnd - (5 - i) * 60 + i * 10
      if (cursor < nowMinutes + 20) cursor = nowMinutes + 20
    }
    appointments.push(makeAppointment(date, cursor, 'scheduled', appointments.length))
    cursor += 50 + (i % 2 === 0 ? 10 : 0)
  }

  return appointments
}

function makeAppointment(
  date: string,
  startMinutes: number,
  status: DashboardAppointmentView['status'],
  index: number
): DashboardAppointmentView {
  const h = Math.floor(startMinutes / 60)
  const m = startMinutes % 60
  return {
    id: `mock-${index}`,
    patient_name: MOCK_PATIENTS[index % MOCK_PATIENTS.length],
    appointment_date: date,
    start_time: `${pad(h)}:${pad(m)}`,
    duration_minutes: MOCK_DURATIONS[index % MOCK_DURATIONS.length],
    status,
    reason: MOCK_REASONS[index % MOCK_REASONS.length],
  }
}

export const getDashboardSnapshot = async (date: string): Promise<DashboardSnapshot> => {
  if (USE_MOCK) {
    return mockDelay<DashboardSnapshot>({
      date,
      revenue_this_month: 4_500_000,
      outstanding_debt_total: 890_000,
      today_appointments: buildMockAppointments(date),
    })
  }
  // The backend accepts an optional `date` query (YYYY-MM-DD); default
  // is today on the server. The today_appointments items come back in
  // camelCase (patientName, appointmentDate, startTime, durationMinutes)
  // — we remap to the snake_case shape the rest of the app expects.
  const response = await client.get<{ data: BackendDashboardSnapshot }>(
    '/dashboard/snapshot',
    { params: { date } }
  )
  return mapDashboard(response.data.data)
}

// Backend response shape — used internally to bridge the casing gap.
//
// IMPORTANT: every field the backend ships is camelCase (DashboardService
// returns `revenueThisMonth`, `outstandingDebtTotal`, `todayAppointments`).
// Mobile's UI assumes snake_case throughout, so we remap below.
//
// Earlier versions of this file declared these as snake_case which silently
// made every numeric field `undefined` — the cards then rendered "не число"
// because `formatCurrencyParts(undefined, ...)` → `Math.abs(undefined)` → NaN.
interface BackendDashboardSnapshot {
  date: string
  revenueThisMonth: number | string
  outstandingDebtTotal: number | string
  todayAppointments: Array<{
    id: string
    patientName: string
    appointmentDate: string
    startTime: string
    durationMinutes: number
    status: DashboardAppointmentView['status']
    reason: string | null
  }>
}

// Defensive numeric coercion: Laravel's `(float)` cast usually returns
// JSON numbers, but decimal columns sometimes come back as strings under
// certain serialization paths. `Number(...)` handles both; `|| 0`
// recovers from null / undefined / empty without leaking NaN to the UI.
function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapDashboard(raw: BackendDashboardSnapshot): DashboardSnapshot {
  return {
    date: raw.date,
    revenue_this_month: toNumber(raw.revenueThisMonth),
    outstanding_debt_total: toNumber(raw.outstandingDebtTotal),
    today_appointments: (raw.todayAppointments ?? []).map((apt) => ({
      id: apt.id,
      patient_name: apt.patientName,
      appointment_date: apt.appointmentDate,
      start_time: apt.startTime,
      duration_minutes: apt.durationMinutes,
      status: apt.status,
      reason: apt.reason ?? undefined,
    })),
  }
}
