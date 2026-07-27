import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import { shouldUseMockApi } from '../lib/mockApi'
import type {
  ApiAppointment,
  ApiPatient,
  ApiPatientClinicalPhoto,
  ApiPatientLookup,
  ApiPatientCategory,
  ApiListResponse,
  ApiResponse,
} from '../types'

// Patient records must use the real backend by default. Mock data is opt-in
// so a missing build-time environment variable can never make a clinic see
// fabricated patients.
const USE_MOCK =
  shouldUseMockApi(
    process.env.EXPO_PUBLIC_MOCK_PATIENTS,
    process.env.EXPO_PUBLIC_USE_MOCK_API
  )

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

export interface ListPatientsParams {
  search?: string
  page?: number
  per_page?: number
  sort?: 'created_at' | '-created_at' | 'updated_at' | '-updated_at' | 'full_name' | '-full_name' | 'date_of_birth' | '-date_of_birth'
  category_id?: string
  archived?: boolean
  // YYYY-MM-DD — filter to patients whose last_visit_at is before this date
  // (or who have never visited). Used by the "Inactive" list chip.
  inactive_before?: string
}

const PATIENT_EXPORT_PAGE_SIZE = 100
const MAX_PATIENT_EXPORT_PAGES = 20

export interface LookupPatientsParams {
  search?: string
  id?: string
  page?: number
  per_page?: number
  sort?: 'full_name' | '-updated_at'
}

interface PatientRequestOptions {
  signal?: AbortSignal
}

/**
 * Compact patient lookup used by appointment/payment selectors. This mirrors
 * the web app and avoids loading clinical/profile fields for every keystroke.
 */
export const lookupPatients = async (
  params?: LookupPatientsParams,
  options?: PatientRequestOptions
): Promise<ApiListResponse<ApiPatientLookup>> => {
  if (USE_MOCK) {
    const response = await listPatients({
      search: params?.search,
      page: params?.page,
      per_page: params?.per_page,
      sort: params?.sort ?? 'full_name',
    })
    const filtered = params?.id
      ? response.data.filter((patient) => patient.id === params.id)
      : response.data

    return {
      ...response,
      data: filtered.map((patient) => ({
        id: patient.id,
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        phone: patient.phone,
        secondary_phone: patient.secondary_phone,
        updated_at: patient.updated_at ?? null,
        photo_scan_status: patient.photo_scan_status ?? null,
        photo_thumbnail_url: patient.photo_thumbnail_url ?? null,
        photo_url: patient.photo_url ?? null,
      })),
    }
  }

  const realParams: Record<string, string | number> = {}
  if (params?.search) realParams['filter[search]'] = params.search
  if (params?.id) realParams['filter[id]'] = params.id
  if (params?.sort) realParams.sort = params.sort
  if (params?.page) realParams.page = params.page
  if (params?.per_page) realParams.per_page = params.per_page

  return client
    .get<ApiListResponse<ApiPatientLookup>>('/lookups/patients', {
      params: realParams,
      signal: options?.signal,
    })
    .then((response) => response.data)
}

