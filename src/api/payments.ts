import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import type { ApiPayment, ApiResponse, PaymentMethod } from '../types'

// Mobile-facing payment endpoints.
//
// The backend has two payment-creation flows:
//   • `POST /payments` — canonical, requires an existing invoice_id. Used
//     by the web frontend's full Invoice → Payment workflow.
//   • `POST /patients/{id}/quick-payments` — mobile shortcut: bundles
//     invoice + payment creation into one atomic call. Used here.
//
// Mobile users don't see invoices as a separate concept — they record a
// payment against a Treatment or directly against a Patient's balance.
// `recordQuickPayment` covers both: if `treatment_id` is in the payload
// the backend will also update that Treatment's paid_amount, so the
// treatment list reflects the new balance on next render.

export interface QuickPaymentPayload {
  amount: number
  payment_method: PaymentMethod
  // YYYY-MM-DD. Defaults to today on the caller side — backend requires it.
  payment_date: string
  // Optional human description for the auto-generated invoice line.
  // Pass the treatment_type label here so reports name the line
  // meaningfully (e.g. "Tish davolash"). Backend falls back to
  // "Manual payment - <date>" when omitted.
  description?: string
  // Optional treatment reference. When set, backend mirrors the payment
  // amount onto the treatment row's paid_amount so the UI's per-treatment
  // balance stays consistent.
  treatment_id?: string
  // Optional free-text note stored on the payment row itself.
  notes?: string
}

export const recordQuickPayment = async (
  patientId: string,
  payload: QuickPaymentPayload
): Promise<ApiPayment> => {
  requireOnline()
  const response = await client.post<ApiResponse<ApiPayment>>(
    `/patients/${patientId}/quick-payments`,
    payload
  )
  return response.data.data
}
