import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import type { ApiPatient, ApiPatientCategory, ApiListResponse, ApiResponse } from '../types'

// Per-resource mock flag. Flip via `EXPO_PUBLIC_MOCK_PATIENTS=false`
// when wiring the real backend for this slice.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_PATIENTS !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

function mockDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

let MOCK_CATEGORIES: ApiPatientCategory[] = [
  { id: 'cat-1', name: 'Davolanish', color: '#3B82F6', sort_order: 1 },
  { id: 'cat-2', name: 'VIP',         color: '#A855F7', sort_order: 2 },
  { id: 'cat-3', name: 'Bolalar',     color: '#10B981', sort_order: 3 },
  { id: 'cat-4', name: 'Tezda',       color: '#EF4444', sort_order: 4 },
  { id: 'cat-5', name: 'Ortodontiya', color: '#F59E0B', sort_order: 5 },
]

const MOCK_NAMES = [
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
  'Gulnoza Abdurakhmonova',
  'Sherzod Khabibullaev',
  'Malika Rakhimova',
  'Otabek Kuchkarov',
  'Shaxnoza Mamatova',
  'Davron Hamidov',
  'Aziza Kosimova',
  'Farrukh Tursunov',
  'Dilnoza Sobirova',
  'Mansur Karimov',
  'Lola Saidova',
  'Bobur Aliyev',
  'Munisa Toshmatova',
  'Komil Yusupov',
  'Sayyora Karimova',
  'Eldor Rasulov',
  'Nigora Akhmedova',
  'Timur Saidov',
]

const PHONE_PREFIXES = ['90', '91', '93', '94', '97', '99']

function makeMockPatient(i: number, now: Date = new Date()): ApiPatient {
  const name = MOCK_NAMES[i % MOCK_NAMES.length]!
  // Random-ish but stable phone per index
  const prefix = PHONE_PREFIXES[i % PHONE_PREFIXES.length]
  const tail = String((i * 73 + 17) % 9_999_999).padStart(7, '0')
  const phone = `+998${prefix}${tail.slice(0, 3)}${tail.slice(3, 5)}${tail.slice(5)}`

  // Category: rotate through, ~30% have no category
  const categoryIndex = (i * 3) % (MOCK_CATEGORIES.length + 2)
  const categories = categoryIndex < MOCK_CATEGORIES.length ? [MOCK_CATEGORIES[categoryIndex]!] : []

  // last_visit_at: spread across 0–400 days ago, ~15% never visited
  const neverVisited = i % 7 === 0
  const daysAgo = (i * 13 + 3) % 400
  const lastVisitDate = neverVisited ? null : new Date(now.getTime() - daysAgo * 86_400_000)

  // registered: 30–500 days ago
  const registeredDaysAgo = (i * 17 + 30) % 470
  const createdDate = new Date(now.getTime() - registeredDaysAgo * 86_400_000)

  const dob = i % 4 === 0 ? null : new Date(1970 + (i % 45), i % 12, 1 + (i % 27))

  return {
    id: `pt-${i}`,
    patient_id: `P-${String(1000 + i).padStart(4, '0')}`,
    full_name: name,
    phone,
    secondary_phone: i % 5 === 0 ? `+998${PHONE_PREFIXES[(i + 1) % PHONE_PREFIXES.length]}1234567` : undefined,
    date_of_birth: dob ? dob.toISOString().split('T')[0] : undefined,
    gender: i % 2 === 0 ? 'male' : 'female',
    address: i % 3 === 0 ? 'Toshkent shahar' : undefined,
    photo_url: undefined,
    photo_thumbnail_url: undefined,
    photo_scan_status: undefined,
    created_at: createdDate.toISOString(),
    last_visit_at: lastVisitDate ? lastVisitDate.toISOString() : undefined,
    is_archived: false,
    categories,
  }
}

function buildMockPatientList(): ApiPatient[] {
  const now = new Date()
  return Array.from({ length: 30 }, (_, i) => makeMockPatient(i, now))
}

const MOCK_PATIENTS_CACHE: ApiPatient[] | null = null

function getMockPatients(): ApiPatient[] {
  // Stable across calls
  if (MOCK_PATIENTS_CACHE) return MOCK_PATIENTS_CACHE
  return buildMockPatientList()
}

interface ListParams {
  search?: string
  page?: number
  per_page?: number
  category_id?: string
  archived?: boolean
}

export const listPatients = async (params?: ListParams): Promise<ApiListResponse<ApiPatient>> => {
  if (USE_MOCK) {
    const all = getMockPatients()
    let filtered = all

    if (params?.archived) {
      filtered = filtered.filter((p) => p.is_archived)
    } else {
      filtered = filtered.filter((p) => !p.is_archived)
    }

    if (params?.category_id && params.category_id !== 'all') {
      filtered = filtered.filter((p) =>
        p.categories?.some((c) => c.id === params.category_id)
      )
    }

    if (params?.search) {
      const q = params.search.toLowerCase().trim()
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          (p.phone?.toLowerCase().includes(q) ?? false)
      )
    }

    const perPage = params?.per_page ?? 10
    const page = params?.page ?? 1
    const start = (page - 1) * perPage
    const data = filtered.slice(start, start + perPage)

    return mockDelay({
      data,
      meta: {
        pagination: {
          current_page: page,
          last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
          per_page: perPage,
          total: filtered.length,
        },
      },
    })
  }

  // Backend expects Laravel-style nested `filter[*]` query params, not
  // flat field names. Translate the flat shape callers use into the
  // bracketed shape axios serializes correctly out of the box.
  const realParams: Record<string, string | number> = {}
  if (params?.search) realParams['filter[search]'] = params.search
  if (params?.category_id && params.category_id !== 'all') {
    realParams['filter[category_id]'] = params.category_id
  }
  if (params?.archived) realParams['filter[archived_only]'] = 1
  if (params?.page) realParams.page = params.page
  if (params?.per_page) realParams.per_page = params.per_page

  return client
    .get<ApiListResponse<ApiPatient>>('/patients', { params: realParams })
    .then((r) => r.data)
}