export const listPatients = async (
  params?: ListPatientsParams,
  options?: PatientRequestOptions
): Promise<ApiListResponse<ApiPatient>> => {
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

    if (params?.inactive_before) {
      // Patient is "inactive" if their last visit is strictly before the
      // cutoff, OR they have no recorded visit at all.
      filtered = filtered.filter((p) => {
        if (!p.last_visit_at) return true
        return p.last_visit_at < params.inactive_before!
      })
    }

    if (params?.sort) {
      const descending = params.sort.startsWith('-')
      const field = params.sort.replace(/^-/, '') as keyof ApiPatient
      filtered = [...filtered].sort((a, b) => {
        const left = String(a[field] ?? '')
        const right = String(b[field] ?? '')
        const result = left.localeCompare(right, 'en', { sensitivity: 'base' })
        return descending ? -result : result
      })
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
  if (params?.inactive_before) realParams['filter[inactive_before]'] = params.inactive_before
  if (params?.sort) realParams.sort = params.sort
  if (params?.page) realParams.page = params.page
  if (params?.per_page) realParams.per_page = params.per_page

  return client
    .get<ApiListResponse<ApiPatient>>('/patients', {
      params: realParams,
      signal: options?.signal,
    })
    .then((r) => r.data)
}

/**
 * Fetches a bounded, complete snapshot for an explicit export action.
 * Patient lists are normally infinite-scrolled; exporting only the pages the
 * user happened to reveal creates incomplete clinical records. The hard page
 * ceiling prevents an accidental unbounded download if a tenant grows beyond
 * the mobile export's safe operating range.
 */
export const listPatientsForExport = async (
  params?: Omit<ListPatientsParams, 'page' | 'per_page'>
): Promise<ApiPatient[]> => {
  const first = await listPatients({
    ...params,
    page: 1,
    per_page: PATIENT_EXPORT_PAGE_SIZE,
  })
  const pagination = first.meta.pagination
  const totalPages = pagination.total_pages ?? pagination.last_page ?? 1

  if (totalPages > MAX_PATIENT_EXPORT_PAGES) {
    throw new Error('Patient export exceeds the safe pagination limit')
  }

  const patients = [...first.data]
  const seen = new Set(patients.map((patient) => patient.id))
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await listPatients({
      ...params,
      page,
      per_page: PATIENT_EXPORT_PAGE_SIZE,
    })
    for (const patient of response.data) {
      if (!seen.has(patient.id)) {
        seen.add(patient.id)
        patients.push(patient)
      }
    }
  }

  return patients
}

export interface ApiPatientOverview {
  total_debt: number
  total_paid: number
  total_balance: number
  totals_by_currency?: Partial<Record<'UZS' | 'USD', {
    total_debt: number
    total_paid: number
    total_balance: number
  }>>
  appointment_count: number
  // Up to 3 upcoming scheduled appointments (oldest first). Backend
  // PatientService::overview emits this subset of fields — no patient_id /
  // patient_name since both are known from the parent context.
  upcoming_appointments?: Pick<
    ApiAppointment,
    'id' | 'appointment_date' | 'start_time' | 'end_time' | 'status' | 'notes'
  >[]
}

export const getPatient = async (
  id: string,
  options?: { rememberRecent?: boolean }
): Promise<ApiPatient> => {
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
  return client
    .get<ApiResponse<ApiPatient>>(`/patients/${id}`, {
      params: options?.rememberRecent ? { remember_recent: 1 } : undefined,
    })
    .then((r) => r.data.data)
}

export interface ApiRecentPatient {
  id: string
  full_name: string
}

export const listRecentPatients = async (): Promise<ApiRecentPatient[]> => {
  if (USE_MOCK) return mockDelay([], 150)
  return client
    .get<ApiResponse<ApiRecentPatient[]>>('/patients/recent')
    .then((response) => response.data.data)
}

export const clearRecentPatients = async (): Promise<void> => {
  requireOnline()
  if (USE_MOCK) return mockDelay(undefined, 150)
  await client.delete('/patients/recent')
}

export const getPatientOverview = async (id: string): Promise<ApiPatientOverview> => {
  if (USE_MOCK) {
    // Deterministic from id
    const seed = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0)
    const debt = ((seed * 37) % 18) * 150_000
    const paid = Math.round(debt * (0.3 + (seed % 5) * 0.1))
    const balance = debt - paid
    // 0–2 mock upcoming appointments so the new "Upcoming" section on the
    // detail screen actually renders something in dev. Deterministic from id.
    const today = new Date()
    const fmtDate = (offsetDays: number): string => {
      const d = new Date(today.getTime() + offsetDays * 86400_000)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const upcomingCount = seed % 3 === 0 ? 0 : (seed % 2 === 0 ? 2 : 1)
    const upcoming = Array.from({ length: upcomingCount }, (_, i) => ({
      id: `apt-mock-${id}-${i}`,
      appointment_date: fmtDate(i === 0 ? 1 : 5),
      start_time: i === 0 ? '10:00' : '14:30',
      end_time: i === 0 ? '10:30' : '15:00',
      status: 'scheduled' as const,
      notes: i === 0 ? 'Konsultatsiya' : 'Plomba qo\'yish',
    }))
    return mockDelay(
      {
        total_debt: debt,
        total_paid: paid,
        total_balance: balance,
        totals_by_currency: {
          UZS: { total_debt: debt, total_paid: paid, total_balance: balance },
          USD: { total_debt: 0, total_paid: 0, total_balance: 0 },
        },
        appointment_count: 3 + (seed % 8),
        upcoming_appointments: upcoming,
      },
      250
    )
  }
  return client
    .get<ApiResponse<ApiPatientOverview>>(`/patients/${id}/overview`)
    .then((r) => r.data.data)
}

