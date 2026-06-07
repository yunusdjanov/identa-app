import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import { recordQuickPayment, type QuickPaymentPayload } from './payments'
import type {
  ApiTreatment,
  ApiTreatmentImage,
  ApiTreatmentPayment,
  ApiListResponse,
  ApiResponse,
} from '../types'

// Per-resource override. Flip via `EXPO_PUBLIC_MOCK_TREATMENTS=false`.
//
// Payments:
//   `recordPayment` now goes through the live "quick payment" endpoint
//   (POST /patients/{id}/quick-payments) — see src/api/payments.ts. The
//   backend synthesizes an Invoice + Payment atomically so the mobile UI
//   doesn't need to model Invoices separately. When `treatment_id` is
//   passed, the backend also mirrors the amount onto the treatment row's
//   paid_amount, so calling-side React Query just needs to invalidate
//   the 'treatments' key to see updated balances.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_TREATMENTS !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

function mockDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

const MOCK_PATIENTS = [
  { id: 'pt-0', name: 'Aziz Karimov' },
  { id: 'pt-1', name: 'Dilshod Akhmedov' },
  { id: 'pt-2', name: 'Sevara Yusupova' },
  { id: 'pt-3', name: 'Rustam Tashkenboev' },
  { id: 'pt-4', name: 'Madina Saidova' },
  { id: 'pt-5', name: 'Bekzod Rasulov' },
  { id: 'pt-6', name: 'Nilufar Karimova' },
  { id: 'pt-7', name: 'Sardor Ergashev' },
  { id: 'pt-8', name: 'Iroda Mirzaeva' },
  { id: 'pt-9', name: 'Jasur Holikov' },
  { id: 'pt-10', name: 'Zilola Toirova' },
  { id: 'pt-11', name: 'Akmal Yusupov' },
]

