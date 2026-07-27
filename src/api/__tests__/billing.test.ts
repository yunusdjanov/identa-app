import MockAdapter from 'axios-mock-adapter'

import client from '../client'
import {
  cancelBillingSubscription,
  createBillingCheckout,
  getCurrentSubscription,
  listBillingPayments,
  listBillingPlans,
  scheduleBillingDowngrade,
} from '../billing'
import { useAuthStore } from '../../stores/auth'
import type { ApiSubscriptionSummary } from '../../types'

function authenticate(): void {
  useAuthStore.setState({
    user: {
      id: '1',
      name: 'Dentist',
      email: 'dentist@example.com',
      role: 'dentist',
      account_status: 'active',
    },
    tokens: {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_expires_in: 2_592_000,
    },
    isAuthenticated: true,
    isHydrating: false,
  } as any)
}

const subscription: ApiSubscriptionSummary = {
  is_configured: true,
  plan: 'pro',
  status: 'active',
  access_mode: 'full',
  days_remaining: 19,
  staff_limit: 5,
  active_staff_count: 2,
}

describe('billing API', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authenticate()
  })

  afterEach(() => mock.restore())

  it('loads the current subscription from the real billing endpoint', async () => {
    mock.onGet('/billing/current-subscription').reply(200, { data: subscription })

    await expect(getCurrentSubscription()).resolves.toEqual(subscription)
    expect(mock.history.get).toHaveLength(1)
  })

  it('preserves a null response when the account has no subscription', async () => {
    mock.onGet('/billing/current-subscription').reply(200, { data: null })

    await expect(getCurrentSubscription()).resolves.toBeNull()
  })

  it('loads active paid plans and filters non-billable rows', async () => {
    mock.onGet('/billing/plans').reply(200, {
      data: [
        { id: 'trial', code: 'trial', is_paid: false, is_active: true },
        { id: 'basic', code: 'basic', is_paid: true, is_active: true },
        { id: 'old', code: 'pro', is_paid: true, is_active: false },
      ],
    })

    await expect(listBillingPlans()).resolves.toEqual([
      expect.objectContaining({ id: 'basic', code: 'basic' }),
    ])
  })

  it('loads the backend non-paginated payment-history contract', async () => {
    mock.onGet('/billing/payments').reply((config) => {
      expect(config.params).toBeUndefined()
      return [200, { data: [{ id: 'pay-1', status: 'paid' }] }]
    })

    await expect(listBillingPayments()).resolves.toEqual([
      expect.objectContaining({ id: 'pay-1', status: 'paid' }),
    ])
  })

  it('rejects a malformed payment-history response instead of crashing the sheet', async () => {
    mock.onGet('/billing/payments').reply(200, { data: null })

    await expect(listBillingPayments()).rejects.toThrow('Invalid billing payment history response')
  })

  it('creates checkout, schedules downgrade, and cancels through distinct endpoints', async () => {
    const payment = { id: 'pay-1', status: 'pending' }
    mock.onPost('/billing/checkout').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ plan_code: 'pro', billing_period: 'yearly' })
      return [201, { data: { checkout_url: 'https://pay.example.test/1', payment } }]
    })
    mock.onPost('/billing/downgrade').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ plan_code: 'basic', billing_period: 'monthly' })
      return [200, { data: { ...subscription, pending_plan_code: 'basic' } }]
    })
    mock.onPost('/billing/cancel').reply(200, {
      data: { ...subscription, cancel_at_period_end: true },
    })

    await expect(createBillingCheckout({ plan_code: 'pro', billing_period: 'yearly' }))
      .resolves.toEqual(expect.objectContaining({ checkout_url: 'https://pay.example.test/1' }))
    await expect(scheduleBillingDowngrade({ plan_code: 'basic', billing_period: 'monthly' }))
      .resolves.toEqual(expect.objectContaining({ pending_plan_code: 'basic' }))
    await expect(cancelBillingSubscription())
      .resolves.toEqual(expect.objectContaining({ cancel_at_period_end: true }))
  })
})