// `category_id` (single, nullable) is the write shape the backend expects for
// category assignment — the `categories` array on ApiPatient is read-only.
export interface PatientWritePayload {
  full_name: string
  phone: string
  secondary_phone?: string | null
  date_of_birth?: string | null
  gender?: 'male' | 'female' | null
  address?: string | null
  medical_history?: string | null
  allergies?: string | null
  current_medications?: string | null
  category_id?: string | null
}

export const createPatient = async (
  payload: PatientWritePayload
): Promise<ApiPatient> => {
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
      categories: [],
    }
    return mockDelay(patient, 500)
  }
  return client.post<ApiResponse<ApiPatient>>('/patients', payload).then((r) => r.data.data)
}

export const updatePatient = async (
  id: string,
  payload: PatientWritePayload
): Promise<ApiPatient> => {
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
        categories: [],
      },
      500
    )
  }
  return client.put<ApiResponse<ApiPatient>>(`/patients/${id}`, payload).then((r) => r.data.data)
}

// Archive (soft-delete) a patient — backend `DELETE /patients/{id}`. The
// patient drops out of the default list (which filters archived out) and can
// be restored later. Not a hard delete; use the force endpoint for that.
export const archivePatient = async (id: string): Promise<void> => {
  requireOnline()
  if (USE_MOCK) {
    const all = getMockPatients()
    const found = all.find((p) => p.id === id)
    if (found) found.is_archived = true
    return mockDelay(undefined, 400)
  }
  await client.delete(`/patients/${id}`)
}

// Restore an archived patient — backend `POST /patients/{id}/restore`.
export const restorePatient = async (id: string): Promise<ApiPatient> => {
  requireOnline()
  if (USE_MOCK) {
    const all = getMockPatients()
    const found = all.find((p) => p.id === id)
    if (found) found.is_archived = false
    if (!found) throw new Error('Patient not found')
    return mockDelay({ ...found, is_archived: false }, 400)
  }
  return client
    .post<ApiResponse<ApiPatient>>(`/patients/${id}/restore`)
    .then((r) => r.data.data)
}

// Permanently delete an archived patient — backend `DELETE /patients/{id}/force`.
// Irreversible; only offered for already-archived patients in the UI.
export const forceDeletePatient = async (id: string): Promise<void> => {
  requireOnline()
  if (USE_MOCK) return mockDelay(undefined, 400)
  await client.delete(`/patients/${id}/force`)
}

export interface PatientPhotoAsset {
  uri: string
  mimeType?: string | null
  fileName?: string | null
  fileSize?: number | null
}

// Upload a patient profile photo — backend `POST /patients/{id}/photo`
// (multipart, field `photo`; jpg/jpeg/png/webp, max 5 MB). Returns the updated
// patient. The photo enters `pending` scan status server-side until moderated.
export const uploadPatientPhoto = async (
  id: string,
  asset: PatientPhotoAsset
): Promise<ApiPatient> => {
  requireOnline()
  if (USE_MOCK) {
    const found = getMockPatients().find((p) => p.id === id)
    const base = found ?? makeMockPatient(0)
    return mockDelay({ ...base, id, photo_url: asset.uri, photo_thumbnail_url: asset.uri }, 600)
  }
  const form = new FormData()
  const type = asset.mimeType ?? guessPhotoMime(asset.uri) ?? 'image/jpeg'
  const name = asset.fileName ?? `patient-photo-${Date.now()}.${photoExt(type)}`
  form.append('photo', { uri: asset.uri, name, type } as unknown as Blob)
  const r = await client.post<ApiResponse<ApiPatient>>(`/patients/${id}/photo`, form, {
    headers: {
      // Must be undefined (not the literal string) so the RN XHR adapter sets
      // the multipart boundary itself — see uploadTreatmentImage for the full
      // story.
      'Content-Type': undefined,
    },
    timeout: 60_000,
  })
  return r.data.data
}

