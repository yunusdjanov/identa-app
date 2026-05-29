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

// Delete a payment by id. Backend reverses the invoice's paid_amount and,
// if the payment was linked to a treatment, the treatment's paid_amount
// too — the caller just needs to invalidate `['treatments']` and
// `['patients', 'overview']` to see fresh balances.
//
// Note: the web app uses this from the per-payment row's context menu;
// mobile invokes it from a long-press on the payment history row inside
// TreatmentDetailSheet.
export const deletePayment = async (paymentId: string): Promise<void> => {
  requireOnline()
  await client.delete(`/payments/${paymentId}`)
}

// Update a payment (amount / method / date). The endpoint exists but mobile
// v1 doesn't surface an edit UI — easier to delete and re-record than to
// build another form sheet. Keeping the wrapper here so the endpoint is
// discoverable for the next iteration without re-reading the backend
// routes.
export interface UpdatePaymentPayload {
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  notes?: string | null
}

export const updatePayment = async (
  paymentId: string,
  payload: UpdatePaymentPayload
): Promise<ApiPayment> => {
  requireOnline()
  const response = await client.put<ApiResponse<ApiPayment>>(
    `/payments/${paymentId}`,
    payload
  )
  return response.data.data
}