const MOCK_TREATMENT_TYPES = [
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

const COST_BUCKETS = [150_000, 300_000, 450_000, 600_000, 900_000, 1_200_000, 1_800_000]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function seeded(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function buildMockTreatments(): ApiTreatment[] {
  const now = new Date()
  const result: ApiTreatment[] = []
  let id = 0

  for (const p of MOCK_PATIENTS) {
    const rand = seeded(parseInt(p.id.replace('pt-', ''), 10) + 100)
    const count = 2 + Math.floor(rand() * 5) // 2–6 treatments per patient
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(rand() * 180)
      const date = new Date(now.getTime() - daysAgo * 86400_000)
      const cost = COST_BUCKETS[Math.floor(rand() * COST_BUCKETS.length)]!
      // Most treatments are partially paid, some fully paid, some unpaid
      const paymentBucket = rand()
      const paid_amount =
        paymentBucket < 0.3 ? cost :
        paymentBucket < 0.6 ? Math.round(cost * (0.4 + rand() * 0.5)) :
        paymentBucket < 0.85 ? Math.round(cost * rand() * 0.3) :
        0
      const debt_amount = cost
      const balance = debt_amount - paid_amount

      const toothCount = 1 + Math.floor(rand() * 3)
      const teeth = Array.from({ length: toothCount }, () => 1 + Math.floor(rand() * 32))

      // Split paid amount into 1–3 historical payments, each recorded after
      // the treatment date. Demo data only — gives the history list realism.
      const payments: ApiTreatmentPayment[] = []
      if (paid_amount > 0) {
        const installments = 1 + Math.floor(rand() * 3)
        let remaining = paid_amount
        let lastDate = date.getTime()
        for (let p = 0; p < installments; p++) {
          const isLast = p === installments - 1
          const share = isLast
            ? remaining
            : Math.max(1, Math.round((remaining / (installments - p)) * (0.7 + rand() * 0.6)))
          const installment = Math.min(remaining, share)
          remaining -= installment
          const delay = Math.floor(rand() * 5) * 86400_000
          lastDate += delay
          payments.push({
            id: `pay-${id}-${p}`,
            amount: installment,
            recorded_at: new Date(lastDate).toISOString(),
          })
          if (remaining <= 0) break
        }
      }

      result.push({
        id: `tr-${id++}`,
        patient_id: p.id,
        patient_name: p.name,
        teeth,
        treatment_type: MOCK_TREATMENT_TYPES[Math.floor(rand() * MOCK_TREATMENT_TYPES.length)]!,
        description: undefined,
        treatment_date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        cost,
        debt_amount,
        paid_amount,
        balance,
        images: [],
        payments,
        created_at: date.toISOString(),
      })
    }
  }

  // Sort newest first
  return result.sort((a, b) => b.treatment_date.localeCompare(a.treatment_date))
}

let MOCK_CACHE = buildMockTreatments()

interface ListParams {
  patient_id?: string
  page?: number
  per_page?: number
}

// Caller-side shape for recording a payment against a specific
// treatment. `patient_id` is required so we can hit the patient-scoped
// quick-payments endpoint. `description` defaults to the treatment_type
// on the caller side for nicer invoice labels in reports.
export interface RecordPaymentInput {
  patient_id: string
  treatment_id: string
  amount: number
  payment_method: QuickPaymentPayload['payment_method']
  payment_date: string  // YYYY-MM-DD
  description?: string
  notes?: string
}

export const recordPayment = async (input: RecordPaymentInput): Promise<ApiTreatment> => {
  requireOnline()
  if (USE_MOCK) {
    if (input.amount <= 0) throw new Error('Invalid amount')
    const idx = MOCK_CACHE.findIndex((t) => t.id === input.treatment_id)
    if (idx < 0) throw new Error('Treatment not found')
    const tr = MOCK_CACHE[idx]!
    // Cap at the remaining balance to mirror the real backend, which rejects
    // a treatment-linked quick-payment that exceeds the balance
    // (QuickPaymentService → amount_exceeds_balance).
    const applied = Math.min(tr.balance, input.amount)
    const newPaid = tr.paid_amount + applied
    const newPayment: ApiTreatmentPayment = {
      id: `pay-${input.treatment_id}-${Date.now()}`,
      amount: applied,
      recorded_at: new Date().toISOString(),
    }
    const updated: ApiTreatment = {
      ...tr,
      paid_amount: newPaid,
      balance: tr.debt_amount - newPaid,
      payments: [...(tr.payments ?? []), newPayment],
    }
    MOCK_CACHE = MOCK_CACHE.map((t, i) => (i === idx ? updated : t))
    return mockDelay(updated, 400)
  }
  // Backend's PaymentResource doesn't echo back the updated treatment,
  // so we optimistically construct the next-state Treatment locally and
  // return it. React Query consumers should still invalidate ['treatments']
  // to pick up authoritative state on the next render.
  const payment = await recordQuickPayment(input.patient_id, {
    amount: input.amount,
    payment_method: input.payment_method,
    payment_date: input.payment_date,
    description: input.description,
    treatment_id: input.treatment_id,
    notes: input.notes,
  })
  const cached = MOCK_CACHE.find((t) => t.id === input.treatment_id)
  if (cached) {
    const newPaid = cached.paid_amount + input.amount
    return {
      ...cached,
      paid_amount: newPaid,
      balance: cached.debt_amount - newPaid,
      payments: [
        ...(cached.payments ?? []),
        {
          id: payment.id,
          amount: payment.amount,
          recorded_at: payment.created_at,
        },
      ],
    }
  }
  // Cold path: we don't have the prior treatment cached (rare — would
  // only happen if a user paid against a treatment that was never
  // listed). Return a minimal stub; React Query refetch fills in the rest.
  return {
    id: input.treatment_id,
    patient_id: input.patient_id,
    teeth: [],
    treatment_type: input.description ?? '',
    treatment_date: input.payment_date,
    cost: input.amount,
    debt_amount: input.amount,
    paid_amount: input.amount,
    balance: 0,
    images: [],
    payments: [
      {
        id: payment.id,
        amount: payment.amount,
        recorded_at: payment.created_at,
      },
    ],
  }
}

export const listTreatments = async (params?: ListParams): Promise<ApiListResponse<ApiTreatment>> => {
  if (USE_MOCK) {
    let data = MOCK_CACHE
    if (params?.patient_id) {
      data = data.filter((t) => t.patient_id === params.patient_id)
    }
    return mockDelay({
      data,
      meta: {
        pagination: {
          current_page: 1,
          last_page: 1,
          per_page: data.length,
          total: data.length,
        },
      },
    })
  }
  // Backend wants Laravel-style nested filter params.
  const realParams: Record<string, string | number> = {}
  if (params?.patient_id) realParams['filter[patient_id]'] = params.patient_id
  if (params?.page) realParams.page = params.page
  if (params?.per_page) realParams.per_page = params.per_page
  // Default sort: newest treatment first, then most-recently-created as a
  // tiebreaker. Matches the web treatment-history-card so list order is the
  // same across clients (was previously left to backend default).
  realParams.sort = '-treatment_date,-created_at'

  const response = await client.get<ApiListResponse<ApiTreatment>>('/treatments', {
    params: realParams,
  })
  return {
    ...response.data,
    data: response.data.data.map(normalizeTreatmentFromApi),
  }
}

// TreatmentResource on the backend does NOT include a `payments` key — the
// Payment model lives off Invoices, not Treatments. We normalize here so:
//   • UI code that iterates `treatment.payments` never sees `undefined`
//   • If the backend ever starts eager-loading payments, the per-payment
//     `recorded_at` field (which mobile reads) is mapped from whichever
//     timestamp the backend ships (`created_at` is the closest analog;
//     `payment_date` is date-only and not unique enough for ordering).
function normalizeTreatmentFromApi(treatment: ApiTreatment): ApiTreatment {
  const rawPayments = (treatment.payments ?? []) as Array<
    ApiTreatmentPayment & { created_at?: string; payment_date?: string }
  >
  const payments: ApiTreatmentPayment[] = rawPayments.map((p) => ({
    id: p.id,
    amount: p.amount,
    recorded_at: p.recorded_at ?? p.created_at ?? p.payment_date ?? '',
  }))
  return {
    ...treatment,
    payments,
    // Backend may omit `images: []` when image_count is 0. Default so the UI
    // can always iterate safely without optional chaining everywhere.
    images: treatment.images ?? [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Treatment CRUD (per-patient)
//
// Mirrors the web app's contract:
//   POST   /patients/{id}/treatments
//   PUT    /patients/{id}/treatments/{tid}
//   DELETE /patients/{id}/treatments/{tid}
//   GET    /patients/{id}/treatments/{tid}        (single fetch + include images)
//
// On the mobile side these always hit the real backend — there's no
// per-feature mock fork because the create/edit UI was missing entirely
// before this change. (listTreatments still has its mock path for
// development demos with EXPO_PUBLIC_MOCK_TREATMENTS=true.)
// ─────────────────────────────────────────────────────────────────────────────

export interface TreatmentPayload {
  // teeth is the canonical multi-tooth array (Universal numbering 1–32).
  // Send empty array for "no specific tooth" entries (generic consult).
  teeth: number[]
  treatment_type: string
  treatment_date: string  // YYYY-MM-DD
  comment?: string | null
  description?: string | null
  debt_amount?: number
  paid_amount?: number
}

export async function getPatientTreatment(
  patientId: string,
  treatmentId: string
): Promise<ApiTreatment> {
  const r = await client.get<ApiResponse<ApiTreatment>>(
    `/patients/${patientId}/treatments/${treatmentId}?include_images=true`
  )
  return normalizeTreatmentFromApi(r.data.data)
}

export async function createPatientTreatment(
  patientId: string,
  payload: TreatmentPayload
): Promise<ApiTreatment> {
  requireOnline()
  const r = await client.post<ApiResponse<ApiTreatment>>(
    `/patients/${patientId}/treatments`,
    payload
  )
  return normalizeTreatmentFromApi(r.data.data)
}

export async function updatePatientTreatment(
  patientId: string,
  treatmentId: string,
  payload: TreatmentPayload
): Promise<ApiTreatment> {
  requireOnline()
  const r = await client.put<ApiResponse<ApiTreatment>>(
    `/patients/${patientId}/treatments/${treatmentId}`,
    payload
  )
  return normalizeTreatmentFromApi(r.data.data)
}

export async function deletePatientTreatment(
  patientId: string,
  treatmentId: string
): Promise<void> {
  requireOnline()
  await client.delete(`/patients/${patientId}/treatments/${treatmentId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Treatment image upload (multipart)
//
// The backend offers three upload paths:
//   1. POST /patients/{id}/treatments/{tid}/images                  ← we use this
//   2. POST .../images/direct-upload + PUT signed URL + complete    (S3 signed)
//   3. POST .../images/direct-upload-batch + complete               (batch S3)
//
// We pick the multipart path (#1) because it's a single round trip and the
// backend already validates / scans / variant-generates server-side. Direct
// upload would shave 1–2 seconds off a large upload but it doubles the
// surface area on the mobile (signing, progress, complete callback, retry
// after partial failure). When v1 ships and we see real upload pain in
// telemetry, we can revisit.
//
// Validation (matches UploadTreatmentImageRequest):
//   - mimes:  jpg, jpeg, png, webp
//   - max:    5120 KB (5 MB)
// ─────────────────────────────────────────────────────────────────────────────

export interface TreatmentImageAsset {
  uri: string
  mimeType?: string | null
  fileName?: string | null
  fileSize?: number | null
}

export async function uploadTreatmentImage(
  patientId: string,
  treatmentId: string,
  asset: TreatmentImageAsset
): Promise<ApiTreatmentImage> {
  requireOnline()

  // React Native's FormData accepts the {uri, name, type} shape for files —
  // it's a non-standard but universally-supported extension. The cast to
  // `any` is needed because the DOM FormData typings don't model it.
  const form = new FormData()
  const inferredType = asset.mimeType ?? guessMimeFromUri(asset.uri) ?? 'image/jpeg'
  const inferredName = asset.fileName ?? buildDefaultFileName(inferredType)
  form.append('image', {
    uri: asset.uri,
    name: inferredName,
    type: inferredType,
  } as unknown as Blob)

  const r = await client.post<ApiResponse<ApiTreatmentImage>>(
    `/patients/${patientId}/treatments/${treatmentId}/images`,
    form,
    {
      headers: {
        // CRITICAL: must be `undefined`, not the literal string
        // 'multipart/form-data'. Axios on React Native does not auto-append
        // the boundary when an explicit string Content-Type is supplied,
        // and the backend will reject the body with "missing file" / 400.
        // Setting to undefined lets the underlying XHR adapter detect the
        // FormData payload and emit `multipart/form-data; boundary=...`
        // with the correct boundary the platform generates.
        'Content-Type': undefined,
      },
      // Larger window than the default 20s so a slow phone network on a 4 MB
      // photo doesn't time out before reaching the server.
      timeout: 60_000,
    }
  )
  return r.data.data
}

export async function deleteTreatmentImage(
  patientId: string,
  treatmentId: string,
  imageId: string
): Promise<void> {
  requireOnline()
  await client.delete(
    `/patients/${patientId}/treatments/${treatmentId}/images/${imageId}`
  )
}

function guessMimeFromUri(uri: string): string | null {
  const m = uri.match(/\.(jpg|jpeg|png|webp|heic|heif)(?:\?|$)/i)
  if (!m) return null
  const ext = m[1].toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  // iOS sometimes hands back HEIC/HEIF URIs from the camera roll. The
  // image picker is configured to deliver JPEGs but if a callsite skips
  // that conversion we keep going and let the backend reject if needed.
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  return null
}

function buildDefaultFileName(mime: string): string {
  const ext =
    mime === 'image/png' ? 'png' :
    mime === 'image/webp' ? 'webp' :
    mime === 'image/heic' ? 'heic' :
    'jpg'
  // Suffix with timestamp so concurrent uploads from one device don't
  // collide on the backend's filename de-dup logic.
  return `treatment-${Date.now()}.${ext}`
}

// Resolve the best display URL on a treatment image, preferring preview →
// thumbnail → full. Used by the gallery so a freshly-uploaded image
// (which has no preview/thumbnail yet) still renders via the full URL.
export function resolveTreatmentImageUrl(
  image: ApiTreatmentImage,
  kind: 'thumbnail' | 'preview' | 'full' = 'preview'
): string | null {
  if (image.scan_status === 'rejected') return null
  if (kind === 'thumbnail') {
    return image.thumbnail_url ?? image.preview_url ?? image.url ?? null
  }
  if (kind === 'preview') {
    return image.preview_url ?? image.url ?? image.thumbnail_url ?? null
  }
  return image.url ?? image.preview_url ?? image.thumbnail_url ?? null
}