export const deletePatientPhoto = async (id: string): Promise<void> => {
  requireOnline()
  if (USE_MOCK) return mockDelay(undefined, 400)
  await client.delete(`/patients/${id}/photo`)
}

const GENERAL_PHOTO_VIEW_TYPE = 'smile'

/** Uploads one of the patient's ten General Photos (multipart field `photo`). */
export const uploadPatientGeneralPhoto = async (
  id: string,
  asset: PatientPhotoAsset
): Promise<ApiPatient> => {
  requireOnline()
  if (USE_MOCK) {
    const found = getMockPatients().find((p) => p.id === id) ?? makeMockPatient(0)
    const current = found.oral_photo_galleries?.smile ?? []
    const photo: ApiPatientClinicalPhoto = {
      id: `general-photo-${Date.now()}`,
      view_type: GENERAL_PHOTO_VIEW_TYPE,
      scan_status: 'approved' as const,
      url: asset.uri,
      thumbnail_url: asset.uri,
      preview_url: asset.uri,
      sort_order: current.length,
    }
    return mockDelay({
      ...found,
      id,
      oral_photo_galleries: {
        ...found.oral_photo_galleries,
        smile: [...current, photo],
      },
    }, 600)
  }

  return postPatientGeneralPhoto(
    `/patients/${id}/oral-photos/${GENERAL_PHOTO_VIEW_TYPE}`,
    asset
  )
}

/** Replaces one General Photo while preserving its gallery position. */
export const replacePatientGeneralPhoto = async (
  id: string,
  photoId: string,
  asset: PatientPhotoAsset
): Promise<ApiPatient> => {
  requireOnline()
  if (USE_MOCK) {
    const found = getMockPatients().find((p) => p.id === id) ?? makeMockPatient(0)
    const current = found.oral_photo_galleries?.smile ?? []
    return mockDelay({
      ...found,
      id,
      oral_photo_galleries: {
        ...found.oral_photo_galleries,
        smile: current.map((photo) => photo.id === photoId
          ? {
              ...photo,
              scan_status: 'approved' as const,
              url: asset.uri,
              thumbnail_url: asset.uri,
              preview_url: asset.uri,
              updated_at: new Date().toISOString(),
            }
          : photo),
      },
    }, 600)
  }

  return postPatientGeneralPhoto(
    `/patients/${id}/oral-photos/${GENERAL_PHOTO_VIEW_TYPE}/${photoId}/replace`,
    asset
  )
}

/** Deletes exactly one General Photo; the backend verifies patient ownership. */
export const deletePatientGeneralPhoto = async (
  id: string,
  photoId: string
): Promise<ApiPatient> => {
  requireOnline()
  if (USE_MOCK) {
    const found = getMockPatients().find((p) => p.id === id) ?? makeMockPatient(0)
    const current = found.oral_photo_galleries?.smile ?? []
    return mockDelay({
      ...found,
      id,
      oral_photo_galleries: {
        ...found.oral_photo_galleries,
        smile: current.filter((photo) => photo.id !== photoId),
      },
    }, 400)
  }

  return client
    .delete<ApiResponse<ApiPatient>>(
      `/patients/${id}/oral-photos/${GENERAL_PHOTO_VIEW_TYPE}/${photoId}`
    )
    .then((r) => r.data.data)
}

function postPatientGeneralPhoto(
  endpoint: string,
  asset: PatientPhotoAsset
): Promise<ApiPatient> {
  const form = new FormData()
  const type = asset.mimeType ?? guessPhotoMime(asset.uri) ?? 'image/jpeg'
  const name = asset.fileName ?? `patient-general-photo-${Date.now()}.${photoExt(type)}`
  form.append('photo', { uri: asset.uri, name, type } as unknown as Blob)
  return client
    .post<ApiResponse<ApiPatient>>(endpoint, form, {
      headers: { 'Content-Type': undefined },
      timeout: 60_000,
    })
    .then((r) => r.data.data)
}

function guessPhotoMime(uri: string): string | null {
  const m = uri.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i)
  if (!m) return null
  const e = m[1]!.toLowerCase()
  return e === 'png' ? 'image/png' : e === 'webp' ? 'image/webp' : 'image/jpeg'
}

function photoExt(mime: string): string {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
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
