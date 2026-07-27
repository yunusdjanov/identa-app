import client from './client'
import type {
  DashboardAppointmentView,
  DashboardSnapshot,
  DashboardCurrency,
} from '../types'

export const getDashboardSnapshot = async (date: string): Promise<DashboardSnapshot> => {
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
  workingHoursEnd?: string
  revenueThisMonth: number | string
  outstandingDebtTotal: number | string
  financialsByCurrency?: Partial<
    Record<
      DashboardCurrency,
      { revenueThisMonth: number | string; outstandingDebtTotal: number | string }
    >
  >
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
  const legacyUzs = {
    revenue_this_month: toNumber(raw.revenueThisMonth),
    outstanding_debt_total: toNumber(raw.outstandingDebtTotal),
  }
  const financialsByCurrency = {
    UZS: raw.financialsByCurrency?.UZS
      ? {
          revenue_this_month: toNumber(raw.financialsByCurrency.UZS.revenueThisMonth),
          outstanding_debt_total: toNumber(raw.financialsByCurrency.UZS.outstandingDebtTotal),
        }
      : legacyUzs,
    USD: {
      revenue_this_month: toNumber(raw.financialsByCurrency?.USD?.revenueThisMonth),
      outstanding_debt_total: toNumber(raw.financialsByCurrency?.USD?.outstandingDebtTotal),
    },
  }
  return {
    date: raw.date,
    working_hours_end: raw.workingHoursEnd?.slice(0, 5) || '17:00',
    revenue_this_month: financialsByCurrency.UZS.revenue_this_month,
    outstanding_debt_total: financialsByCurrency.UZS.outstanding_debt_total,
    financials_by_currency: financialsByCurrency,
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
