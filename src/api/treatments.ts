import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import { recordQuickPayment, type QuickPaymentPayload } from './payments'
import type { ApiTreatment, ApiTreatmentPayment, ApiListResponse } from '../types'

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
  return { ...treatment, payments }
}
