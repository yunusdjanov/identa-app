// Client-side analytics aggregation — mirrors the web /analytics page.
// The backend has no dedicated analytics endpoint; both web and mobile derive
// KPIs from the same list data (treatments, patients, appointments) + the
// dashboard snapshot, bucketed by a selected date range.
//
// Date handling mirrors web lib/analytics/date-bounds.ts: `YYYY-MM-DD` strings
// are parsed as LOCAL midnight (the backend mixes date-only and full ISO), so
// records on the last day of a range don't slip into the previous bucket for
// viewers in UTC+5.

export type AnalyticsRange = '7d' | '30d' | '180d' | '365d' | 'ytd'

// '90d' is intentionally omitted from the presets (product decision, matches web).
export const ANALYTICS_RANGES: readonly AnalyticsRange[] = ['7d', '30d', '180d', '365d', 'ytd']
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = '180d'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  if (DATE_ONLY_RE.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0, 0)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function withinLocalBounds(
  value: string | null | undefined,
  start: Date,
  end: Date
): boolean {
  const d = parseLocalDate(value)
  if (d === null) return false
  return d >= start && d <= end
}

export function getRangeBounds(range: AnalyticsRange, now: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (range === 'ytd') {
    return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end }
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '180d' ? 180 : 365
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 0, 0, 0, 0)
  return { start, end }
}

export function getPreviousRangeBounds(
  range: AnalyticsRange,
  now: Date = new Date()
): { start: Date; end: Date } {
  const current = getRangeBounds(range, now)
  if (range === 'ytd') {
    const start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { start, end }
  }
  const periodMs = current.end.getTime() - current.start.getTime()
  const end = new Date(current.start.getTime() - 1)
  const start = new Date(end.getTime() - periodMs)
  return { start, end }
}

// (current - previous) / |previous| * 100, or null when there's no baseline
// (previous === 0) so the UI can show "no baseline" instead of a misleading 0%.
export function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function outstandingBalance(t: { debt_amount?: number | null; paid_amount?: number | null }): number {
  return Math.max(0, Number(t.debt_amount ?? 0) - Number(t.paid_amount ?? 0))
}

interface TreatmentLike {
  treatment_date?: string | null
  paid_amount?: number | null
  debt_amount?: number | null
  patient_id?: string | null
  patient_name?: string | null
}
interface PatientLike {
  created_at?: string | null
}
interface AppointmentLike {
  appointment_date?: string | null
  status?: string | null
}

export interface KpiValue {
  current: number
  previous: number
  delta: number | null
}

export interface CompletionKpi extends KpiValue {
  counts: { completed: number; total: number }
}

export interface AnalyticsKpis {
  revenue: KpiValue
  debt: { current: number; delta: null }
  patients: KpiValue
  completion: CompletionKpi
}

export interface AnalyticsKpiInput {
  treatments: readonly TreatmentLike[]
  patients: readonly PatientLike[]
  appointments: readonly AppointmentLike[]
  outstandingDebtTotal: number
  range: AnalyticsRange
  now?: Date
}

export function computeAnalyticsKpis(input: AnalyticsKpiInput): AnalyticsKpis {
  const now = input.now ?? new Date()
  const bounds = getRangeBounds(input.range, now)
  const prev = getPreviousRangeBounds(input.range, now)

  // Revenue collected — sum paid_amount on treatments whose date is in range.
  let revCur = 0
  let revPrev = 0
  for (const tr of input.treatments) {
    const paid = Number(tr.paid_amount ?? 0)
    if (!paid) continue
    if (withinLocalBounds(tr.treatment_date, bounds.start, bounds.end)) revCur += paid
    else if (withinLocalBounds(tr.treatment_date, prev.start, prev.end)) revPrev += paid
  }

  // New patients registered in range.
  let patCur = 0
  let patPrev = 0
  for (const p of input.patients) {
    if (withinLocalBounds(p.created_at, bounds.start, bounds.end)) patCur += 1
    else if (withinLocalBounds(p.created_at, prev.start, prev.end)) patPrev += 1
  }

  // Completion rate = completed / appointments already past (future excluded so
  // a dentist booked months ahead isn't shown a misleadingly low rate).
  const cutoff = now.getTime()
  function completion(start: Date, end: Date): { completed: number; total: number; rate: number } {
    let completed = 0
    let total = 0
    for (const apt of input.appointments) {
      if (!withinLocalBounds(apt.appointment_date, start, end)) continue
      const d = parseLocalDate(apt.appointment_date)
      // Treat the appointment as "past" once its day's end has elapsed.
      const dayEnd = d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime() : 0
      if (dayEnd > cutoff) continue
      total += 1
      if (apt.status === 'completed') completed += 1
    }
    return { completed, total, rate: total > 0 ? (completed / total) * 100 : 0 }
  }
  const cCur = completion(bounds.start, bounds.end)
  const cPrev = completion(prev.start, prev.end)

  return {
    revenue: { current: revCur, previous: revPrev, delta: computeDelta(revCur, revPrev) },
    debt: { current: input.outstandingDebtTotal, delta: null },
    patients: { current: patCur, previous: patPrev, delta: computeDelta(patCur, patPrev) },
    completion: {
      current: cCur.rate,
      previous: cPrev.rate,
      delta: cCur.total > 0 && cPrev.total > 0 ? computeDelta(cCur.rate, cPrev.rate) : null,
      counts: { completed: cCur.completed, total: cCur.total },
    },
  }
}

export interface StatusCounts {
  scheduled: number
  completed: number
  cancelled: number
  no_show: number
}

// Appointment status breakdown WITHIN the selected range (matches web donut).
export function computeAppointmentStatusCounts(
  appointments: readonly AppointmentLike[],
  range: AnalyticsRange,
  now: Date = new Date()
): StatusCounts {
  const b = getRangeBounds(range, now)
  const counts: StatusCounts = { scheduled: 0, completed: 0, cancelled: 0, no_show: 0 }
  for (const a of appointments) {
    if (!withinLocalBounds(a.appointment_date, b.start, b.end)) continue
    if (a.status && a.status in counts) {
      counts[a.status as keyof StatusCounts] += 1
    }
  }
  return counts
}

export interface TopDebtor {
  patientId: string
  name: string
  debt: number
}

// Top debtors by outstanding balance, counting only treatments whose date sits
// in the selected range (matches web). Aggregated per patient, desc, capped.
export function computeTopDebtors(
  treatments: readonly TreatmentLike[],
  range: AnalyticsRange,
  now: Date = new Date(),
  limit = 5
): TopDebtor[] {
  const b = getRangeBounds(range, now)
  const grouped: Record<string, { name: string; debt: number }> = {}
  for (const tr of treatments) {
    if (!withinLocalBounds(tr.treatment_date, b.start, b.end)) continue
    const debt = outstandingBalance(tr)
    if (debt <= 0) continue
    const id = tr.patient_id ?? 'unknown'
    const existing = grouped[id] ?? { name: tr.patient_name ?? '—', debt: 0 }
    existing.debt += debt
    grouped[id] = existing
  }
  return Object.entries(grouped)
    .map(([patientId, v]) => ({ patientId, name: v.name, debt: v.debt }))
    .sort((a, b2) => b2.debt - a.debt)
    .slice(0, limit)
}
