import client from './client'
import type { ApiSubscriptionSummary } from '../types'

export interface BillingPlan {
  id: string
  code: 'trial' | 'basic' | 'pro'
  name: string
  description: string | null
  is_trial: boolean
  is_paid: boolean
  trial_days: number | null
  monthly_price: number | null
  yearly_price: number | null
  currency: string
  staff_limit: number
  entry_image_limit: number
  upload_max_mb: number
  stored_image_max_mb: number
  can_export: boolean
  is_active: boolean
}

export interface BillingPayment {
  id: string
  plan_code: 'basic' | 'pro'
  plan_name: string
  billing_period: 'monthly' | 'yearly'
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'
  provider: 'payx' | 'manual_admin'
  provider_payment_id: string | null
  provider_order_id: string
  paid_at: string | null
  refunded_at?: string | null
  created_at: string | null
}

/**
 * Fetches the server-authoritative subscription state.
 *
 * The user object received during login contains the same summary, but that
 * snapshot can become stale after an admin action or billing webhook.
 */
export async function getCurrentSubscription(): Promise<ApiSubscriptionSummary | null> {
  return client
    .get<{ data: ApiSubscriptionSummary | null }>('/billing/current-subscription')
    .then((response) => response.data.data)
}

export async function listBillingPlans(): Promise<BillingPlan[]> {
  return client
    .get<{ data: BillingPlan[] }>('/billing/plans')
    .then((response) => response.data.data.filter((plan) => plan.is_paid && plan.is_active))
}

export async function listBillingPayments(signal?: AbortSignal): Promise<BillingPayment[]> {
  const response = await client.get<{ data: BillingPayment[] }>('/billing/payments', { signal })
  if (!Array.isArray(response.data.data)) {
    throw new Error('Invalid billing payment history response')
  }
  return response.data.data
}

export async function createBillingCheckout(payload: {
  plan_code: 'basic' | 'pro'
  billing_period: 'monthly' | 'yearly'
}): Promise<{ checkout_url: string; payment: BillingPayment }> {
  return client
    .post<{ data: { checkout_url: string; payment: BillingPayment } }>('/billing/checkout', payload)
    .then((response) => response.data.data)
}

export async function scheduleBillingDowngrade(payload: {
  plan_code: 'basic'
  billing_period: 'monthly' | 'yearly'
}): Promise<ApiSubscriptionSummary> {
  return client
    .post<{ data: ApiSubscriptionSummary }>('/billing/downgrade', payload)
    .then((response) => response.data.data)
}

export async function cancelBillingSubscription(): Promise<ApiSubscriptionSummary | null> {
  return client
    .post<{ data: ApiSubscriptionSummary | null }>('/billing/cancel')
    .then((response) => response.data.data)
}
