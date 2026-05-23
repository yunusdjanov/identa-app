import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import type { ApiAppointment, ApiListResponse, ApiResponse } from '../types'

// Backend POST/PUT body expects `reason` (not `notes`); response uses
// `notes`. Translate one direction without polluting the public API.
function toBackendPayload(payload: Partial<ApiAppointment>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (payload.patient_id !== undefined) out.patient_id = payload.patient_id
  if (payload.appointment_date !== undefined) out.appointment_date = payload.appointment_date
  if (payload.start_time !== undefined) out.start_time = payload.start_time
  if (payload.end_time !== undefined) out.end_time = payload.end_time
  if (payload.status !== undefined) out.status = payload.status
  if (payload.notes !== undefined) out.reason = payload.notes
  return out
}

// Per-resource override. Flip via `EXPO_PUBLIC_MOCK_APPOINTMENTS=false`
// to hit the real `/api/v1/appointments` endpoint while keeping other
// slices on mock.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_APPOINTMENTS !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

function mockDelay<T>(value: T, ms = 400): Promise<T> {
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
  'Zilola Toirova',
  'Akmal Yusupov',
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
]

const STATUS_DIST: ApiAppointment['status'][] = [
  'scheduled',
  'scheduled',
  'scheduled',
  'completed',
  'completed',
  'cancelled',
  'no_show',
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Stable PRNG so the same date always yields the same appointments.
function seededRand(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function buildAppointmentsForDate(d: Date): ApiAppointment[] {
  // Sunday off in this mock
  if (d.getDay() === 0) return []

  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  const rand = seededRand(seed)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const isPast = dayOnly < today
  const isToday = dayOnly.getTime() === today.getTime()

  const count = 6 + Math.floor(rand() * 6) // 6–11 per day
  const dateStr = dateKey(d)
  const result: ApiAppointment[] = []

  let cursor = 8 * 60 // 08:00
  const dayEnd = 20 * 60 // 20:00

  for (let i = 0; i < count; i++) {
    const duration = [30, 30, 45, 60][Math.floor(rand() * 4)]!
    if (cursor + duration > dayEnd) break

    const startH = Math.floor(cursor / 60)
    const startM = cursor % 60
    const endTotal = cursor + duration
    const endH = Math.floor(endTotal / 60)
    const endM = endTotal % 60

    let status: ApiAppointment['status']
    if (isPast) {
      status = rand() > 0.15 ? 'completed' : rand() > 0.5 ? 'cancelled' : 'no_show'
    } else if (isToday) {
      const nowMin = today.getHours() * 60 + today.getMinutes()
      status = endTotal < nowMin ? 'completed' : STATUS_DIST[Math.floor(rand() * STATUS_DIST.length)]!
    } else {
      status = 'scheduled'
    }

    result.push({
      id: `apt-${dateStr}-${i}`,
      patient_id: `pt-${i}`,
      patient_name: MOCK_PATIENTS[Math.floor(rand() * MOCK_PATIENTS.length)]!,
      appointment_date: dateStr,
      start_time: `${pad(startH)}:${pad(startM)}`,
      end_time: `${pad(endH)}:${pad(endM)}`,
      status,
      notes: MOCK_REASONS[Math.floor(rand() * MOCK_REASONS.length)]!,
    })

    cursor = endTotal + 5 + Math.floor(rand() * 20) // 5–25 min gap (tighter schedule)
  }

  return result
}

interface ListParams {
  date?: string  // YYYY-MM-DD
  start_date?: string  // YYYY-MM-DD
  end_date?: string  // YYYY-MM-DD
  status?: string
  page?: number
}

// Mock backend doesn't have a persistent store — appointments are generated
// from a date seed. To simulate persistence we keep a mutation overlay keyed
// by appointment id and merge it into freshly-generated items before
// returning. Real backend keeps server-side rows; this map disappears on
// reload, which mirrors typical demo behavior.
const MUTATION_OVERLAY = new Map<string, Partial<ApiAppointment>>()
const DELETED = new Set<string>()
const CREATED: ApiAppointment[] = []

function applyOverlay(apts: ApiAppointment[]): ApiAppointment[] {
  const filtered = apts.filter((a) => !DELETED.has(a.id))
  return filtered.map((a) => {
    const override = MUTATION_OVERLAY.get(a.id)
    return override ? { ...a, ...override } : a
  })
}

export const listAppointments = async (params?: ListParams): Promise<ApiListResponse<ApiAppointment>> => {
  if (USE_MOCK) {
    let dates: Date[] = []
    if (params?.date) {
      const [y, m, d] = params.date.split('-').map((n) => parseInt(n, 10))
      dates = [new Date(y!, (m ?? 1) - 1, d ?? 1)]
    } else if (params?.start_date && params?.end_date) {
      const [sy, sm, sd] = params.start_date.split('-').map((n) => parseInt(n, 10))
      const [ey, em, ed] = params.end_date.split('-').map((n) => parseInt(n, 10))
      const start = new Date(sy!, (sm ?? 1) - 1, sd ?? 1)
      const end = new Date(ey!, (em ?? 1) - 1, ed ?? 1)
      for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        dates.push(new Date(cur))
      }
    } else {
      // Default: today only
      dates = [new Date()]
    }

    const all: ApiAppointment[] = []
    for (const d of dates) {
      all.push(...buildAppointmentsForDate(d))
    }

    // Merge any in-session created appointments that fall in the queried range.
    const dateKeys = new Set(
      dates.map((d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    )
    for (const c of CREATED) {
      if (dateKeys.has(c.appointment_date)) all.push(c)
    }

    const overlaid = applyOverlay(all)

    const filtered = params?.status
      ? overlaid.filter((a) => a.status === params.status)
      : overlaid

    return mockDelay({
      data: filtered,
      meta: {
        pagination: {
          current_page: 1,
          last_page: 1,
          per_page: filtered.length,
          total: filtered.length,
        },
      },
    })
  }

  // Backend expects Laravel nested filter params: filter[date_from],
  // filter[date_to], filter[patient_id], filter[status]. Map our flat
  // shape to that.
  const realParams: Record<string, string | number> = {}
  if (params?.date) {
    realParams['filter[date_from]'] = params.date
    realParams['filter[date_to]'] = params.date
  }
  if (params?.start_date) realParams['filter[date_from]'] = params.start_date
  if (params?.end_date) realParams['filter[date_to]'] = params.end_date
  if (params?.status) realParams['filter[status]'] = params.status
  if (params?.page) realParams.page = params.page

  return client
    .get<ApiListResponse<ApiAppointment>>('/appointments', { params: realParams })
    .then((r) => r.data)
}

export const createAppointment = async (payload: Partial<ApiAppointment>): Promise<ApiAppointment> => {
  requireOnline()
  if (USE_MOCK) {
    const created: ApiAppointment = {
      id: `apt-new-${Date.now()}`,
      patient_id: payload.patient_id ?? '',
      patient_name: payload.patient_name ?? undefined,
      appointment_date: payload.appointment_date ?? '',
      start_time: payload.start_time ?? '00:00',
      end_time: payload.end_time ?? '00:00',
      status: (payload.status as ApiAppointment['status']) ?? 'scheduled',
      notes: payload.notes ?? null,
    }
    CREATED.push(created)
    return mockDelay(created)
  }
  return client
    .post<ApiResponse<ApiAppointment>>('/appointments', toBackendPayload(payload))
    .then((r) => r.data.data)
}

export const updateAppointment = async (id: string, payload: Partial<ApiAppointment>): Promise<ApiAppointment> => {
  requireOnline()
  if (USE_MOCK) {
    // Persist the patch in the overlay so subsequent list queries return it.
    const existing = MUTATION_OVERLAY.get(id) ?? {}
    const merged = { ...existing, ...payload }
    MUTATION_OVERLAY.set(id, merged)
    // Also patch CREATED entries in place if this is a created appointment.
    const createdIdx = CREATED.findIndex((c) => c.id === id)
    if (createdIdx >= 0) {
      CREATED[createdIdx] = { ...CREATED[createdIdx]!, ...payload }
    }
    return mockDelay({
      id,
      patient_id: payload.patient_id ?? '',
      patient_name: payload.patient_name ?? undefined,
      appointment_date: payload.appointment_date ?? '',
      start_time: payload.start_time ?? '00:00',
      end_time: payload.end_time ?? '00:00',
      status: (payload.status as ApiAppointment['status']) ?? 'scheduled',
      notes: payload.notes ?? null,
    })
  }
  return client
    .put<ApiResponse<ApiAppointment>>(`/appointments/${id}`, toBackendPayload(payload))
    .then((r) => r.data.data)
}

export const deleteAppointment = async (id: string): Promise<void> => {
  requireOnline()
  if (USE_MOCK) {
    DELETED.add(id)
    const createdIdx = CREATED.findIndex((c) => c.id === id)
    if (createdIdx >= 0) CREATED.splice(createdIdx, 1)
    await mockDelay(null, 300)
    return
  }
  await client.delete(`/appointments/${id}`)
}
