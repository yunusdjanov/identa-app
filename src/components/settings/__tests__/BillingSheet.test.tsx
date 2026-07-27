import React from 'react'
import { Linking } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import {
  cancelBillingSubscription,
  createBillingCheckout,
  getCurrentSubscription,
  listBillingPayments,
  listBillingPlans,
  scheduleBillingDowngrade,
  type BillingPlan,
} from '../../../api/billing'
import { useAuthStore } from '../../../stores/auth'
import type { ApiSubscriptionSummary, ApiUser } from '../../../types'
import BillingSheet from '../BillingSheet'
import { isSecureCheckoutUrl } from '../BillingSheet'

const mockConfirm = jest.fn()
const mockWarning = jest.fn()

jest.mock('../../ui/BottomSheet', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native')
    return visible ? <View>{children}</View> : null
  },
}))

jest.mock('../../../api/billing', () => ({
  getCurrentSubscription: jest.fn(),
  listBillingPlans: jest.fn(),
  listBillingPayments: jest.fn(),
  createBillingCheckout: jest.fn(),
  scheduleBillingDowngrade: jest.fn(),
  cancelBillingSubscription: jest.fn(),
}))

jest.mock('../../ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: mockWarning,
    info: jest.fn(),
  }),
}))

jest.mock('../../ui/Dialog', () => ({
  useDialog: () => ({ confirm: mockConfirm }),
}))

const basicPlan: BillingPlan = {
  id: 'basic',
  code: 'basic',
  name: 'Basic',
  description: 'Basic tools',
  is_trial: false,
  is_paid: true,
  trial_days: null,
  monthly_price: 120_000,
  yearly_price: 1_200_000,
  currency: 'UZS',
  staff_limit: 3,
  entry_image_limit: 5,
  upload_max_mb: 10,
  stored_image_max_mb: 5,
  can_export: false,
  is_active: true,
}

const proPlan: BillingPlan = {
  ...basicPlan,
  id: 'pro',
  code: 'pro',
  name: 'Pro',
  description: 'Advanced tools',
  monthly_price: 300_000,
  yearly_price: 3_000_000,
  staff_limit: 10,
  entry_image_limit: 20,
  can_export: true,
}

function subscription(overrides: Partial<ApiSubscriptionSummary> = {}): ApiSubscriptionSummary {
  return {
    is_configured: true,
    plan: 'basic',
    plan_name: 'Basic',
    billing_period: 'monthly',
    status: 'active',
    access_mode: 'full',
    starts_at: '2026-07-01T00:00:00Z',
    ends_at: '2026-08-01T00:00:00Z',
    days_remaining: 14,
    staff_limit: 3,
    active_staff_count: 2,
    cancel_at_period_end: false,
    ...overrides,
  }
}

function dentist(sub: ApiSubscriptionSummary): ApiUser {
  return {
    id: 'dentist-1',
    name: 'Dentist',
    email: 'dentist@example.com',
    role: 'dentist',
    account_status: 'active',
    subscription: sub,
  }
}

function paymentHistory() {
  return [{
    id: 'payment-1',
    plan_code: 'basic' as const,
    plan_name: 'Basic',
    billing_period: 'monthly' as const,
    amount: 120_000,
    currency: 'UZS',
    status: 'paid' as const,
    provider: 'payx' as const,
    provider_payment_id: 'provider-1',
    provider_order_id: 'order-1',
    paid_at: '2026-07-01T00:00:00Z',
    created_at: '2026-07-01T00:00:00Z',
  }]
}

function renderSheet(sub = subscription(), locale: 'uz' | 'ru' | 'en' = 'uz') {
  useAuthStore.setState({ user: dentist(sub), isAuthenticated: true } as never)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale={locale}>
        <BillingSheet visible onClose={jest.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('BillingSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getCurrentSubscription).mockResolvedValue(subscription())
    jest.mocked(listBillingPlans).mockResolvedValue([basicPlan, proPlan])
    jest.mocked(listBillingPayments).mockResolvedValue(paymentHistory())
    jest.mocked(createBillingCheckout).mockResolvedValue({
      checkout_url: 'https://pay.example.test/checkout',
      payment: paymentHistory()[0],
    })
    jest.mocked(scheduleBillingDowngrade).mockResolvedValue(subscription({ pending_plan_code: 'basic' }))
    jest.mocked(cancelBillingSubscription).mockResolvedValue(subscription({ cancel_at_period_end: true }))
    mockConfirm.mockResolvedValue(true)
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shows the current period end instead of claiming automatic renewal', async () => {
    const screen = renderSheet()

    expect(await screen.findByText('Joriy davr tugaydi')).toBeTruthy()
    expect(screen.queryByText('Yangilanadi')).toBeNull()
    expect(await screen.findByText("To'lovlar tarixi")).toBeTruthy()
  })

  it('renders the backend payment-history response without leaving the sheet loading', async () => {
    const screen = renderSheet()

    expect(await screen.findByText("To'langan")).toBeTruthy()
    expect(listBillingPayments).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['ru', 'Оплачен'],
    ['en', 'Paid'],
  ] as const)('renders billing content in %s without raw translation keys', async (locale, paidLabel) => {
    const screen = renderSheet(subscription(), locale)

    expect(await screen.findByText(paidLabel)).toBeTruthy()
    expect(screen.queryByText(/settings\./)).toBeNull()
  })

  it('confirms checkout and opens the PayX URL', async () => {
    const screen = renderSheet()
    const selectButtons = await screen.findAllByLabelText('Tarifni tanlash')

    fireEvent.press(selectButtons[0])

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    await waitFor(() => expect(createBillingCheckout).toHaveBeenCalledWith({
      plan_code: 'pro',
      billing_period: 'monthly',
    }, expect.anything()))
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('https://pay.example.test/checkout'))
  })

  it('blocks a downgrade that would silently exceed the target staff limit', async () => {
    const proSubscription = subscription({
      plan: 'pro',
      plan_name: 'Pro',
      staff_limit: 10,
      active_staff_count: 4,
    })
    jest.mocked(getCurrentSubscription).mockResolvedValue(proSubscription)
    const screen = renderSheet(proSubscription)

    const downgrade = await screen.findByLabelText("O'zgarishni rejalash")
    expect(downgrade.props.accessibilityState.disabled).toBe(true)
    expect(await screen.findByText(
      'Bu tarif uchun faol xodimlar sonini 3 tagacha kamaytiring.'
    )).toBeTruthy()
    expect(scheduleBillingDowngrade).not.toHaveBeenCalled()
  })

  it('refuses an insecure checkout redirect', async () => {
    jest.mocked(createBillingCheckout).mockResolvedValue({
      checkout_url: 'http://pay.example.test/checkout',
      payment: paymentHistory()[0],
    })
    const screen = renderSheet()

    fireEvent.press((await screen.findAllByLabelText('Tarifni tanlash'))[0]!)

    await waitFor(() => expect(createBillingCheckout).toHaveBeenCalled())
    expect(Linking.openURL).not.toHaveBeenCalled()
  })
})

describe('isSecureCheckoutUrl', () => {
  it('accepts HTTPS URLs without embedded credentials only', () => {
    expect(isSecureCheckoutUrl('https://payx.uz/pay/123')).toBe(true)
    expect(isSecureCheckoutUrl('http://payx.uz/pay/123')).toBe(false)
    expect(isSecureCheckoutUrl('https://user:pass@payx.uz/pay/123')).toBe(false)
    expect(isSecureCheckoutUrl('not-a-url')).toBe(false)
  })
})