export interface ApiPatientOverview {
  total_debt: number
  total_paid: number
  total_balance: number
  appointment_count: number
}

export const getPatient = async (id: string): Promise<ApiPatient> => {
  if (USE_MOCK) {
    const all = getMockPatients()
    const found = all.find((p) => p.id === id)
    if (!found) throw new Error('Patient not found')
    // Enrich with medical mock fields for detail
    return mockDelay(
      {
        ...found,
        allergies: id.endsWith('1') ? 'Penicillin' : id.endsWith('3') ? 'Lateks' : undefined,
        current_medications: id.endsWith('2') ? 'Aspirin 100mg' : undefined,
        medical_history: id.endsWith('4') ? "Yurak kasalligi (2020)" : undefined,
      },
      300
    )
  }
  return client.get<ApiResponse<ApiPatient>>(`/patients/${id}`).then((r) => r.data.data)
}

export const getPatientOverview = async (id: string): Promise<ApiPatientOverview> => {
  if (USE_MOCK) {
    // Deterministic from id
    const seed = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0)
    const debt = ((seed * 37) % 18) * 150_000
    const paid = Math.round(debt * (0.3 + (seed % 5) * 0.1))
    const balance = debt - paid
    return mockDelay(
      {
        total_debt: debt,
        total_paid: paid,
        total_balance: balance,
        appointment_count: 3 + (seed % 8),
      },
      250
    )
  }
  return client
    .get<ApiResponse<ApiPatientOverview>>(`/patients/${id}/overview`)
    .then((r) => r.data.data)
}

export const createPatient = async (payload: Partial<ApiPatient>): Promise<ApiPatient> => {
  requireOnline()
  if (USE_MOCK) {
    if (!payload.full_name?.trim() || !payload.phone?.trim()) {
      throw new Error('Missing required fields')
    }
    const id = `pt-new-${Date.now()}`
    const patient: ApiPatient = {
      id,
      patient_id: `P-${String(2000 + Math.floor(Math.random() * 999)).padStart(4, '0')}`,
      full_name: payload.full_name.trim(),
      phone: payload.phone.trim(),
      secondary_phone: payload.secondary_phone,
      date_of_birth: payload.date_of_birth,
      gender: payload.gender,
      address: payload.address,
      medical_history: payload.medical_history,
      allergies: payload.allergies,
      current_medications: payload.current_medications,
      created_at: new Date().toISOString(),
      is_archived: false,
      categories: payload.categories ?? [],
    }
    return mockDelay(patient, 500)
  }
  return client.post<ApiResponse<ApiPatient>>('/patients', payload).then((r) => r.data.data)
}

export const updatePatient = async (id: string, payload: Partial<ApiPatient>): Promise<ApiPatient> => {
  requireOnline()
  if (USE_MOCK) {
    return mockDelay(
      {
        id,
        patient_id: `P-${id.slice(-4)}`,
        full_name: payload.full_name ?? 'Patient',
        phone: payload.phone ?? '',
        secondary_phone: payload.secondary_phone,
        date_of_birth: payload.date_of_birth,
        gender: payload.gender,
        address: payload.address,
        medical_history: payload.medical_history,
        allergies: payload.allergies,
        current_medications: payload.current_medications,
        is_archived: false,
        categories: payload.categories ?? [],
      },
      500
    )
  }
  return client.put<ApiResponse<ApiPatient>>(`/patients/${id}`, payload).then((r) => r.data.data)
}

export const listCategories = async (): Promise<ApiPatientCategory[]> => {
  if (USE_MOCK) {
    return mockDelay(MOCK_CATEGORIES)
  }
  return client
    .get<ApiListResponse<ApiPatientCategory>>('/patient-categories')
    .then((r) => r.data.data)
}

export const createCategory = async (name: string, color: string): Promise<ApiPatientCategory> => {
  requireOnline()
  if (USE_MOCK) {
    if (!name.trim()) throw new Error('Name required')
    const cat: ApiPatientCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      color,
      sort_order: MOCK_CATEGORIES.length + 1,
    }
    MOCK_CATEGORIES = [...MOCK_CATEGORIES, cat]
    return mockDelay(cat, 400)
  }
  return client
    .post<ApiResponse<ApiPatientCategory>>('/patient-categories', { name, color })
    .then((r) => r.data.data)
}

export const updateCategory = async (id: string, name: string, color: string): Promise<ApiPatientCategory> => {
  requireOnline()
  if (USE_MOCK) {
    MOCK_CATEGORIES = MOCK_CATEGORIES.map((c) =>
      c.id === id ? { ...c, name: name.trim(), color } : c
    )
    const updated = MOCK_CATEGORIES.find((c) => c.id === id)
    if (!updated) throw new Error('Not found')
    return mockDelay(updated, 400)
  }
  return client
    .put<ApiResponse<ApiPatientCategory>>(`/patient-categories/${id}`, { name, color })
    .then((r) => r.data.data)
}

export const deleteCategory = async (id: string): Promise<void> => {
  requireOnline()
  if (USE_MOCK) {
    MOCK_CATEGORIES = MOCK_CATEGORIES.filter((c) => c.id !== id)
    return mockDelay(undefined, 400)
  }
  return client.delete(`/patient-categories/${id}`).then(() => undefined)
}
